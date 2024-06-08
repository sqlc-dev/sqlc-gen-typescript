import {
  SyntaxKind,
  NodeFlags,
  Node,
  TypeNode,
  factory,
  FunctionDeclaration,
} from "typescript";

import { Parameter, Column, Query } from "../gen/plugin/codegen_pb";
import { argName } from "./utlis";

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("client"),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier("Client"),
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
  /**
   * {@link https://github.com/WiseLibs/better-sqlite3/blob/v9.4.1/docs/api.md#binding-parameters}
   * {@link https://github.com/sqlc-dev/sqlc/blob/v1.25.0/internal/codegen/golang/sqlite_type.go}
   */
  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    switch (column.type.name) {
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
      case "blob": {
        // TODO: Is this correct or node-specific?
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
      case "boolean":
      case "bool": {
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      }
      case "date":
      case "datetime":
      case "timestamp": {
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Date"),
          undefined
        );
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
              factory.createIdentifier("Client")
            ),
          ])
        ),
        factory.createStringLiteral("@libsql/client"),
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
          factory.createExpressionStatement(
            factory.createAwaitExpression(
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("client"),
                  factory.createIdentifier("execute")
                ),
                undefined,
                [
                  factory.createObjectLiteralExpression(
                    [
                      factory.createPropertyAssignment(
                        factory.createIdentifier("sql"),
                        factory.createIdentifier(queryName)
                      ),
                      factory.createPropertyAssignment(
                        factory.createIdentifier("args"),
                        factory.createArrayLiteralExpression(
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
                ]
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
                  factory.createIdentifier("result"),
                  undefined,
                  undefined,
                  factory.createAwaitExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("client"),
                        factory.createIdentifier("execute")
                      ),
                      undefined,
                      [
                        factory.createObjectLiteralExpression(
                          [
                            factory.createPropertyAssignment(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier(queryName)
                            ),
                            factory.createPropertyAssignment(
                              factory.createIdentifier("args"),
                              factory.createArrayLiteralExpression(
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
                      ]
                    )
                  )
                ),
              ],
              NodeFlags.Const |
              // ts.NodeFlags.Constant |
              NodeFlags.AwaitContext |
              // ts.NodeFlags.Constant |
              NodeFlags.ContextFlags |
              NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createIfStatement(
            factory.createBinaryExpression(
              factory.createIdentifier("result"),
              factory.createToken(SyntaxKind.EqualsEqualsToken),
              factory.createIdentifier("undefined")
            ),
            factory.createBlock(
              [factory.createReturnStatement(factory.createNull())],
              true
            ),
            undefined
          ),
          factory.createReturnStatement(
            factory.createConditionalExpression(
              factory.createPropertyAccessExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("result"),
                  factory.createIdentifier("rows")
                ),
                factory.createIdentifier("length")
              ),
              factory.createToken(SyntaxKind.QuestionToken),
              factory.createAsExpression(
                factory.createAsExpression(
                  factory.createElementAccessExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("result"),
                      factory.createIdentifier("rows")
                    ),
                    factory.createNumericLiteral("0")
                  ),
                  factory.createTypeReferenceNode(
                    factory.createIdentifier("unknown"),
                    undefined
                    )
                    ),
                    factory.createTypeReferenceNode(
                  factory.createIdentifier(returnIface),
                  undefined
                )
              ),
              factory.createToken(SyntaxKind.ColonToken),
              factory.createNull()
            ),
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
                  factory.createIdentifier("result"),
                  undefined,
                  undefined,
                  factory.createAwaitExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("client"),
                        factory.createIdentifier("execute")
                      ),
                      undefined,
                      [
                        factory.createObjectLiteralExpression(
                          [
                            factory.createPropertyAssignment(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier(queryName)
                            ),
                            factory.createPropertyAssignment(
                              factory.createIdentifier("args"),
                              factory.createArrayLiteralExpression(
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
                      ]
                    )
                  )
                ),
              ],
              NodeFlags.Const |
              // NodeFlags.Constant |
              NodeFlags.AwaitContext |
              // NodeFlags.Constant |
              NodeFlags.ContextFlags |
              NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createReturnStatement(
            factory.createAsExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("result"),
                factory.createIdentifier("rows")
              ),
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode(
                  factory.createIdentifier(returnIface),
                  undefined
                )
              )
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
      "better-sqlite3 driver currently does not support :execlastid"
    );
  }
}
