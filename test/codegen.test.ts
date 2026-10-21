import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSourceFile,
  isNoSubstitutionTemplateLiteral,
  isVariableStatement,
  ScriptTarget,
} from "typescript";

import { codegen } from "../src/codegen";
import {
  Catalog,
  Column,
  Enum,
  GenerateRequest,
  Identifier,
  Parameter,
  Query,
  Schema,
} from "../src/gen/plugin/codegen_pb";

function generate(
  queries: Query[],
  catalog?: Catalog,
  driver = "postgres"
): string[] {
  const response = codegen(
    new GenerateRequest({
      catalog,
      queries,
      pluginOptions: new TextEncoder().encode(
        JSON.stringify({ runtime: "node", driver })
      ),
    })
  );
  return response.files.map((f) => new TextDecoder().decode(f.contents));
}

function column(name: string, type: string, fields: Partial<Column> = {}) {
  return new Column({
    name,
    type: new Identifier({ name: type }),
    notNull: true,
    ...fields,
  });
}

function query(fields: Partial<Query>) {
  return new Query({ name: "Q", cmd: ":one", filename: "query.sql", text: "select 1", ...fields });
}

function params(...columns: Column[]) {
  return columns.map((c, i) => new Parameter({ number: i + 1, column: c }));
}

// The cooked text of the exported query constant, as JavaScript reads it.
function queryText(file: string, name: string): string {
  const source = createSourceFile("out.ts", file, ScriptTarget.Latest);
  for (const statement of source.statements) {
    if (!isVariableStatement(statement)) {
      continue;
    }
    const decl = statement.declarationList.declarations[0];
    if (decl.name.getText(source) === name && decl.initializer && isNoSubstitutionTemplateLiteral(decl.initializer)) {
      return decl.initializer.text;
    }
  }
  throw new Error(`${name} not found`);
}

test("analyzer type names map like catalog type names", () => {
  // The database analyzer names types with format_type, modifiers included.
  const [file] = generate([
    query({
      columns: [
        column("a", "integer"),
        column("b", "smallint"),
        column("c", "bigint"),
        column("d", "boolean"),
        column("e", "double precision"),
        column("f", "real"),
        column("g", "numeric(12,2)"),
        column("h", "pg_catalog.timestamptz"),
        column("i", "timestamp(3) with time zone"),
        column("j", "character varying(40)"),
        column("k", "int4"),
        column("l", "pg_catalog.bool"),
      ],
    }),
  ]);
  assert.match(file, /a: number;/);
  assert.match(file, /b: number;/);
  assert.match(file, /c: string;/);
  assert.match(file, /d: boolean;/);
  assert.match(file, /e: number;/);
  assert.match(file, /f: number;/);
  assert.match(file, /g: string;/);
  assert.match(file, /h: Date;/);
  assert.match(file, /i: Date;/);
  assert.match(file, /j: string;/);
  assert.match(file, /k: number;/);
  assert.match(file, /l: boolean;/);
});

test("parameters are typed by the same table", () => {
  const [file] = generate([
    query({
      params: params(
        column("count", "integer"),
        column("active", "boolean"),
        column("maybe", "integer", { notNull: false })
      ),
    }),
  ]);
  assert.match(file, /count: number;/);
  assert.match(file, /active: boolean;/);
  assert.match(file, /maybe: number \| null;/);
});

test("date and timestamp parameters take a Date or a string", () => {
  const [file] = generate([
    query({
      params: params(
        column("day", "date"),
        column("at", "pg_catalog.timestamptz", { notNull: false })
      ),
      columns: [column("day", "date")],
    }),
  ]);
  assert.match(file, /interface QArgs \{\n\s+day: Date \| string;\n\s+at: Date \| string \| null;/);
  assert.match(file, /interface QRow \{\n\s+day: Date;/);
});

test("array parameters and columns", () => {
  const [file] = generate([
    query({
      params: params(
        column("ids", "uuid", { isArray: true, arrayDims: 1 }),
        column("counts", "integer", { isArray: true, arrayDims: 1 })
      ),
      columns: [column("grid", "integer", { isArray: true, arrayDims: 2 })],
    }),
  ]);
  assert.match(file, /ids: string\[\];/);
  assert.match(file, /counts: number\[\];/);
  assert.match(file, /grid: number\[\]\[\];/);
});

test("enum types become string literal unions", () => {
  const catalog = new Catalog({
    defaultSchema: "public",
    schemas: [
      new Schema({ name: "public", enums: [new Enum({ name: "status", vals: ["open", "closed"] })] }),
      new Schema({ name: "auth", enums: [new Enum({ name: "level", vals: ["aal1", "aal2"] })] }),
    ],
  });
  const [file] = generate(
    [
      query({
        params: params(column("statuses", "status", { isArray: true, arrayDims: 1 })),
        columns: [
          column("status", "status"),
          column("maybe", "public.status", { notNull: false }),
          column("level", "auth.level"),
          column("catalog", "", { type: new Identifier({ schema: "auth", name: "level" }) }),
        ],
      }),
    ],
    catalog
  );
  assert.match(file, /statuses: \("open" \| "closed"\)\[\];/);
  assert.match(file, /status: "open" \| "closed";/);
  assert.match(file, /maybe: "open" \| "closed" \| null;/);
  assert.match(file, /level: "aal1" \| "aal2";/);
  assert.match(file, /catalog: "aal1" \| "aal2";/);
});

test("query text reaches JavaScript exactly as written", () => {
  const text = "select '\\%' as a, '\\\\' as b, '`' as c, '${x}' as d, $1::text as e";
  const [file] = generate([query({ name: "Escapes", text })]);
  assert.equal(queryText(file, "escapesQuery"), `-- name: Escapes :one\n${text}`);
});

test("one file per query file", () => {
  const files = generate([
    query({ name: "A" }),
    query({ name: "B" }),
    query({ name: "C", filename: "other.sql" }),
  ]);
  assert.equal(files.length, 2);
  assert.match(files[0], /aQuery[\s\S]*bQuery/);
});

test("the pg driver uses the same type names", () => {
  const [file] = generate(
    [query({ params: params(column("n", "integer"), column("b", "boolean")) })],
    undefined,
    "pg"
  );
  assert.match(file, /n: number;/);
  assert.match(file, /b: boolean;/);
});
