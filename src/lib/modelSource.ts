import type { EmSourceOrigin, MedolSourceRange } from './model';

export const isBuiltinDefinition = (item: { sources?: EmSourceOrigin[] }) =>
  Boolean(item.sources?.length && item.sources.every((source) => source.builtin));

export const hasBuiltinSource = (item: { sources?: EmSourceOrigin[] }) =>
  Boolean(item.sources?.some((source) => source.builtin));

export const canLocateInEditor = (range?: MedolSourceRange) =>
  !range?.sourceName || range.sourceName === '<memory>';
