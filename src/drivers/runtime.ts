import {
  Node,
  SyntaxKind,
  addSyntheticLeadingComment,
  factory,
  forEachChild,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isStringLiteral,
  isTypeReferenceNode,
} from "typescript";

function usesBuffer(node: Node): boolean {
  return (
    (isTypeReferenceNode(node) &&
      isIdentifier(node.typeName) && node.typeName.text === "Buffer") ||
    !!forEachChild(node, (child) => usesBuffer(child) || undefined)
  );
}

/** Keep Node/Bun output stable while making imports resolvable in Deno. */
export function runtimeImports(nodes: Node[], runtime: string): Node[] {
  if (runtime !== "deno") return nodes;

  const result = nodes.map((node) => {
    if (!isImportDeclaration(node) || !isStringLiteral(node.moduleSpecifier)) {
      return node;
    }
    const name = node.moduleSpecifier.text;
    if (name.includes(":")) return node;

    const declaration = factory.updateImportDeclaration(
      node,
      node.modifiers,
      node.importClause && factory.updateImportClause(
        node.importClause,
        true,
        node.importClause.name && node.importClause.namedBindings
          ? undefined : node.importClause.name,
        node.importClause.name && node.importClause.namedBindings &&
          isNamedImports(node.importClause.namedBindings)
          ? factory.createNamedImports([
              factory.createImportSpecifier(
                false,
                factory.createIdentifier("default"),
                node.importClause.name
              ),
              ...node.importClause.namedBindings.elements,
            ])
          : node.importClause.namedBindings
      ),
      factory.createStringLiteral(`npm:${name}`),
      node.assertClause
    );
    // These packages publish their TypeScript declarations separately.
    if (name === "pg" || name === "better-sqlite3") {
      addSyntheticLeadingComment(
        declaration,
        SyntaxKind.SingleLineCommentTrivia,
        ` @deno-types="npm:@types/${name}"`,
        true
      );
    }
    return declaration;
  });

  if (nodes.some(usesBuffer)) {
    result.unshift(factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        true,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(false, undefined, factory.createIdentifier("Buffer")),
        ])
      ),
      factory.createStringLiteral("node:buffer"),
      undefined
    ));
  }
  return result;
}
