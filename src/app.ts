// I cant' get this import to work locally. The import in node_modules is
// javy/dist but esbuild requires the import to be javy/fs
//
// @ts-expect-error
import { readFileSync, writeFileSync, STDIO } from "javy/fs";
import {
  EmitHint,
  NewLineKind,
  TypeNode,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  Node,
  NodeFlags,
  createPrinter,
  createSourceFile,
  factory,
} from "typescript";

import {
  GenerateRequest,
  GenerateResponse,
  Parameter,
  Column,
  File,
  Query,
} from "./gen/plugin/codegen_pb";

import { argName, colName } from "./drivers/utlis";
import { Driver as Sqlite3Driver } from "./drivers/better-sqlite3";
import { Driver as PgDriver } from "./drivers/pg";
import { Driver as PostgresDriver } from "./drivers/postgres";
import { Mysql2Options, Driver as MysqlDriver } from "./drivers/mysql2";
import { Driver as BunSqlDriver } from "./drivers/bun-sql";
import { Driver as BunSqliteDriver } from "./drivers/bun-sqlite";

// Read input from stdin
const input = readInput();
// Call the function with the input
const result = codegen(input);
// Write the result to stdout
writeOutput(result);

interface Options {
  runtime?: string;
  driver?: string;
  mysql2?: Mysql2Options
}

interface Driver {
  preamble: (queries: Query[]) => Node[];
  columnType: (c?: Column) => TypeNode;
  execDecl: (
    name: string,
    text: string,
    iface: string | undefined,
    params: Parameter[]
  ) => Node;
  execlastidDecl: (
    name: string,
    text: string,
    iface: string | undefined,
    params: Parameter[]
  ) => Node;
  manyDecl: (
    name: string,
    text: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) => Node;
  oneDecl: (
    name: string,
    text: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) => Node;
}

function createNodeGenerator(options: Options): Driver {
  switch (options.driver) {
    case "mysql2": {
      return new MysqlDriver(options.mysql2);
    }
    case "pg": {
      return new PgDriver();
    }
    case "postgres": {
      return new PostgresDriver();
    }
    case "bun-sql": {
      return new BunSqlDriver();
    }
    case "bun-sqlite": {
      return new BunSqliteDriver();
    }
    case "better-sqlite3": {
      return new Sqlite3Driver();
    }
  }
  throw new Error(`unknown driver: ${options.driver}`);
}

function codegen(input: GenerateRequest): GenerateResponse {
  let files = [];
  let options: Options = {};

  if (input.pluginOptions.length > 0) {
    const text = new TextDecoder().decode(input.pluginOptions);
    options = JSON.parse(text) as Options;
  }

  const driver = createNodeGenerator(options);

  // TODO: Verify options, parse them from protobuf honestly

  const querymap = new Map<string, Query[]>();

  for (const query of input.queries) {
    if (!querymap.has(query.filename)) {
      querymap.set(query.filename, []);
    }
    const qs = querymap.get(query.filename);
    qs?.push(query);
  }

  for (const [filename, queries] of querymap.entries()) {
    const nodes = driver.preamble(queries);

    for (const query of queries) {
      const colmap = new Map<string, number>();
      for (let column of query.columns) {
        if (!column.name) {
          continue;
        }
        const count = colmap.get(column.name) || 0;
        if (count > 0) {
          column.name = `${column.name}_${count + 1}`;
        }
        colmap.set(column.name, count + 1);
      }

      const lowerName = query.name[0].toLowerCase() + query.name.slice(1);
      const textName = `${lowerName}Query`;

      nodes.push(
        queryDecl(
          textName,
          `-- name: ${query.name} ${query.cmd}
${query.text}`
        )
      );

      let argIface = undefined;
      let returnIface = undefined;
      if (query.params.length > 0) {
        argIface = `${query.name}Args`;
        nodes.push(argsDecl(argIface, driver, query.params));
      }
      if (query.columns.length > 0) {
        returnIface = `${query.name}Row`;
        nodes.push(rowDecl(returnIface, driver, query.columns));
      }

      switch (query.cmd) {
        case ":exec": {
          nodes.push(
            driver.execDecl(lowerName, textName, argIface, query.params)
          );
          break;
        }
        case ":execlastid": {
          nodes.push(
            driver.execlastidDecl(lowerName, textName, argIface, query.params)
          );
          break;
        }
        case ":one": {
          nodes.push(
            driver.oneDecl(
              lowerName,
              textName,
              argIface,
              returnIface ?? "void",
              query.params,
              query.columns
            )
          );
          break;
        }
        case ":many": {
          nodes.push(
            driver.manyDecl(
              lowerName,
              textName,
              argIface,
              returnIface ?? "void",
              query.params,
              query.columns
            )
          );
          break;
        }
      }
      if (nodes) {
        files.push(
          new File({
            name: `${filename.replace(".", "_")}.ts`,
            contents: new TextEncoder().encode(printNode(nodes)),
          })
        );
      }
    }
  }

  return new GenerateResponse({
    files: files,
  });
}

// Read input from stdin
function readInput(): GenerateRequest {
  const buffer = readFileSync(STDIO.Stdin);
  return GenerateRequest.fromBinary(buffer);
}

function queryDecl(name: string, sql: string) {
  return factory.createVariableStatement(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(name),
          undefined,
          undefined,
          factory.createNoSubstitutionTemplateLiteral(sql, sql)
        ),
      ],
      NodeFlags.Const //| NodeFlags.Constant | NodeFlags.Constant
    )
  );
}

function argsDecl(
  name: string,
  driver: Driver,
  params: Parameter[]
) {
  return factory.createInterfaceDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(name),
    undefined,
    undefined,
    params.map((param, i) =>
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier(argName(i, param.column)),
        undefined,
        driver.columnType(param.column)
      )
    )
  );
}

function rowDecl(
  name: string,
  driver: Driver,
  columns: Column[]
) {
  return factory.createInterfaceDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(name),
    undefined,
    undefined,
    columns.map((column, i) =>
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier(colName(i, column)),
        undefined,
        driver.columnType(column)
      )
    )
  );
}

function printNode(nodes: Node[]): string {
  // https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#creating-and-printing-a-typescript-ast
  const resultFile = createSourceFile(
    "file.ts",
    "",
    ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ScriptKind.TS
  );
  const printer = createPrinter({ newLine: NewLineKind.LineFeed });
  let output = "// Code generated by sqlc. DO NOT EDIT.\n\n";
  for (let node of nodes) {
    output += printer.printNode(EmitHint.Unspecified, node, resultFile);
    output += "\n\n";
  }
  return output;
}

// Write output to stdout
function writeOutput(output: GenerateResponse) {
  const encodedOutput = output.toBinary();
  const buffer = new Uint8Array(encodedOutput);
  writeFileSync(STDIO.Stdout, buffer);
}
