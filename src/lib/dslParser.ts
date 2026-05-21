import { EmAggregate, EmContext, EmDomain, EmEdge, EmElement, EmField, EmModel, EmSlice, emptyModel } from './model';

interface Block {
  keyword: string;
  name: string;
  body: string;
  start: number;
  end: number;
}

const blockKeywords = [
  'domain',
  'context',
  'aggregate',
  'slice',
  'command',
  'event',
  'projection',
  'automation',
  'policy',
  'specification',
  'integration',
  'userJourney'
];

const elementKinds = new Set(['command', 'event', 'projection', 'automation', 'policy', 'specification', 'integration']);

export const parseEventModelingDsl = (text: string): EmModel => {
  const model = emptyModel();
  const domainBlocks = findBlocks(text, 'domain');

  for (const domainBlock of domainBlocks) {
    const domain: EmDomain = {
      id: scopedId('domain', domainBlock.name),
      name: domainBlock.name,
      contexts: []
    };

    for (const contextBlock of findBlocks(domainBlock.body, 'context')) {
      const context = parseContext(contextBlock, domain.id, model.edges);
      domain.contexts.push(context);
      model.contexts.push(context);
    }

    if (domain.contexts.length === 0) {
      model.diagnostics.push(`Domain ${domain.name} does not contain a context block.`);
    }

    model.domains.push(domain);
  }

  const directContexts = findTopLevelBlocks(text, domainBlocks.map(toRange))
    .filter((block) => block.keyword === 'context');
  for (const contextBlock of directContexts) {
    model.contexts.push(parseContext(contextBlock, undefined, model.edges));
  }

  if (model.contexts.length === 0 && text.trim().length > 0) {
    model.diagnostics.push('No context block found. Start with: domain MyDomain { context MyContext { ... } }');
  }

  dedupeEdges(model);
  validateReferences(model);
  return model;
};

const parseContext = (block: Block, domainId: string | undefined, edges: EmEdge[]): EmContext => {
  const context: EmContext = {
    id: domainId ? `${domainId}/context/${block.name}` : scopedId('context', block.name),
    name: block.name,
    aggregates: [],
    looseElements: []
  };

  const consumedRanges: Array<[number, number]> = [];
  for (const aggregateBlock of findBlocks(block.body, 'aggregate')) {
    consumedRanges.push([aggregateBlock.start, aggregateBlock.end]);
    const aggregate = parseAggregate(aggregateBlock, context.id, edges);
    context.aggregates.push(aggregate);
  }

  for (const elementBlock of findTopLevelBlocks(block.body, consumedRanges)) {
    if (!elementKinds.has(elementBlock.keyword)) {
      continue;
    }
    const element = parseElement(elementBlock, context.id);
    context.looseElements.push(element);
    collectElementEdges(elementBlock, element.id, edges);
  }

  return context;
};

const parseAggregate = (block: Block, contextId: string, edges: EmEdge[]): EmAggregate => {
  const aggregateId = `${contextId}/aggregate/${block.name}`;
  const aggregate: EmAggregate = {
    id: aggregateId,
    name: block.name,
    states: [],
    slices: []
  };

  const sliceBlocks = findBlocks(block.body, 'slice');
  aggregate.states.push(...parseStateLines(block.body, sliceBlocks.map(toRange)));

  for (const sliceBlock of sliceBlocks) {
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
    resultingState: undefined,
    elements: []
  };

  const refs = parseLineRefs(block.body);
  const childBlocks = findTopLevelBlocks(block.body, []);
  slice.resultingState = parseStateLines(block.body, childBlocks.map(toRange))[0];

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

  for (const child of childBlocks) {
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
  if (on) edges.push(edge(`ref/event/${on}`, sourceId, 'triggers'));
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

const parseStateLines = (text: string, ignoredRanges: Array<[number, number]>): string[] => {
  const states: string[] = [];
  for (const match of text.matchAll(/^\s*state\s+([A-Za-z_][\w_]*)/gm)) {
    const index = match.index ?? 0;
    if (!ignoredRanges.some(([start, end]) => index >= start && index < end)) {
      states.push(match[1]);
    }
  }
  return states;
};

const toRange = (block: Block): [number, number] => [block.start, block.end];

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
