import {
  Expression,
  FunctionDeclaration,
  Node,
  NodeFlags,
  Statement,
  SyntaxKind,
  TypeNode,
  factory,
} from "typescript";

import { Column, Parameter, Query } from "../gen/plugin/codegen_pb";
import { argName, colName } from "./utlis";

function typeRef(name: string) {
  return factory.createTypeReferenceNode(name, undefined);
}

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  const declarations = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      "database",
      undefined,
      typeRef("Database"),
      undefined
    ),
  ];

  if (iface && params.length > 0) {
    declarations.push(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "args",
        undefined,
        typeRef(iface),
        undefined
      )
    );
  }

  return declarations;
}

function stmtCall(method: string, params: Parameter[], rowType?: TypeNode) {
  return factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createIdentifier("stmt"),
      method
    ),
    rowType ? [rowType] : undefined,
    params.map((param, i) =>
      factory.createPropertyAccessExpression(
        factory.createIdentifier("args"),
        argName(i, param.column)
      )
    )
  );
}

function constDecl(name: string, value: Expression) {
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [factory.createVariableDeclaration(name, undefined, undefined, value)],
      NodeFlags.Const
    )
  );
}

function queryDecl(
  funcName: string,
  queryName: string,
  argIface: string | undefined,
  params: Parameter[],
  returnType: TypeNode,
  body: Statement[]
): FunctionDeclaration {
  return factory.createFunctionDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    undefined,
    funcName,
    undefined,
    funcParamsDecl(argIface, params),
    returnType,
    factory.createBlock(
      [
        constDecl(
          "stmt",
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("database"),
              "prepare"
            ),
            undefined,
            [factory.createIdentifier(queryName)]
          )
        ),
        factory.createTryStatement(
          factory.createBlock(body, true),
          undefined,
          factory.createBlock(
            [factory.createExpressionStatement(stmtCall("finalize", []))],
            true
          )
        ),
      ],
      true
    )
  );
}

// Read columns by position so SQL names and duplicate result names do not
// change the generated camelCase fields.
function rowObject(columns: Column[]) {
  return factory.createObjectLiteralExpression(
    columns.map((column, i) =>
      factory.createPropertyAssignment(
        colName(i, column),
        factory.createElementAccessExpression(
          factory.createIdentifier("row"),
          i
        )
      )
    ),
    true
  );
}

export class Driver {
  /** {@link https://jsr.io/@db/sqlite/doc/~/Database} */
  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    const name = column.type.name
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, "");
    switch (name) {
      case "int":
      case "integer":
      case "tinyint":
      case "smallint":
      case "mediumint":
      case "bigint":
      case "unsignedbigint":
      case "int2":
      case "int8":
      case "numeric":
      case "decimal": {
        // With int64 enabled, @db/sqlite returns bigint for integers outside
        // JavaScript's safe range and number for the rest. NUMERIC and DECIMAL
        // can also store integer values without converting them to floats.
        typ = factory.createUnionTypeNode([
          factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
          factory.createKeywordTypeNode(SyntaxKind.BigIntKeyword),
        ]);
        break;
      }
      case "blob": {
        typ = typeRef("Uint8Array");
        break;
      }
      case "text":
      case "char":
      case "character":
      case "clob":
      case "varchar":
      case "varyingcharacter":
      case "nchar":
      case "nativecharacter":
      case "nvarchar":
      case "date":
      case "datetime":
      case "timestamp": {
        typ = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
        break;
      }
      case "real":
      case "double":
      case "doubleprecision":
      case "float":
      case "boolean":
      case "bool": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
    }

    return column.notNull
      ? typ
      : factory.createUnionTypeNode([
          typ,
          factory.createLiteralTypeNode(factory.createNull()),
        ]);
  }

  preamble(queries: Query[]): Node[] {
    return [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          true,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier("Database")
            ),
          ])
        ),
        factory.createStringLiteral("jsr:@db/sqlite"),
        undefined
      ),
    ];
  }

  execDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ): FunctionDeclaration {
    return queryDecl(
      funcName,
      queryName,
      argIface,
      params,
      factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      [factory.createExpressionStatement(stmtCall("run", params))]
    );
  }

  oneDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ): FunctionDeclaration {
    const rowType = factory.createTupleTypeNode(
      columns.map((column) => this.columnType(column))
    );
    return queryDecl(
      funcName,
      queryName,
      argIface,
      params,
      factory.createUnionTypeNode([
        typeRef(returnIface),
        factory.createLiteralTypeNode(factory.createNull()),
      ]),
      [
        constDecl("row", stmtCall("value", params, rowType)),
        factory.createIfStatement(
          factory.createBinaryExpression(
            factory.createIdentifier("row"),
            SyntaxKind.EqualsEqualsEqualsToken,
            factory.createIdentifier("undefined")
          ),
          factory.createBlock(
            [factory.createReturnStatement(factory.createNull())],
            true
          )
        ),
        factory.createReturnStatement(rowObject(columns)),
      ]
    );
  }

  manyDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ): FunctionDeclaration {
    const rowType = factory.createTupleTypeNode(
      columns.map((column) => this.columnType(column))
    );
    return queryDecl(
      funcName,
      queryName,
      argIface,
      params,
      factory.createArrayTypeNode(typeRef(returnIface)),
      [
        constDecl("rows", stmtCall("values", params, rowType)),
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("rows"),
              "map"
            ),
            undefined,
            [
              factory.createArrowFunction(
                undefined,
                undefined,
                [
                  factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    "row",
                    undefined,
                    undefined,
                    undefined
                  ),
                ],
                undefined,
                factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                rowObject(columns)
              ),
            ]
          )
        ),
      ]
    );
  }

  execlastidDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ): FunctionDeclaration {
    return queryDecl(
      funcName,
      queryName,
      argIface,
      params,
      factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
      [
        factory.createExpressionStatement(stmtCall("run", params)),
        factory.createReturnStatement(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("database"),
            "lastInsertRowId"
          )
        ),
      ]
    );
  }
}
