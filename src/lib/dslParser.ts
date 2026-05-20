import { EmAggregate, EmContext, EmEdge, EmElement, EmField, EmModel, EmSlice, emptyModel } from './model';

interface Block {
  keyword: string;
  name: string;
  body: string;
  start: number;
  end: number;
}

const blockKeywords = [
  'context',
  'aggregate',
  'slice',
  'command',
  'event',
  'projection',
  'automation',
  'policy',
  'specification',
  'transition',
  'integration',
  'userJourney'
];

const elementKinds = new Set(['command', 'event', 'projection', 'automation', 'policy', 'specification', 'transition', 'integration']);

export const parseEventModelingDsl = (text: string): EmModel => {
  const model = emptyModel();
  const contexts = findBlocks(text, 'context');

  if (contexts.length === 0 && text.trim().length > 0) {
    model.diagnostics.push('No context block found. Start with: context MyContext { ... }');
  }

  for (const contextBlock of contexts) {
    const context: EmContext = {
      id: scopedId('context', contextBlock.name),
      name: contextBlock.name,
      aggregates: [],
      looseElements: []
    };

    const consumedRanges: Array<[number, number]> = [];
    for (const aggregateBlock of findBlocks(contextBlock.body, 'aggregate')) {
      consumedRanges.push([aggregateBlock.start, aggregateBlock.end]);
      const aggregate = parseAggregate(aggregateBlock, context.id, model.edges);
      context.aggregates.push(aggregate);
    }

    for (const elementBlock of findTopLevelBlocks(contextBlock.body, consumedRanges)) {
      if (!elementKinds.has(elementBlock.keyword)) {
        continue;
      }
      const element = parseElement(elementBlock, context.id);
      context.looseElements.push(element);
      collectElementEdges(elementBlock, element.id, model.edges);
    }

    model.contexts.push(context);
  }

  dedupeEdges(model);
  validateReferences(model);
  return model;
};

const parseAggregate = (block: Block, contextId: string, edges: EmEdge[]): EmAggregate => {
  const aggregateId = `${contextId}/aggregate/${block.name}`;
  const aggregate: EmAggregate = {
    id: aggregateId,
    name: block.name,
    states: [],
    slices: []
  };

  for (const state of block.body.matchAll(/^\s*state\s+([A-Za-z_][\w_]*)/gm)) {
    aggregate.states.push(state[1]);
  }

  for (const sliceBlock of findBlocks(block.body, 'slice')) {
    aggregate.slices.push(parseSlice(sliceBlock, aggregateId, edges));
  }

  return aggregate;
};

const parseSlice = (block: Block, aggregateId: string, edges: EmEdge[]): EmSlice => {
  const sliceId = `${aggregateId}/slice/${block.name}`;
  const slice: EmSlice = {
    id: sliceId,
    name: block.name,
    aggregateId,
    createsAggregate: /^\s*createsAggregate\s*$/m.test(block.body),
    elements: []
  };

  const refs = parseLineRefs(block.body);
  if (refs.actor) {
    slice.elements.push({
      id: `${sliceId}/actor/${refs.actor}`,
      kind: 'actor',
      name: refs.actor,
      fields: [],
      sliceId,
      aggregateId
    });
  }
  if (refs.ui) {
    slice.elements.push({
      id: `${sliceId}/screen/${refs.ui}`,
      kind: 'screen',
      name: refs.ui,
      fields: [],
      sliceId,
      aggregateId
    });
  }

  for (const child of findTopLevelBlocks(block.body, [])) {
    if (!elementKinds.has(child.keyword)) {
      continue;
    }
    const element = parseElement(child, sliceId, aggregateId);
    slice.elements.push(element);
    collectElementEdges(child, element.id, edges);
  }

  const reactsTo = refs.reactsTo;
  const firstReactionElement = slice.elements.find((element) =>
    element.kind === 'projection' || element.kind === 'automation' || element.kind === 'command'
  );
  if (reactsTo && firstReactionElement) {
    edges.push(edge(`ref/event/${reactsTo}`, firstReactionElement.id, 'reactsTo'));
  }

  const screen = slice.elements.find((element) => element.kind === 'screen');
  const command = slice.elements.find((element) => element.kind === 'command');
  const event = slice.elements.find((element) => element.kind === 'event');

  if (screen && command) {
    edges.push(edge(screen.id, command.id, 'invokes'));
  }
  if (command && event) {
    edges.push(edge(command.id, event.id, 'emits'));
  }

  return slice;
};

