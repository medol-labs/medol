import type {
  EmAggregate,
  EmConcept,
  EmContext,
  EmDomain,
  EmElement,
  EmField,
  EmModel,
  EmSlice,
  EmValueType,
  MedolSourceRange
} from '../../lib/model';

export type ModelSearchKind =
  | 'domain'
  | 'context'
  | 'aggregate'
  | 'concept'
  | 'slice'
  | 'command'
  | 'event'
  | 'readmodel'
  | 'specification'
  | 'automation'
  | 'policy'
  | 'integration'
  | 'screen'
  | 'type'
  | 'field';

export interface ModelSearchItem {
  id: string;
  kind: ModelSearchKind;
  name: string;
  path: string[];
  acronym: string;
  sourceRange?: MedolSourceRange;
  domainId?: string;
  contextId?: string;
  aggregateId?: string;
  conceptId?: string;
  sliceId?: string;
  nodeId?: string;
}

export interface ParsedModelSearchQuery {
  kind?: ModelSearchKind;
  text: string;
}

const aliases: Record<string, ModelSearchKind> = {
  d: 'domain',
  domain: 'domain',
  ctx: 'context',
  context: 'context',
  agg: 'aggregate',
  aggregate: 'aggregate',
  concept: 'concept',
  s: 'slice',
  slice: 'slice',
  cmd: 'command',
  command: 'command',
  e: 'event',
  event: 'event',
  rm: 'readmodel',
  readmodel: 'readmodel',
  spec: 'specification',
  specification: 'specification',
  auto: 'automation',
  automation: 'automation',
  policy: 'policy',
  integration: 'integration',
  screen: 'screen',
  type: 'type',
  value: 'type',
  enum: 'type',
  field: 'field'
};

export const buildModelSearchIndex = (model: EmModel): ModelSearchItem[] => {
  const items: ModelSearchItem[] = [];
  const domainByContextId = new Map<string, EmDomain>();
  for (const domain of model.domains) {
    addItem(items, {
      id: domain.id,
      kind: 'domain',
      name: domain.name,
      path: [],
      sourceRange: domain.sourceRange,
      domainId: domain.id
    });
    for (const context of domain.contexts) domainByContextId.set(context.id, domain);
  }

  for (const context of model.contexts) {
    const domain = domainByContextId.get(context.id);
    const rootPath = domain ? [domain.name] : [];
    addContext(items, context, domain, rootPath);
  }
  return items;
};

const addContext = (
  items: ModelSearchItem[],
  context: EmContext,
  domain: EmDomain | undefined,
  rootPath: string[]
): void => {
  const contextTarget = {
    ...(domain ? { domainId: domain.id } : {}),
    contextId: context.id
  };
  addItem(items, {
    id: context.id,
    kind: 'context',
    name: context.name,
    path: rootPath,
    sourceRange: context.sourceRange,
    ...contextTarget
  });
  const contextPath = [...rootPath, context.name];

  for (const type of context.valueTypes) addValueType(items, type, contextPath, contextTarget);
  for (const aggregate of context.aggregates) addAggregate(items, aggregate, contextPath, contextTarget);
  for (const concept of context.concepts) addConcept(items, concept, contextPath, contextTarget);
  for (const slice of context.slices) {
    const concept = context.concepts.find((candidate) => candidate.sliceIds.includes(slice.id));
    addSlice(items, slice, contextPath, {
      ...contextTarget,
      ...(concept ? { conceptId: concept.id } : {})
    });
  }
  for (const element of context.looseElements) {
    addElement(items, element, contextPath, contextTarget);
  }
};

const addValueType = (
  items: ModelSearchItem[],
  type: EmValueType,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  addItem(items, {
    id: type.id,
    kind: 'type',
    name: type.name,
    path,
    sourceRange: type.sourceRange,
    ...target
  });
  for (const field of type.fields) addField(items, field, type.id, [...path, type.name], target);
};

const addAggregate = (
  items: ModelSearchItem[],
  aggregate: EmAggregate,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  addItem(items, {
    id: aggregate.id,
    kind: 'aggregate',
    name: aggregate.name,
    path,
    sourceRange: aggregate.sourceRange,
    aggregateId: aggregate.id,
    ...target
  });
  const aggregatePath = [...path, aggregate.name];
  for (const slice of aggregate.slices) {
    addSlice(items, slice, aggregatePath, {
      ...target,
      aggregateId: aggregate.id
    });
  }
};

const addConcept = (
  items: ModelSearchItem[],
  concept: EmConcept,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  addItem(items, {
    id: concept.id,
    kind: 'concept',
    name: concept.name,
    path,
    sourceRange: concept.sourceRange,
    conceptId: concept.id,
    ...target
  });
};

