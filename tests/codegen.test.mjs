import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { loadGenerator } from "./generator.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { codegen, GenerateRequest, Column, Parameter, Query } = await loadGenerator();

function column(name, type, notNull = true, extra = {}) {
  return new Column({ name, type: { name: type }, notNull, ...extra });
}

function parameter(name, type, number = 1, notNull = true) {
  return new Parameter({ number, column: column(name, type, notNull) });
}

function authorQuery(driver, extra = {}) {
  const pg = driver === "pg" || driver === "postgres";
  return new Query({
    name: "GetAuthor",
    filename: "query.sql",
    cmd: ":one",
    text: "SELECT author_id, first_name, bio FROM authors WHERE author_id = " + (pg ? "$1" : "?"),
    params: [parameter("author_id", pg ? "int4" : "int")],
    columns: [
      column("author_id", pg ? "int4" : "int"),
      column("first_name", "text"),
      column("bio", "text", false),
    ],
    ...extra,
  });
}

function request(options, queries = [authorQuery(options.driver)], extra = {}) {
  return new GenerateRequest({
    pluginOptions: new TextEncoder().encode(JSON.stringify(options)),
    queries,
    ...extra,
  });
}

function generate(options, queries, extra) {
  const result = codegen(request(options, queries, extra));
  assert.equal(result.files.length, 1);
  return new TextDecoder().decode(result.files[0].contents);
}

function evaluate(source) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.deepEqual(diagnostics, []);
  const exports = {};
  // All driver dependencies are type-only; executing generated queries needs
  // only a database argument and no installed database client.
  new Function("exports", outputText)(exports);
  return exports;
}

const npmDrivers = [
  ["pg", "pg", "bytea"],
  ["postgres", "postgres", "bytea"],
  ["mysql2", "mysql2/promise", "blob"],
  ["better-sqlite3", "better-sqlite3", "blob"],
];

for (const [driver, moduleName, binaryType] of npmDrivers) {
  test(`${driver}: Node and Bun output stays unchanged`, async () => {
    // Captured from the generator before adding Deno support.
    const expected = await readFile(join(root, `tests/fixtures/${driver}.ts`), "utf8");
    assert.equal(generate({ driver }), expected);
    assert.equal(generate({ driver, runtime: "node" }), expected);
    assert.equal(generate({ driver, runtime: "bun" }), expected);
  });

  test(`${driver}: Deno uses npm type imports`, () => {
    const source = generate({ driver, runtime: "deno" });
    assert.ok(source.includes(`from "npm:${moduleName}";`));
    assert.match(source, /import type /);
    assert.doesNotMatch(source, /node:buffer/);
    if (driver === "pg" || driver === "better-sqlite3") {
      assert.ok(source.includes(`// @deno-types="npm:@types/${driver}"`));
    }
    assert.equal(typeof evaluate(source).getAuthor, "function");
  });

  test(`${driver}: Deno imports Buffer for binary rows and parameters`, () => {
    for (const extra of [
      { columns: [column("image_data", binaryType, false)] },
      { params: [parameter("image_data", binaryType)] },
    ]) {
      const source = generate({ driver, runtime: "deno" }, [authorQuery(driver, extra)]);
      assert.match(source, /import type \{ Buffer \} from "node:buffer";/);
      assert.equal(source.match(/from "node:buffer"/g).length, 1);
      assert.match(source, /imageData: Buffer/);
    }
  });
}

test("Deno handles PostgreSQL interval imports and Buffer array types", () => {
  const source = generate({ driver: "pg", runtime: "deno" }, [
    authorQuery("pg", {
      params: [parameter("time_span", "interval")],
      columns: [column("image_data", "pg_catalog.bytea", false, { isArray: true })],
    }),
  ]);
  assert.match(source, /import type \{ IPostgresInterval \} from "npm:postgres-interval";/);
  assert.match(source, /import type \{ Buffer \} from "node:buffer";/);
  assert.match(source, /imageData: Buffer\[\] \| null;/);
});