const parseElement = (block: Block, scopeId: string, aggregateId?: string): EmElement => {
  const kind = block.keyword === 'projection' ? 'projection' : block.keyword === 'specification' ? 'gwt' : block.keyword;
  return {
    id: `${scopeId}/${kind}/${block.name}`,
    kind: kind as EmElement['kind'],
    name: block.name,
    fields: parseElementFields(kind, block.body),
    sliceId: scopeId.includes('/slice/') ? scopeId : undefined,
    aggregateId,
    metadata: parseElementMetadata(block)
  };
};

const parseElementFields = (kind: string, body: string): EmField[] => {
  if (kind === 'integration') {
    return parseIntegrationFields(body);
  }
  if (kind === 'transition') {
    return parseTransitionFields(body);
  }
  return parseFields(body);
};

const parseFields = (body: string): EmField[] => {
  const fields: EmField[] = [];
  for (const match of body.matchAll(/^\s*([A-Za-z_][\w_]*)\s*:\s*([A-Za-z_][\w_]*)(\[\]|\?)?([^\n{}]*)$/gm)) {
    fields.push({
      name: match[1],
      type: match[2],
      cardinality: match[3] === '[]' ? 'List' : match[3] === '?' ? 'Optional' : 'Single',
      attributes: (match[4] || '').trim().split(/\s+/).filter(Boolean)
    });
  }
  return fields;
};

const parseTransitionFields = (body: string): EmField[] => {
  const fields = parseFields(body);
  const from = body.match(/^\s*from\s+([A-Za-z_][\w_]*)/m)?.[1];
  const on = body.match(/^\s*on\s+([A-Za-z_][\w_]*)/m)?.[1];
  const to = body.match(/^\s*to\s+([A-Za-z_][\w_]*)/m)?.[1];
  if (from) fields.push({ name: 'from', type: from, cardinality: 'Single', attributes: [] });
  if (on) fields.push({ name: 'on', type: on, cardinality: 'Single', attributes: [] });
  if (to) fields.push({ name: 'to', type: to, cardinality: 'Single', attributes: [] });
  return fields;
};

const parseIntegrationFields = (body: string): EmField[] => {
  const fields = parseFields(body);
  const source = body.match(/^\s*source\s+([A-Za-z_][\w_]*)/m)?.[1];
  const target = body.match(/^\s*target\s+([A-Za-z_][\w_]*)/m)?.[1];
  if (source) fields.push({ name: 'source', type: source, cardinality: 'Single', attributes: [] });
  if (target) fields.push({ name: 'target', type: target, cardinality: 'Single', attributes: [] });
  return fields;
};

const parseLineRefs = (body: string): { actor?: string; ui?: string; reactsTo?: string } => ({
  actor: body.match(/^\s*actor\s+([A-Za-z_][\w_]*)/m)?.[1],
  ui: body.match(/^\s*ui\s+([A-Za-z_][\w_]*)/m)?.[1],
  reactsTo: body.match(/^\s*reactsTo\s+([A-Za-z_][\w_]*)/m)?.[1]
});

const parseElementMetadata = (block: Block): Record<string, string> => {
  const metadata: Record<string, string> = {};
  if (block.keyword === 'policy') {
    const on = block.body.match(/^\s*on\s+([A-Za-z_][\w_]*)/m)?.[1];
    const issue = block.body.match(/^\s*issue\s+([A-Za-z_][\w_]*)/m)?.[1];
    if (on) metadata.on = on;
    if (issue) metadata.issue = issue;
  }
  if (block.keyword === 'specification') {
    for (const [index, given] of [...block.body.matchAll(/^\s*given\s+([A-Za-z_][\w_]*)/gm)].entries()) {
      metadata[`given${index + 1}`] = given[1];
    }
    const when = block.body.match(/^\s*when\s+([A-Za-z_][\w_]*)/m)?.[1];
    const then = block.body.match(/^\s*then\s+([A-Za-z_][\w_]*)/m)?.[1];
    if (when) metadata.when = when;
    if (then) metadata.then = then;
    const whenExample = block.body.match(/^\s*when\s+[A-Za-z_][\w_]*\s*\{([\s\S]*?)^\s*\}/m)?.[1];
    if (whenExample) {
      for (const assignment of whenExample.matchAll(/^\s*([A-Za-z_][\w_]*)\s*=\s*(.+?)\s*$/gm)) {
        metadata[`example:${assignment[1]}`] = unquote(assignment[2].trim());
      }
    }
  }
  if (block.keyword === 'transition') {
    const from = block.body.match(/^\s*from\s+([A-Za-z_][\w_]*)/m)?.[1];
    const on = block.body.match(/^\s*on\s+([A-Za-z_][\w_]*)/m)?.[1];
    const to = block.body.match(/^\s*to\s+([A-Za-z_][\w_]*)/m)?.[1];
    if (from) metadata.from = from;
    if (on) metadata.on = on;
    if (to) metadata.to = to;
  }
  return metadata;
};

