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
  const unique = /^unique\s+([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)$/.exec(expression);
  if (unique) return uniqueIsViolated(unique[2], metadata);

  const assertion = /^assert\s+(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/.exec(expression);
  if (!assertion) return false;
  const left = resolveOperand(assertion[1], metadata);
  const right = resolveOperand(assertion[3], metadata);
  return left.resolved && right.resolved
    ? !compare(left.value, right.value, assertion[2])
    : false;
};

const uniqueIsViolated = (
  field: string,
  metadata: Record<string, string>
): boolean => {
  const submitted = metadata[`example:${field}`];
  if (submitted === undefined) return false;
  return Object.entries(metadata).some(([key, value]) =>
    /^givenExample:\d+:/.test(key)
    && key.endsWith(`:${field}`)
    && valuesEqual(parseLiteral(value), parseLiteral(submitted))
  );
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
