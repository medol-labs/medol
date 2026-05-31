export type DslLocationKind = 'domain' | 'context' | 'aggregate' | 'slice';

export interface DslLocationTarget {
  kind: DslLocationKind;
  name: string;
}

export const findDslLine = (dsl: string, target?: DslLocationTarget): number | undefined => {
  if (!target) return undefined;

  const escapedName = escapeRegExp(target.name);
  const pattern = new RegExp(`^\\s*${target.kind}\\s+${escapedName}\\b`);
  const lines = dsl.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));

  return index >= 0 ? index + 1 : undefined;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
