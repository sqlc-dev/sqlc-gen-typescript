import {
  SyntaxKind,
  NodeFlags,
  TypeNode,
  factory,
  FunctionDeclaration,
} from "typescript";

import { Parameter, Column } from "../gen/plugin/codegen_pb";
import { argName, colName } from "./utlis";
import { log } from "../logger";

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("sql"),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier("SQL"),
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
    // Some of the type names have the `pgcatalog.` prefix. Remove this.
    let typeName = column.type.name;
    const pgCatalog = "pg_catalog.";
    if (typeName.startsWith(pgCatalog)) {
      typeName = typeName.slice(pgCatalog.length);
    }
    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
    switch (typeName) {
      case "aclitem": {
        // string
        break;
      }
      case "bigserial": {
        // string
        break;
      }
      case "bit": {
        // string
        break;
      }
      case "bool": {
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      }
      case "box": {
        // string
        break;
      }
      case "bpchar": {
        // string
        break;
      }
      case "bytea": {
        // TODO: Is this correct or node-specific?
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Buffer"),
          undefined
        );
        break;
      }
      case "cid": {
        // string
        break;
      }
      case "cidr": {
        // string
        break;
      }
      case "circle": {
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
      case "float4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "float8": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "inet": {
        // string
        break;
      }
      case "int2": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "int4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "int8": {
        // string
        break;
      }
      case "interval": {
        // string
        break;
      }
      case "json": {
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      }
      case "jsonb": {
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      }
      case "line": {
        // string
        break;
      }
      case "lseg": {
        // string
        break;
      }
      case "madaddr": {
        // string
        break;
      }
      case "madaddr8": {
        // string
        break;
      }
      case "money": {
        // string
        break;
      }
      case "oid": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "path": {
        // string
        break;
      }
      case "pg_node_tree": {
        // string
        break;
      }
      case "pg_snapshot": {
        // string
        break;
      }
      case "point": {
        // string
        break;
      }
      case "polygon": {
        // string
        break;
      }
      case "regproc": {
        // string
        break;
      }
      case "regrole": {
        // string
        break;
      }
      case "serial": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial2": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial8": {
        // string
        break;
      }
      case "smallserial": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "tid": {
        // string
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
      case "timetz": {
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
      case "timestamptz": {
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Date"),
          undefined
        );
        break;
      }
      case "tsquery": {
        // string
        break;
      }
      case "tsvector": {
        // string
        break;
      }
      case "txid_snapshot": {
        // string
        break;
      }
      case "uuid": {
        // string
        break;
      }
      case "varbit": {
        // string
        break;
      }
      case "varchar": {
        // string
        break;
      }
      case "xid": {
        // string
        break;
      }
      case "xml": {
        // string
        break;
      }
      default: {
        log(`unknown type ${column.type?.name}`);
        break;
      }
    }
    if (column.isArray || column.arrayDims > 0) {
      let dims = Math.max(column.arrayDims || 1);
      for (let i = 0; i < dims; i++) {
        typ = factory.createArrayTypeNode(typ);
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

  preamble(_queries: unknown) {
    return [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier("SQL")
            ),
          ])
        ),
        factory.createStringLiteral("bun"),
        undefined
      ),
    ];
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
                  factory.createIdentifier("sql"),
                  factory.createIdentifier("unsafe")
                ),
                undefined,
                [
                  factory.createIdentifier(queryName),
                  factory.createArrayLiteralExpression(
                    params.map((param, i) =>
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("args"),
                        factory.createIdentifier(argName(i, param.column))
                      )
                    ),
                    false
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
          factory.createReturnStatement(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createAwaitExpression(
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                          factory.createIdentifier("sql"),
                          factory.createIdentifier("unsafe")
                        ),
                        undefined,
                        [
                          factory.createIdentifier(queryName),
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
                          ),
                        ]
                      ),
                      factory.createIdentifier("values")
                    ),
                    undefined,
                    undefined
                  )
                ),
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
                        factory.createElementAccessExpression(
                          factory.createIdentifier("row"),
                          factory.createNumericLiteral(`${i}`)
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
                  factory.createIdentifier("rows"),
                  undefined,
                  undefined,
                  factory.createAwaitExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createCallExpression(
                          factory.createPropertyAccessExpression(
                            factory.createIdentifier("sql"),
                            factory.createIdentifier("unsafe")
                          ),
                          undefined,
                          [
                            factory.createIdentifier(queryName),
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
                            ),
                          ]
                        ),
                        factory.createIdentifier("values")
                      ),
                      undefined,
                      undefined
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

  execlastidDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ): FunctionDeclaration {
    throw new Error("Bun sql driver currently does not support :execlastid");
  }
}
