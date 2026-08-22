import { Expression, PropertyName, factory } from "typescript";

import { Column } from "../gen/plugin/codegen_pb";

// https://stackoverflow.com/questions/40710628/how-to-convert-snake-case-to-camelcase
export function fieldName(
  prefix: string,
  index: number,
  column?: Column
): string {
  let name = `${prefix}_${index + 1}`;
  if (column && column.name) {
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

const validIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Property name for an interface or object literal: a plain identifier when
// possible, otherwise a quoted string ("invalid-name": ...)
export function propertyKey(name: string): PropertyName {
  if (validIdentifier.test(name)) {
    return factory.createIdentifier(name);
  }
  return factory.createStringLiteral(name);
}

// target.name when name is a valid identifier, otherwise target["name"]
export function propertyAccess(target: string, name: string): Expression {
  if (validIdentifier.test(name)) {
    return factory.createPropertyAccessExpression(
      factory.createIdentifier(target),
      factory.createIdentifier(name)
    );
  }
  return factory.createElementAccessExpression(
    factory.createIdentifier(target),
    factory.createStringLiteral(name)
  );
}
