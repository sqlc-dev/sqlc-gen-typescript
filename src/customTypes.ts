import { NodeFlags, SyntaxKind, TypeNode, Node, factory } from "typescript";

import { Column, GenerateRequest, Query } from "./gen/plugin/codegen_pb";

// A function that maps a column to a custom TypeScript type, or undefined to
// fall back to the driver's built-in type mapping.
export type CustomTypeFn = (column: Column) => TypeNode | undefined;

export interface TypeImport {
  // Module specifier to import from, e.g. "./brands" or "zod"
  path: string;
  // Named export to import. Imports are always emitted as type-only.
  name: string;
}

export interface TypeOverride {
  // Match a SQL type by name, e.g. "uuid", "email" (a domain), or
  // "pg_catalog.numeric". Either db_type or column must be set.
  db_type?: string;
  // Match a single column as "table.column", e.g. "authors.bio"
  column?: string;
  // TypeScript type expression to emit, e.g. "UserId" or
  // `string & { readonly __brand: "email" }`
  ts_type: string;
  // Optional type-only import to add to files that use this override
  import?: TypeImport;
}

interface EnumEntry {
  typeName: string;
  valuesName: string;
  vals: string[];
}

function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function stripCatalog(name: string): string {
  const pgCatalog = "pg_catalog.";
  return name.startsWith(pgCatalog) ? name.slice(pgCatalog.length) : name;
}

// Prints an arbitrary type expression verbatim, e.g. `Branded<string, "id">`
function verbatimType(text: string): TypeNode {
  return factory.createTypeReferenceNode(
    factory.createIdentifier(text),
    undefined
  );
}

// Resolves custom column types from two sources, in priority order:
//
//  1. User-configured overrides (by column, then by SQL type name), which
//     cover domains, branded/nominal types, and JSON payload types
//  2. Enum types declared in the schema, emitted as string literal unions
export class CustomTypeRegistry {
  private enums: Map<string, EnumEntry> = new Map();
  private byColumn: Map<string, TypeOverride> = new Map();
  private byDbType: Map<string, TypeOverride> = new Map();

  constructor(input: GenerateRequest, overrides: TypeOverride[]) {
    const defaultSchema = input.catalog?.defaultSchema ?? "";
    for (const schema of input.catalog?.schemas ?? []) {
      for (const enumType of schema.enums) {
        const entry: EnumEntry = {
          typeName: pascalCase(enumType.name),
          valuesName: `${pascalCase(enumType.name)}Values`,
          vals: enumType.vals,
        };
        if (schema.name === defaultSchema || schema.name === "") {
          this.enums.set(enumType.name, entry);
        }
        if (schema.name !== "") {
          this.enums.set(`${schema.name}.${enumType.name}`, entry);
        }
      }
    }
    for (const override of overrides) {
      if (!override.ts_type) {
        throw new Error(`override is missing ts_type`);
      }
      if (override.column) {
        this.byColumn.set(override.column, override);
      } else if (override.db_type) {
        this.byDbType.set(override.db_type, override);
      } else {
        throw new Error(
          `override for ts_type "${override.ts_type}" must set db_type or column`
        );
      }
    }
  }

  resolver(): CustomTypeFn {
    return (column) => {
      const override = this.overrideFor(column);
      if (override) {
        return verbatimType(override.ts_type);
      }
      const enumEntry = this.enumFor(column);
      if (enumEntry) {
        return factory.createTypeReferenceNode(
          factory.createIdentifier(enumEntry.typeName),
          undefined
        );
      }
      return undefined;
    };
  }

  private overrideFor(column: Column): TypeOverride | undefined {
    if (column.table?.name) {
      const byColumn = this.byColumn.get(
        `${column.table.name}.${column.name}`
      );
      if (byColumn) {
        return byColumn;
      }
    }
    if (column.type?.name) {
      return (
        this.byDbType.get(column.type.name) ??
        this.byDbType.get(stripCatalog(column.type.name))
      );
    }
    return undefined;
  }

  private enumFor(column: Column): EnumEntry | undefined {
    if (!column.type?.name) {
      return undefined;
    }
    return this.enums.get(stripCatalog(column.type.name));
  }

  // Declarations needed at the top of a generated file: type-only imports for
  // overrides and literal union declarations for enums, limited to the types
  // actually used by the file's queries.
  fileDecls(queries: Query[]): Node[] {
    const usedEnums: Map<string, EnumEntry> = new Map();
    const usedImports: Map<string, Set<string>> = new Map();

    const visit = (column?: Column) => {
      if (!column) {
        return;
      }
      const override = this.overrideFor(column);
      if (override?.import) {
        if (!usedImports.has(override.import.path)) {
          usedImports.set(override.import.path, new Set());
        }
        usedImports.get(override.import.path)?.add(override.import.name);
        return;
      }
      if (override) {
        return;
      }
      const enumEntry = this.enumFor(column);
      if (enumEntry) {
        usedEnums.set(enumEntry.typeName, enumEntry);
      }
    };

    for (const query of queries) {
      query.columns.forEach(visit);
      query.params.forEach((param) => visit(param.column));
    }

    const nodes: Node[] = [];
    for (const path of [...usedImports.keys()].sort()) {
      const names = [...(usedImports.get(path) ?? [])].sort();
      nodes.push(
        factory.createImportDeclaration(
          undefined,
          factory.createImportClause(
            true,
            undefined,
            factory.createNamedImports(
              names.map((name) =>
                factory.createImportSpecifier(
                  false,
                  undefined,
                  factory.createIdentifier(name)
                )
              )
            )
          ),
          factory.createStringLiteral(path),
          undefined
        )
      );
    }
    for (const typeName of [...usedEnums.keys()].sort()) {
      const entry = usedEnums.get(typeName);
      if (entry) {
        nodes.push(...enumDecls(entry));
      }
    }
    return nodes;
  }
}

// export type Status = "active" | "inactive";
// export const StatusValues: readonly Status[] = ["active", "inactive"];
function enumDecls(entry: EnumEntry): Node[] {
  return [
    factory.createTypeAliasDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      factory.createIdentifier(entry.typeName),
      undefined,
      factory.createUnionTypeNode(
        entry.vals.map((val) =>
          factory.createLiteralTypeNode(factory.createStringLiteral(val))
        )
      )
    ),
    factory.createVariableStatement(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(entry.valuesName),
            undefined,
            factory.createTypeOperatorNode(
              SyntaxKind.ReadonlyKeyword,
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode(
                  factory.createIdentifier(entry.typeName),
                  undefined
                )
              )
            ),
            factory.createArrayLiteralExpression(
              entry.vals.map((val) => factory.createStringLiteral(val)),
              false
            )
          ),
        ],
        NodeFlags.Const
      )
    ),
  ];
}