test("Deno imports Buffer for every MySQL binary type", () => {
  for (const type of ["binary", "bit", "blob", "longblob", "mediumblob", "tinyblob", "varbinary"]) {
    const source = generate({ driver: "mysql2", runtime: "deno" }, [
      authorQuery("mysql2", { columns: [column("data", type)] }),
    ]);
    assert.match(source, /import type \{ Buffer \} from "node:buffer";/, type);
    assert.match(source, /data: Buffer;/, type);
  }
});

test("MySQL bigint options keep the same types on every runtime", () => {
  const cases = [
    [{}, "number"],
    [{ big_number_strings: true }, "number"],
    [{ support_big_numbers: true }, "number | string"],
    [{ support_big_numbers: true, big_number_strings: true }, "string"],
  ];
  for (const runtime of ["node", "bun", "deno"]) {
    for (const [mysql2, type] of cases) {
      const source = generate({ driver: "mysql2", runtime, mysql2 }, [
        authorQuery("mysql2", { columns: [column("large_id", "bigint")] }),
      ]);
      assert.ok(source.includes(`largeId: ${type};`), `${runtime}: ${JSON.stringify(mysql2)}`);
    }
  }
});

test("rejects unknown runtimes and drivers", () => {
  assert.throws(() => codegen(request({ driver: "pg", runtime: "browser" })), /unknown runtime: browser/);
  assert.throws(() => codegen(request({ driver: "missing", runtime: "deno" })), /unknown driver: missing/);
});

test("@db/sqlite requires Deno and a SQLite engine", () => {
  for (const driver of ["@db/sqlite", "jsr:@db/sqlite"]) {
    for (const runtime of [undefined, "node", "bun"]) {
      assert.throws(() => codegen(request({ driver, runtime })), /requires runtime: deno/);
    }
    for (const engine of ["postgresql", "mysql"]) {
      assert.throws(
        () => codegen(request({ driver, runtime: "deno" }, undefined, { settings: { engine } })),
        /requires engine: sqlite/,
      );
    }
  }
  const options = { driver: "@db/sqlite", runtime: "deno" };
  assert.equal(generate(options), generate({ ...options, driver: "jsr:@db/sqlite" }));
  assert.match(generate(options, undefined, { settings: { engine: "sqlite" } }), /from "jsr:@db\/sqlite"/);
});

const sqliteOptions = { driver: "@db/sqlite", runtime: "deno" };

function sqliteQuery(cmd, extra = {}) {
  return authorQuery("@db/sqlite", { name: "RunQuery", cmd, ...extra });
}

function mockDatabase({ row, rows = [], failure, lastInsertRowId = 42 } = {}) {
  const calls = [];
  let finalized = 0;
  function execute(method, args, result) {
    calls.push({ method, args });
    if (failure) throw failure;
    return result;
  }
  return {
    calls,
    get finalized() { return finalized; },
    database: {
      lastInsertRowId,
      prepare(sql) {
        calls.push({ method: "prepare", sql });
        return {
          run(...args) { return execute("run", args, 1); },
          value(...args) { return execute("value", args, row); },
          values(...args) { return execute("values", args, rows); },
          finalize() { finalized++; },
        };
      },
    },
  };
}

test("@db/sqlite maps storage types and nulls without Node dependencies", () => {
  const groups = [
    [["int", "INTEGER", "tinyint", "smallint", "mediumint", "bigint", "unsigned big int", "int2", "int8", "numeric", "decimal(10, 2)"], "number | bigint"],
    [["text", "char(20)", "character", "clob", "varchar(20)", "varying character(20)", "nchar", "native character", "nvarchar", "date", "datetime", "timestamp"], "string"],
    [["real", "double", "double precision", "float", "boolean", "bool"], "number"],
    [["blob"], "Uint8Array"],
  ];
  for (const [types, expected] of groups) {
    for (const type of types) {
      const source = generate(sqliteOptions, [sqliteQuery(":one", { columns: [column("stored_value", type, false)] })]);
      const nullableType = expected.includes(" | ") ? `(${expected}) | null` : `${expected} | null`;
      assert.ok(source.includes(`storedValue: ${nullableType};`), type);
      assert.match(source, /import type \{ Database \} from "jsr:@db\/sqlite";/);
      assert.doesNotMatch(source, /\bBuffer\b|node:|npm:/);
    }
  }
});

