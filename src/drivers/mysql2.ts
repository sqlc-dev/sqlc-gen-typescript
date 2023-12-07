import { SyntaxKind, NodeFlags, TypeNode, factory } from "typescript";

// import { writeFileSync, STDIO } from "javy/fs";

import { Parameter, Column } from "../gen/plugin/codegen_pb";
import { argName, colName } from "./utlis";

export function columnType(column?: Column): TypeNode {
  if (column === undefined || column.type === undefined) {
    return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
  }
  let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);

  switch (column.type.name) {
    case "bigint": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "binary": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "bit": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "blob": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "char": {
      // string
      break;
    }
    case "date": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Date"),
        undefined
      );
      break;
    }
    case "datetime": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Date"),
        undefined
      );
      break;
    }
    case "decimal": {
      // string
      break;
    }
    case "double": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "float": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "int": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "longblob": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "longtext": {
      // string
      break;
    }
    case "mediumblob": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "mediumint": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "mediumtext": {
      // string
      break;
    }
    case "smallint": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "text": {
      // string
      break;
    }
    case "time": {
      // string
      break;
    }
    case "timestamp": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Date"),
        undefined
      );
      break;
    }
    case "tinyblob": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "tinyint": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    case "tinytext": {
      // string
      break;
    }
    case "json": {
      typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
      break;
    }
    case "varbinary": {
      typ = factory.createTypeReferenceNode(
        factory.createIdentifier("Buffer"),
        undefined
      );
      break;
    }
    case "varchar": {
      // string
      break;
    }
    case "year": {
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    }
    // default: {
    //   const output = new TextEncoder().encode(column.type.name + "\n");
    //   const buffer = new Uint8Array(output);
    //   writeFileSync(STDIO.Stderr, buffer);
    // }
  }
  if (column.notNull) {
    return typ;
  }
  return factory.createUnionTypeNode([
    typ,
    factory.createLiteralTypeNode(factory.createNull()),
  ]);
}

export function preamble(queries: unknown) {
  return [
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        factory.createIdentifier("mysql"),
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier("RowDataPacket")
          ),
        ])
      ),
      factory.createStringLiteral("mysql2/promise"),
      undefined
    ),
    factory.createTypeAliasDeclaration(
      undefined,
      factory.createIdentifier("Client"),
      undefined,
      factory.createUnionTypeNode([
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            factory.createIdentifier("mysql"),
            factory.createIdentifier("Connection")
          ),
          undefined
        ),
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            factory.createIdentifier("mysql"),
            factory.createIdentifier("Pool")
          ),
          undefined
        ),
      ])
    ),
  ];
}

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

export function execDecl(
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
                factory.createIdentifier("query")
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
                      factory.createIdentifier("values"),
                      factory.createArrayLiteralExpression(
                        params.map((param, i) =>
                          factory.createPropertyAccessExpression(
                            factory.createIdentifier("args"),
                            factory.createIdentifier(argName(i, param.column))
                          )
                        ),
                        false
                      )
                    ),
                  ],
                  true
                ),
              ]
            )
          )
        ),
      ],
      true
    )
  );
}

export function manyDecl(
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
                factory.createArrayBindingPattern([
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier("rows"),
                    undefined
                  ),
                ]),
                undefined,
                undefined,
                factory.createAwaitExpression(
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("client"),
                      factory.createIdentifier("query")
                    ),
                    [
                      factory.createArrayTypeNode(
                        factory.createTypeReferenceNode(
                          factory.createIdentifier("RowDataPacket"),
                          undefined
                        )
                      ),
                    ],
                    [
                      factory.createObjectLiteralExpression(
                        [
                          factory.createPropertyAssignment(
                            factory.createIdentifier("sql"),
                            factory.createIdentifier(queryName)
                          ),
                          factory.createPropertyAssignment(
                            factory.createIdentifier("values"),
                            factory.createArrayLiteralExpression(
                              params.map((param, i) =>
                                factory.createPropertyAccessExpression(
                                  factory.createIdentifier("args"),
                                  factory.createIdentifier(
                                    argName(i, param.column)
                                  )
                                )
                              ),
                              false
                            )
                          ),
                          factory.createPropertyAssignment(
                            factory.createIdentifier("rowsAsArray"),
                            factory.createTrue()
                          ),
                        ],
                        true
                      ),
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
                    factory.createIdentifier("row"),
                    undefined,
                    undefined,
                    undefined
                  ),
                ],
                undefined,
                factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                factory.createBlock(
                  [
                    factory.createReturnStatement(
                      factory.createObjectLiteralExpression(
                        columns.map((col, i) =>
                          factory.createPropertyAssignment(
                            factory.createIdentifier(colName(i, col)),
                            factory.createElementAccessExpression(
                              factory.createIdentifier("row"),
                              factory.createNumericLiteral(`${i}`)
                            )
                          )
                        ),
                        true
                      )
                    ),
                  ],
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

export function oneDecl(
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
                factory.createArrayBindingPattern([
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier("rows"),
                    undefined
                  ),
                ]),
                undefined,
                undefined,
                factory.createAwaitExpression(
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("client"),
                      factory.createIdentifier("query")
                    ),
                    [
                      factory.createArrayTypeNode(
                        factory.createTypeReferenceNode(
                          factory.createIdentifier("RowDataPacket"),
                          undefined
                        )
                      ),
                    ],
                    [
                      factory.createObjectLiteralExpression(
                        [
                          factory.createPropertyAssignment(
                            factory.createIdentifier("sql"),
                            factory.createIdentifier(queryName)
                          ),
                          factory.createPropertyAssignment(
                            factory.createIdentifier("values"),
                            factory.createArrayLiteralExpression(
                              params.map((param, i) =>
                                factory.createPropertyAccessExpression(
                                  factory.createIdentifier("args"),
                                  factory.createIdentifier(
                                    argName(i, param.column)
                                  )
                                )
                              ),
                              false
                            )
                          ),
                          factory.createPropertyAssignment(
                            factory.createIdentifier("rowsAsArray"),
                            factory.createTrue()
                          ),
                        ],
                        true
                      ),
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
                factory.createIdentifier("row"),
                undefined,
                undefined,
                factory.createElementAccessExpression(
                  factory.createIdentifier("rows"),
                  factory.createNumericLiteral("0")
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
          factory.createObjectLiteralExpression(
            columns.map((col, i) =>
              factory.createPropertyAssignment(
                factory.createIdentifier(colName(i, col)),
                factory.createElementAccessExpression(
                  factory.createIdentifier("row"),
                  factory.createNumericLiteral(`${i}`)
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

export default {
  columnType,
  preamble,
  execDecl,
  manyDecl,
  oneDecl,
};