const addSlice = (
  items: ModelSearchItem[],
  slice: EmSlice,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  addItem(items, {
    id: slice.id,
    kind: 'slice',
    name: slice.name,
    path,
    sourceRange: slice.sourceRange,
    sliceId: slice.id,
    ...target
  });
  const sliceTarget = { ...target, sliceId: slice.id };
  const slicePath = [...path, slice.name];
  for (const element of slice.elements) addElement(items, element, slicePath, sliceTarget);
};

const addElement = (
  items: ModelSearchItem[],
  element: EmElement,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  const kind = elementKind(element);
  if (!kind) return;
  const displayName = kind === 'specification' && element.metadata?.specification
    ? `${element.metadata.specification} · ${element.name}`
    : element.name;
  addItem(items, {
    id: element.id,
    kind,
    name: displayName,
    path,
    sourceRange: element.sourceRange,
    nodeId: element.id,
    ...target
  });
  for (const field of element.fields) addField(items, field, element.id, [...path, element.name], {
    ...target,
    nodeId: element.id
  });
};

const addField = (
  items: ModelSearchItem[],
  field: EmField,
  ownerId: string,
  path: string[],
  target: Partial<ModelSearchItem>
): void => {
  addItem(items, {
    id: `${ownerId}/field/${field.name}`,
    kind: 'field',
    name: field.name,
    path,
    sourceRange: field.sourceRange,
    ...target
  });
};

const addItem = (
  items: ModelSearchItem[],
  item: Omit<ModelSearchItem, 'acronym'>
): void => {
  items.push({
    ...item,
    acronym: acronym(item.name)
  });
};

const elementKind = (element: EmElement): ModelSearchKind | undefined => {
  if (element.kind === 'gwt') return 'specification';
  if (['command', 'event', 'readmodel', 'automation', 'policy', 'integration', 'screen'].includes(element.kind)) {
    return element.kind as ModelSearchKind;
  }
  return undefined;
};

export const parseModelSearchQuery = (query: string): ParsedModelSearchQuery => {
  const trimmed = query.trim();
  const match = /^([a-z]+):(.*)$/i.exec(trimmed);
  if (!match) return { text: trimmed };
  const kind = aliases[match[1].toLowerCase()];
  return kind ? { kind, text: match[2].trim() } : { text: trimmed };
};

export const searchModelItems = (
  items: ModelSearchItem[],
  query: string,
  recentIds: readonly string[] = [],
  limit = 30
): ModelSearchItem[] => {
  const parsed = parseModelSearchQuery(query);
  const recentRank = new Map(recentIds.map((id, index) => [id, Math.max(0, 50 - index * 4)]));
  const candidates = items.filter((item) =>
    (!parsed.kind || item.kind === parsed.kind)
    && (parsed.kind === 'field' || item.kind !== 'field')
  );
  if (!parsed.text) {
    if (recentIds.length && !parsed.kind) {
      const byId = new Map(candidates.map((item) => [item.id, item]));
      return recentIds.map((id) => byId.get(id)).filter((item): item is ModelSearchItem => Boolean(item)).slice(0, limit);
    }
    return [...candidates]
      .sort((left, right) => (recentRank.get(right.id) ?? 0) - (recentRank.get(left.id) ?? 0))
      .slice(0, limit);
  }
  return candidates
    .map((item) => ({
      item,
      score: scoreItem(item, parsed.text) + (recentRank.get(item.id) ?? 0)
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name))
    .slice(0, limit)
    .map((result) => result.item);
};

const scoreItem = (item: ModelSearchItem, query: string): number => {
  const needle = normalize(query);
  const name = normalize(item.name);
  const path = normalize(item.path.join(' '));
  if (name === needle) return 1000;
  if (name.startsWith(needle)) return 800;
  if (item.acronym.toLowerCase().startsWith(needle)) return 650;
  if (name.includes(needle)) return 500;
  if (orderedTokensMatch(name, needle)) return 300;
  if (path.includes(needle)) return 150;
  return 0;
};

const orderedTokensMatch = (value: string, query: string): boolean => {
  const tokens = query.split(/\s+/).filter(Boolean);
  let offset = 0;
  return tokens.every((token) => {
    const index = value.indexOf(token, offset);
    if (index < 0) return false;
    offset = index + token.length;
    return true;
  });
};

const acronym = (value: string): string => {
  const capitals = value.match(/[A-Z0-9]/g)?.join('');
  if (capitals && capitals.length > 1) return capitals;
  return value.split(/[_\-\s]+/).map((part) => part[0] ?? '').join('');
};

const normalize = (value: string): string => value.toLowerCase().replace(/[_-]+/g, ' ').trim();
