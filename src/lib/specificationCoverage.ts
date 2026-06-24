export interface SpecificationCoverageMetadata {
  expressions: string[];
  metadata: Record<string, string>;
}

export const coveredSpecificationExpressions = ({
  expressions,
  metadata
}: SpecificationCoverageMetadata): string[] =>
  expressions.filter((expression) => expressionIsViolated(expression, metadata));

const expressionIsViolated = (
  expression: string,
  metadata: Record<string, string>
): boolean => {
  const unique = parseUniqueFields(expression);
  if (unique) return uniqueIsViolated(unique, metadata);

  const assertion = /^assert\s+(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/.exec(expression);
  if (!assertion) return false;
  const left = resolveOperand(assertion[1], metadata);
  const right = resolveOperand(assertion[3], metadata);
  return left.resolved && right.resolved
    ? !compare(left.value, right.value, assertion[2])
    : false;
};

const uniqueIsViolated = (
  fields: string[],
  metadata: Record<string, string>
): boolean => {
  const submitted = fields.map((field) => metadata[`example:${field}`]);
  if (submitted.some((value) => value === undefined)) return false;
  const givenIndexes = Object.keys(metadata)
    .map((key) => /^given(\d+)$/.exec(key)?.[1])
    .filter((index): index is string => Boolean(index));
  return givenIndexes.some((index) =>
    fields.every((field, fieldIndex) => {
      const existing = metadata[`givenExample:${index}:${field}`];
      return existing !== undefined
        && valuesEqual(parseLiteral(existing), parseLiteral(submitted[fieldIndex]!));
    })
  );
};

const parseUniqueFields = (expression: string): string[] | undefined => {
  const single = /^unique\s+[A-Za-z_][\w]*\.([A-Za-z_][\w]*)$/.exec(expression);
  if (single) return [single[1]];

  const composite = /^unique\s+\((.+)\)$/.exec(expression);
  if (!composite) return undefined;
  const fields = composite[1].split(',').map((target) => {
    const match = /^\s*[A-Za-z_][\w]*\.([A-Za-z_][\w]*)\s*$/.exec(target);
    return match?.[1];
  });
  return fields.length >= 2 && fields.every((field): field is string => Boolean(field))
    ? fields
    : undefined;
};

const resolveOperand = (
  operand: string,
  metadata: Record<string, string>
): { resolved: boolean; value?: unknown } => {
  const trimmed = operand.trim();
  const field = /^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)$/.exec(trimmed);
  if (field) {
    const [, owner, fieldName] = field;
    const value = metadata.when === owner
      ? metadata[`example:${fieldName}`]
      : givenValue(owner, fieldName, metadata) ?? metadata[`example:${fieldName}`];
    return value === undefined
      ? { resolved: false }
      : { resolved: true, value: parseLiteral(value) };
  }
  return { resolved: true, value: parseLiteral(trimmed) };
};

const givenValue = (
  owner: string,
  field: string,
  metadata: Record<string, string>
): string | undefined => {
  for (const [key, value] of Object.entries(metadata)) {
    const match = /^given(\d+)$/.exec(key);
    if (match && value === owner) return metadata[`givenExample:${match[1]}:${field}`];
  }
  return undefined;
};

const parseLiteral = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

const compare = (left: unknown, right: unknown, operator: string): boolean => {
  switch (operator) {
    case '>': return (left as number) > (right as number);
    case '<': return (left as number) < (right as number);
    case '>=': return (left as number) >= (right as number);
    case '<=': return (left as number) <= (right as number);
    case '==': return valuesEqual(left, right);
    case '!=': return !valuesEqual(left, right);
    default: return false;
  }
};

const valuesEqual = (left: unknown, right: unknown): boolean =>
  Object.is(left, right);
