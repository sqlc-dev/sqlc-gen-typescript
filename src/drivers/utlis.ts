import { factory, isUnionTypeNode, SyntaxKind, TypeNode } from "typescript";

import { Catalog, Column, Identifier } from "../gen/plugin/codegen_pb";

// https://stackoverflow.com/questions/40710628/how-to-convert-snake-case-to-camelcase
export function fieldName(
  prefix: string,
  index: number,
  column?: Column
): string {
  let name = `${prefix}_${index}`;
  if (column) {
    name = column.name;
  }
  return name
    .toLowerCase()
    .replace(/([_][a-z])/g, (group) => group.toUpperCase().replace("_", ""));
}

export function argName(index: number, column?: Column): string {
  return fieldName("arg", index, column);
}

export function colName(index: number, column?: Column): string {
  return fieldName("col", index, column);
}

// sqlc's own catalog names PostgreSQL types the way pg_type does ("int4",
// "timestamptz"), but its database analyzer names them the way format_type
// prints them ("integer", "timestamp(3) with time zone", "numeric(12,2)").
// The drivers' type tables use the pg_type names; map the others onto them.
const postgresTypeNames: { [name: string]: string } = {
  smallint: "int2",
  integer: "int4",
  int: "int4",
  bigint: "int8",
  real: "float4",
  "double precision": "float8",
  boolean: "bool",
  decimal: "numeric",
  character: "bpchar",
  "character varying": "varchar",
  "bit varying": "varbit",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamptz",
  "time without time zone": "time",
  "time with time zone": "timetz",
};

export function postgresTypeName(type?: Identifier): string {
  let name = type?.name ?? "";
  const pgCatalog = "pg_catalog.";
  if (name.startsWith(pgCatalog)) {
    name = name.slice(pgCatalog.length);
  }
  // Drop type modifiers: "character varying(255)", "timestamp(3) with time zone".
  name = name.replace(/\(\s*\d+(\s*,\s*\d+)?\s*\)/g, "").replace(/\s+/g, " ").trim();
  return postgresTypeNames[name] ?? name;
}

// Enum types declared in the schema, by "schema.name" and, for the default
// schema, by bare name: the analyzer names a type on the search path without
// its schema, and quotes a name that needs it.
export class Enums {
  private vals = new Map<string, string[]>();

  constructor(catalog?: Catalog) {
    const defaultSchema = catalog?.defaultSchema || "public";
    for (const schema of catalog?.schemas ?? []) {
      for (const e of schema.enums) {
        this.vals.set(`${schema.name}.${e.name}`, e.vals);
        if (schema.name === defaultSchema) {
          this.vals.set(e.name, e.vals);
        }
      }
    }
  }

  lookup(type?: Identifier): string[] | undefined {
    if (!type) {
      return undefined;
    }
    const name = (type.schema ? `${type.schema}.${type.name}` : type.name).replace(/"/g, "");
    return this.vals.get(name);
  }
}

export function enumType(vals: string[]): TypeNode {
  if (vals.length === 0) {
    return factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
  }
  return factory.createUnionTypeNode(
    vals.map((val) => factory.createLiteralTypeNode(factory.createStringLiteral(val)))
  );
}

// `T | null`, flattening a union so that it prints as `Date | string | null`
// rather than `(Date | string) | null`.
export function nullable(typ: TypeNode): TypeNode {
  const types = isUnionTypeNode(typ) ? [...typ.types] : [typ];
  return factory.createUnionTypeNode([
    ...types,
    factory.createLiteralTypeNode(factory.createNull()),
  ]);
}