const collectElementEdges = (block: Block, sourceId: string, edges: EmEdge[]): void => {
  for (const subscription of block.body.matchAll(/^\s*subscribe\s+([A-Za-z_][\w_]*)/gm)) {
    edges.push(edge(`ref/event/${subscription[1]}`, sourceId, 'updates'));
  }
  for (const emits of block.body.matchAll(/^\s*emits\s+([A-Za-z_][\w_]*)/gm)) {
    edges.push(edge(sourceId, `ref/command/${emits[1]}`, 'emits'));
  }
  const on = block.body.match(/^\s*on\s+([A-Za-z_][\w_]*)/m)?.[1];
  const issue = block.body.match(/^\s*issue\s+([A-Za-z_][\w_]*)/m)?.[1];
  if (on) edges.push(edge(`ref/event/${on}`, sourceId, block.keyword === 'transition' ? 'transitions' : 'triggers'));
  if (issue) edges.push(edge(sourceId, `ref/command/${issue}`, 'issues'));
  for (const given of block.body.matchAll(/^\s*given\s+([A-Za-z_][\w_]*)/gm)) {
    edges.push(edge(`ref/event/${given[1]}`, sourceId, 'given'));
  }
  const when = block.body.match(/^\s*when\s+([A-Za-z_][\w_]*)/m)?.[1];
  const then = block.body.match(/^\s*then\s+([A-Za-z_][\w_]*)/m)?.[1];
  if (when) edges.push(edge(`ref/command/${when}`, sourceId, 'when'));
  if (then) edges.push(edge(sourceId, `ref/event/${then}`, 'then'));
};

const findBlocks = (text: string, keyword: string): Block[] =>
  findAllBlocks(text).filter((block) => block.keyword === keyword);

const findTopLevelBlocks = (text: string, consumedRanges: Array<[number, number]>): Block[] =>
  findAllBlocks(text)
    .filter((block) => !consumedRanges.some(([start, end]) => block.start >= start && block.end <= end))
    .filter((block) => blockKeywords.includes(block.keyword));

const findAllBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  const regex = new RegExp(`\\b(${blockKeywords.join('|')})\\s+("[^"]+"|'[^']+'|[A-Za-z_][\\w_]*)\\s*\\{`, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    const openBrace = text.indexOf('{', match.index);
    const closeBrace = findMatchingBrace(text, openBrace);
    if (closeBrace < 0) {
      continue;
    }
    blocks.push({
      keyword: match[1],
      name: unquote(match[2]),
      body: text.slice(openBrace + 1, closeBrace),
      start: match.index,
      end: closeBrace + 1
    });
    regex.lastIndex = closeBrace + 1;
  }

  return blocks;
};

const findMatchingBrace = (text: string, openBrace: number): number => {
  let depth = 0;
  let quote: string | undefined;
  for (let index = openBrace; index < text.length; index += 1) {
    const char = text[index];
    const prev = text[index - 1];
    if ((char === '"' || char === "'") && prev !== '\\') {
      quote = quote === char ? undefined : quote ?? char;
    }
    if (quote) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
};

const validateReferences = (model: EmModel): void => {
  const elements = flattenElements(model);
  const byKindAndName = new Map<string, string>();

  for (const element of elements) {
    byKindAndName.set(`${element.kind}/${element.name}`, element.id);
  }

  for (const edgeItem of model.edges) {
    if (edgeItem.source.startsWith('ref/')) {
      const [, kind, name] = edgeItem.source.split('/');
      const resolved = byKindAndName.get(`${kind}/${name}`);
      if (resolved) edgeItem.source = resolved;
    }
    if (edgeItem.target.startsWith('ref/')) {
      const [, kind, name] = edgeItem.target.split('/');
      const resolved = byKindAndName.get(`${kind}/${name}`);
      if (resolved) edgeItem.target = resolved;
    }
  }
};

export const flattenElements = (model: EmModel): EmElement[] =>
  model.contexts.flatMap((context) => [
    ...context.looseElements,
    ...context.aggregates.flatMap((aggregate) =>
      aggregate.slices.flatMap((slice) => slice.elements)
    )
  ]);

const dedupeEdges = (model: EmModel): void => {
  const seen = new Set<string>();
  model.edges = model.edges.filter((edgeItem) => {
    const key = `${edgeItem.source}->${edgeItem.target}:${edgeItem.label ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const edge = (source: string, target: string, label?: string): EmEdge => ({
  id: `${source}->${target}:${label ?? ''}`,
  source,
  target,
  label
});

const scopedId = (kind: string, name: string): string => `${kind}/${name}`;

const unquote = (value: string): string => value.replace(/^["']|["']$/g, '');
