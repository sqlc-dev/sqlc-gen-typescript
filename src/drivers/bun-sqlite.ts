import {
  SyntaxKind,
  NodeFlags,
  Node,
  TypeNode,
  factory,
  FunctionDeclaration,
} from "typescript";

import { Parameter, Column, Query } from "../gen/plugin/codegen_pb";
import { argName, colName } from "./utlis";

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("database"),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier("Database"),
        undefined
      ),
      undefined
    ),
  ];

  if (iface && params.length > 0) {
    funcParams.push(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("args"),
        undefined,
        factory.createTypeReferenceNode(
          factory.createIdentifier(iface),
          undefined
        ),
        undefined
      )
    );
  }

  return funcParams;
}

export class Driver {
  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    switch (column.type.name.toLowerCase()) {
      case "int":
      case "integer":
      case "tinyint":
      case "smallint":
      case "mediumint":
      case "bigint":
      case "unsignedbigint":
      case "int2":
      case "int8": {
        // TODO: Improve `BigInt` handling (https://github.com/WiseLibs/better-sqlite3/blob/v9.4.1/docs/integer.md)
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "varchar":
      case "text": {
        typ = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
        break;
      }
      case "blob": {
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Buffer"),
          undefined
        );
        break;
      }
      case "real":
      case "double":
      case "doubleprecision":
      case "float": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "date":
      case "datetime": {
        typ = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
        break;
      }
      case "boolean":
      case "bool":
      case "timestamp": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
    }

    if (column.notNull) {
      return typ;
    }

    return factory.createUnionTypeNode([
      typ,
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
  }

  preamble(queries: Query[]) {
    const imports: Node[] = [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier("Database")
            ),
          ])
        ),
        factory.createStringLiteral("bun:sqlite"),
        undefined
      ),
    ];

    return imports;
  }

  execDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("stmt"),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("database"),
                      factory.createIdentifier("prepare")
                    ),
                    undefined,
                    [factory.createIdentifier(queryName)]
                  )
                ),
              ],
              NodeFlags.Const | NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("stmt"),
                factory.createIdentifier("run")
              ),
              undefined,
              params.map((param, i) =>
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("args"),
                  factory.createIdentifier(argName(i, param.column))
                )
              )
            )
          ),
        ],
        true
      )
    );
  }

  oneDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createUnionTypeNode([
          factory.createTypeReferenceNode(
            factory.createIdentifier(returnIface),
            undefined
          ),
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("stmt"),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("database"),
                      factory.createIdentifier("prepare")
                    ),
                    undefined,
                    [factory.createIdentifier(queryName)]
                  )
                ),
              ],
              NodeFlags.Const | NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("rows"),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("stmt"),
                      factory.createIdentifier("values")
                    ),
                    undefined,
                    params.map((param, i) =>
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("args"),
                        factory.createIdentifier(argName(i, param.column))
                      )
                    )
                  )
                ),
              ],
              NodeFlags.Const |
                NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createIfStatement(
            factory.createBinaryExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("rows"),
                factory.createIdentifier("length")
              ),
              factory.createToken(SyntaxKind.ExclamationEqualsEqualsToken),
              factory.createNumericLiteral("1")
            ),
            factory.createBlock(
              [factory.createReturnStatement(factory.createNull())],
              true
            ),
            undefined
          ),
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  "row",
                  undefined,
                  undefined,
                  factory.createElementAccessExpression(
                    factory.createIdentifier("rows"),
                    factory.createNumericLiteral("0")
                  )
                ),
              ],
              NodeFlags.Const
            )
          ),
          factory.createIfStatement(
            factory.createPrefixUnaryExpression(
              SyntaxKind.ExclamationToken,
              factory.createIdentifier("row")
            ),
            factory.createBlock(
              [factory.createReturnStatement(factory.createNull())],
              true
            ),
            undefined
          ),
          factory.createReturnStatement(
            factory.createObjectLiteralExpression(
              columns.map((col, i) =>
                factory.createPropertyAssignment(
                  factory.createIdentifier(colName(i, col)),
                  factory.createAsExpression(
                    factory.createElementAccessExpression(
                      factory.createIdentifier("row"),
                      factory.createNumericLiteral(`${i}`)
                    ),
                    this.columnType(col)
                  )
                )
              ),
              true
            )
          ),
        ],
        true
      )
    );
  }

  manyDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createArrayTypeNode(
          factory.createTypeReferenceNode(
            factory.createIdentifier(returnIface),
            undefined
          )
        ),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("stmt"),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("database"),
                      factory.createIdentifier("prepare")
                    ),
                    undefined,
                    [factory.createIdentifier(queryName)]
                  )
                ),
              ],
              NodeFlags.Const | NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("rows"),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("stmt"),
                      factory.createIdentifier("values")
                    ),
                    undefined,
                    params.map((param, i) =>
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("args"),
                        factory.createIdentifier(argName(i, param.column))
                      )
                    )
                  )
                ),
              ],
              NodeFlags.Const |
                NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createReturnStatement(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("rows"),
                factory.createIdentifier("map")
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
                      "row"
                    ),
                  ],
                  undefined,
                  factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                  factory.createObjectLiteralExpression(
                    columns.map((col, i) =>
                      factory.createPropertyAssignment(
                        factory.createIdentifier(colName(i, col)),
                        factory.createAsExpression(
                          factory.createElementAccessExpression(
                            factory.createIdentifier("row"),
                            factory.createNumericLiteral(`${i}`)
                          ),
                          this.columnType(col)
                        )
                      )
                    ),
                    true
                  )
                ),
              ]
            )
          ),
        ],
        true
      )
    );
  }

  execlastidDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ): FunctionDeclaration {
    throw new Error(
      "Bun sqlite driver currently does not support :execlastid"
    );
  }
}
