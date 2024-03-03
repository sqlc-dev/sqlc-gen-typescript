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
              factory.createIdentifier("Database")
            ),
          ])
        ),
        factory.createStringLiteral("better-sqlite3"),
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
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                // NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                // NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createExpressionStatement(
            factory.createAwaitExpression(
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
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                // NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                // NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
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
                        factory.createIdentifier("stmt"),
                        factory.createIdentifier("get")
                      ),
                      undefined,
                      params.map((param, i) =>
                        factory.createPropertyAccessExpression(
                          factory.createIdentifier("args"),
                          factory.createIdentifier(argName(i, param.column))
                        )
                      )
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
            factory.createAsExpression(
              factory.createIdentifier("result"),
              factory.createTypeReferenceNode(
                factory.createIdentifier(returnIface),
                undefined
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
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                // NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                // NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
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
                        factory.createIdentifier("stmt"),
                        factory.createIdentifier("all")
                      ),
                      undefined,
                      params.map((param, i) =>
                        factory.createPropertyAccessExpression(
                          factory.createIdentifier("args"),
                          factory.createIdentifier(argName(i, param.column))
                        )
                      )
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
              factory.createIdentifier("result"),
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