test("@db/sqlite :one maps snake_case rows and returns synchronously", () => {
  const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(":one")]));
  const mock = mockDatabase({ row: [7, "Ada", null] });
  assert.deepEqual(runQuery(mock.database, { authorId: 7 }), { authorId: 7, firstName: "Ada", bio: null });
  assert.deepEqual(mock.calls[1], { method: "value", args: [7] });
  assert.equal(mock.finalized, 1);
});

test("@db/sqlite :one returns null for no row and finalizes the statement", () => {
  const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(":one")]));
  const mock = mockDatabase();
  assert.equal(runQuery(mock.database, { authorId: 999 }), null);
  assert.equal(mock.finalized, 1);
});

test("@db/sqlite :many maps each row in column order and handles no rows", () => {
  const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(":many", { params: [] })]));
  const mock = mockDatabase({ rows: [[1, "Ada", null], [2n, "Grace", "Writer"]] });
  assert.deepEqual(runQuery(mock.database), [
    { authorId: 1, firstName: "Ada", bio: null },
    { authorId: 2n, firstName: "Grace", bio: "Writer" },
  ]);
  assert.deepEqual(mock.calls[1], { method: "values", args: [] });
  assert.equal(mock.finalized, 1);
  const empty = mockDatabase();
  assert.deepEqual(runQuery(empty.database), []);
  assert.equal(empty.finalized, 1);
});

test("@db/sqlite keeps joined columns distinct using positional results", () => {
  const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(":one", {
    columns: [column("author_id", "integer"), column("author_id", "integer")],
  })]));
  const mock = mockDatabase({ row: [1, 2] });
  assert.deepEqual(runQuery(mock.database, { authorId: 1 }), { authorId: 1, authorId_2: 2 });
  assert.equal(mock.finalized, 1);
});

for (const [cmd, method] of [[":exec", "run"], [":execlastid", "run"], [":one", "value"], [":many", "values"]]) {
  test(`@db/sqlite ${cmd} binds nullable and binary arguments in query order`, () => {
    const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(cmd, {
      params: [parameter("image_data", "blob"), parameter("bio", "text", 2, false)],
      columns: cmd === ":one" || cmd === ":many" ? [column("image_data", "blob")] : [],
    })]));
    const bytes = new Uint8Array([0, 128, 255]);
    const mock = mockDatabase({ row: [bytes], rows: [[bytes]] });
    const result = runQuery(mock.database, { bio: null, imageData: bytes });
    assert.deepEqual(mock.calls[1], { method, args: [bytes, null] });
    assert.equal(mock.finalized, 1);
    if (cmd === ":exec") assert.equal(result, undefined);
    if (cmd === ":execlastid") assert.equal(result, 42);
    if (cmd === ":one") assert.strictEqual(result.imageData, bytes);
    if (cmd === ":many") assert.strictEqual(result[0].imageData, bytes);
  });

  test(`@db/sqlite ${cmd} finalizes after execution errors`, () => {
    const failure = new Error("SQLite constraint failed");
    const mock = mockDatabase({ failure });
    const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(cmd, { params: [] })]));
    assert.throws(() => runQuery(mock.database), (error) => error === failure);
    assert.equal(mock.finalized, 1);
  });
}

test("@db/sqlite :execlastid reads the insert ID after running the statement", () => {
  const { runQuery } = evaluate(generate(sqliteOptions, [sqliteQuery(":execlastid", { params: [], columns: [] })]));
  let finalized = false;
  let inserted = false;
  const database = {
    get lastInsertRowId() {
      assert.equal(inserted, true);
      return 73;
    },
    prepare() {
      return {
        run() { inserted = true; },
        finalize() { finalized = true; },
      };
    },
  };
  assert.equal(runQuery(database), 73);
  assert.equal(finalized, true);
});
