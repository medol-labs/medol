import { createDefaultCoreModule, createDefaultSharedCoreModule, EmptyFileSystem, inject } from 'langium';
import { MedolGeneratedModule, MedolGeneratedSharedModule } from '../language/generated/module';
import {
  isActorRef,
  isAggregate,
  isAutomation,
  isBinaryExpr,
  isCommand,
  isCreatesAggregateMarker,
  isEvent,
  isField,
  isFieldDerivation,
  isFieldSourceMapping,
  isHotspot,
  isIntegration,
  isDecision,
  isMetric,
  isNote,
  isNumberLiteral,
  isPolicy,
  isReadModel,
  isReactsTo,
  isRefExpr,
  isRisk,
  isSlice,
  isSource,
  isSpecification,
  isState,
  isStringLiteral,
  isSubscription,
  isTarget,
  isUiRef
} from '../language/generated/ast';
import type {
  Aggregate as AstAggregate,
  Automation as AstAutomation,
  Command as AstCommand,
  Context as AstContext,
  Domain as AstDomain,
  Event as AstEvent,
  Expression,
  Field as AstField,
  FieldSource,
  Integration as AstIntegration,
  Model as AstModel,
  Policy as AstPolicy,
  ReadModel as AstReadModel,
  Slice as AstSlice,
  Specification as AstSpecification,
  UiRef as AstUiRef
} from '../language/generated/ast';
import { EmAggregate, EmContext, EmDomain, EmEdge, EmElement, EmField, EmFieldMapping, EmModel, EmSlice, EmUi, emptyModel } from './model';

const sharedServices = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  MedolGeneratedSharedModule
);

const medolServices = inject(
  createDefaultCoreModule({ shared: sharedServices }),
  MedolGeneratedModule
);

export const parseMedol = (text: string): EmModel => {
  try {
    const parseResult = medolServices.parser.LangiumParser.parse<AstModel>(text);
    const model = astToEmModel(parseResult.value);

    for (const lexerError of parseResult.lexerErrors) {
      model.diagnostics.push(lexerError.message);
    }
    for (const parserError of parseResult.parserErrors) {
      model.diagnostics.push(parserError.message);
    }

    if (model.contexts.length === 0 && text.trim().length > 0) {
      model.diagnostics.push('No context block found. Start with: domain MyDomain { context MyContext { ... } }');
    }

    validateReferences(model);
    refreshEdgeIds(model);
    dedupeEdges(model);
    return model;
  } catch (error) {
    const model = emptyModel();
    model.diagnostics.push(error instanceof Error ? error.message : 'Unable to parse current MEDOL');
    return model;
  }
};

export const parseEventModelingDsl = parseMedol;

export const astToEmModel = (ast: AstModel): EmModel => {
  const model = emptyModel();

  for (const domainNode of ast.domains ?? []) {
    const domain = parseDomain(domainNode, model.edges);
    model.domains.push(domain);
    model.contexts.push(...domain.contexts);
  }

  for (const contextNode of ast.contexts ?? []) {
    model.contexts.push(parseContext(contextNode, undefined, model.edges));
  }

  return model;
};

const parseDomain = (node: AstDomain, edges: EmEdge[]): EmDomain => {
  const domain: EmDomain = {
    id: scopedId('domain', safeName(node.name, 'UnnamedDomain')),
    name: safeName(node.name, 'UnnamedDomain'),
    contexts: []
  };

  for (const contextNode of node.contexts ?? []) {
    domain.contexts.push(parseContext(contextNode, domain.id, edges));
  }

  return domain;
};

const parseContext = (node: AstContext, domainId: string | undefined, edges: EmEdge[]): EmContext => {
  const contextName = safeName(node.name, 'UnnamedContext');
  const context: EmContext = {
    id: domainId ? `${domainId}/context/${contextName}` : scopedId('context', contextName),
    name: contextName,
    aggregates: [],
    looseElements: [],
    notes: [],
    risks: [],
    decisions: [],
    metrics: []
  };

  for (const element of node.elements ?? []) {
    if (isAggregate(element)) {
      context.aggregates.push(parseAggregate(element, context.id, edges));
      continue;
    }
    if (isNote(element)) {
      context.notes.push(element.value);
      continue;
    }
    if (isRisk(element)) {
      context.risks.push(element.value);
      continue;
    }
    if (isDecision(element)) {
      context.decisions.push(element.value);
      continue;
    }
    if (isMetric(element)) {
      context.metrics.push(element.name);
      continue;
    }
    if (isIntegration(element) || isReadModel(element) || isPolicy(element)) {
      const looseElement = parseElement(element, context.id);
      context.looseElements.push(looseElement);
      collectElementEdges(element, looseElement.id, edges);
    }
  }

  return context;
};

const parseAggregate = (node: AstAggregate, contextId: string, edges: EmEdge[]): EmAggregate => {
  const aggregateName = safeName(node.name, 'UnnamedAggregate');
  const aggregateId = `${contextId}/aggregate/${aggregateName}`;
  const aggregate: EmAggregate = {
    id: aggregateId,
    name: aggregateName,
    states: [],
    slices: []
  };

  for (const feature of node.features ?? []) {
    if (isState(feature)) {
      aggregate.states.push(feature.name);
      continue;
    }
    if (isSlice(feature)) {
      aggregate.slices.push(parseSlice(feature, aggregateId, edges));
    }
  }

  return aggregate;
};

const parseSlice = (node: AstSlice, aggregateId: string, edges: EmEdge[]): EmSlice => {
  const sliceName = safeName(node.name, 'UnnamedSlice');
  const elements = node.elements ?? [];
  const sliceId = `${aggregateId}/slice/${sliceName}`;
  const slice: EmSlice = {
    id: sliceId,
    name: sliceName,
    aggregateId,
    createsAggregate: elements.some(isCreatesAggregateMarker),
    resultingState: elements.find(isState)?.name,
    hotspots: elements.filter(isHotspot).map((hotspot) => hotspot.value),
    elements: []
  };

  const actorRef = elements.find(isActorRef);
  if (actorRef) {
    slice.elements.push({
      id: `${sliceId}/actor/${actorRef.actor}`,
      kind: 'actor',
      name: actorRef.actor,
      fields: [],
      sliceId,
      aggregateId
    });
  }

  const uiRefs = elements.filter(isUiRef);
  for (const uiRef of uiRefs) {
    slice.elements.push({
      id: `${sliceId}/screen/${uiRef.view}`,
      kind: 'screen',
      name: uiRef.view,
      fields: [],
      sliceId,
      aggregateId,
      ...(parseUi(uiRef) ? { ui: parseUi(uiRef) } : {})
    });
  }

  for (const element of elements) {
    if (isCommand(element) || isEvent(element) || isReadModel(element) || isAutomation(element) || isPolicy(element) || isSpecification(element)) {
      const parsed = parseElement(element, sliceId, aggregateId);
      slice.elements.push(parsed);
      collectElementEdges(element, parsed.id, edges);
    }
  }

  const reactsTo = elements.find(isReactsTo)?.event?.$refText;
  const firstReactionElement = slice.elements.find((element) =>
    element.kind === 'readmodel' || element.kind === 'automation' || element.kind === 'command'
  );
  if (reactsTo && firstReactionElement) {
    edges.push(edge(`ref/event/${reactsTo}`, firstReactionElement.id, 'reactsTo'));
  }

  const screens = slice.elements.filter((element) => element.kind === 'screen');
  const command = slice.elements.find((element) => element.kind === 'command');
  const event = slice.elements.find((element) => element.kind === 'event');

  for (const screen of screens) {
    if (command) {
      edges.push(edge(screen.id, command.id, 'invokes'));
    }
  }
  if (command && event) {
    edges.push(edge(command.id, event.id, 'emits'));
  }

  return slice;
};

const parseUi = (uiRef: AstUiRef): EmUi | undefined => {
  if (!uiRef.type) return undefined;

  return {
    type: uiRef.type
  };
};

const parseElement = (
  node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstPolicy | AstSpecification | AstIntegration,
  scopeId: string,
  aggregateId?: string
): EmElement => {
  const kind = isReadModel(node)
    ? 'readmodel'
    : isSpecification(node)
      ? 'gwt'
      : node.$type.toLowerCase();

  return {
    id: `${scopeId}/${kind}/${safeName(node.name, 'UnnamedElement')}`,
    kind: kind as EmElement['kind'],
    name: safeName(node.name, 'UnnamedElement'),
    fields: parseElementFields(node),
    ...(isReadModel(node) && node.listElement ? { listElement: true } : {}),
    sliceId: scopeId.includes('/slice/') ? scopeId : undefined,
    aggregateId,
    metadata: parseElementMetadata(node)
  };
};

const parseElementFields = (node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstPolicy | AstSpecification | AstIntegration): EmField[] => {
  if (isCommand(node) || isEvent(node)) {
    return (node.fields ?? []).map(parseField);
  }
  if (isReadModel(node)) {
    return (node.elements ?? []).filter(isField).map(parseField);
  }
  if (isIntegration(node)) {
    return parseIntegrationFields(node);
  }
  return [];
};

const parseIntegrationFields = (node: AstIntegration): EmField[] => {
  const fields: EmField[] = [];
  const source = node.elements.find(isSource)?.system;
  const target = node.elements.find(isTarget)?.system;
  if (source) fields.push({ name: 'source', type: source, cardinality: 'Single', attributes: [] });
  if (target) fields.push({ name: 'target', type: target, cardinality: 'Single', attributes: [] });
  return fields;
};

const parseField = (field: AstField): EmField => {
  const mapping = parseFieldMapping(field);
  return {
    name: safeName(field.name, 'unnamedField'),
    type: safeName(field.type, 'Unknown'),
    cardinality: field.cardinality === '[]' ? 'List' : field.cardinality === '?' ? 'Optional' : 'Single',
    attributes: [...(field.attributes ?? [])],
    ...(field.details?.example ? { example: field.details.example } : {}),
    ...(mapping ? { mapping } : {})
  };
};

const parseFieldMapping = (field: AstField): EmFieldMapping | undefined => {
  const detailSources = field.details?.sources?.map(formatFieldSource) ?? [];
  const rule = field.details?.rule;

  if (field.mapping) {
    const mappingSources = (field.mapping.sources ?? []).map(formatFieldSource);
    return {
      kind: isFieldDerivation(field.mapping) ? 'derived' : 'from',
      sources: detailSources.length > 0 ? detailSources : mappingSources,
      ...(rule ? { rule } : {})
    };
  }

  if (detailSources.length > 0 || rule) {
    return {
      kind: rule ? 'derived' : 'from',
      sources: detailSources,
      ...(rule ? { rule } : {})
    };
  }

  return undefined;
};

const formatFieldSource = (source: FieldSource): string => source.parts.join('.');

const parseElementMetadata = (node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstPolicy | AstSpecification | AstIntegration): Record<string, string> => {
  const metadata: Record<string, string> = {};

  if (isPolicy(node)) {
    if (node.event?.$refText) metadata.on = node.event.$refText;
    if (node.command?.$refText) metadata.issue = node.command.$refText;
  }

  if (isSpecification(node)) {
    (node.givens ?? []).forEach((given, index) => {
      if (given.event?.$refText) metadata[`given${index + 1}`] = given.event.$refText;
    });
    if (node.when?.command?.$refText) metadata.when = node.when.command.$refText;
    if (node.then?.event?.$refText) metadata.then = node.then.event.$refText;
    for (const assignment of node.when.condition?.assignments ?? []) {
      metadata[`example:${assignment.field}`] = formatLiteral(assignment.value);
    }
  }

  return metadata;
};

const collectElementEdges = (
  node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstPolicy | AstSpecification | AstIntegration,
  sourceId: string,
  edges: EmEdge[]
): void => {
  if (isReadModel(node)) {
    for (const subscription of (node.elements ?? []).filter(isSubscription)) {
      if (subscription.event?.$refText) edges.push(edge(`ref/event/${subscription.event.$refText}`, sourceId, 'updates'));
    }
  }

  if (isAutomation(node)) {
    for (const emits of (node.elements ?? []).filter((element) => element.$type === 'Emits')) {
      if (emits.command?.$refText) edges.push(edge(sourceId, `ref/command/${emits.command.$refText}`, 'emits'));
    }
  }

  if (isPolicy(node)) {
    if (node.event?.$refText) edges.push(edge(`ref/event/${node.event.$refText}`, sourceId, 'triggers'));
    if (node.command?.$refText) edges.push(edge(sourceId, `ref/command/${node.command.$refText}`, 'issues'));
  }

  if (isSpecification(node)) {
    for (const given of node.givens ?? []) {
      if (given.event?.$refText) edges.push(edge(`ref/event/${given.event.$refText}`, sourceId, 'given'));
    }
    if (node.when?.command?.$refText) edges.push(edge(`ref/command/${node.when.command.$refText}`, sourceId, 'when'));
    if (node.then?.event?.$refText) edges.push(edge(sourceId, `ref/event/${node.then.event.$refText}`, 'then'));
  }

  if (isIntegration(node)) {
    for (const element of node.elements ?? []) {
      if (element.$type === 'Emits') {
        if (element.command?.$refText) edges.push(edge(sourceId, `ref/command/${element.command.$refText}`, 'emits'));
      }
      if (isReactsTo(element)) {
        if (element.event?.$refText) edges.push(edge(`ref/event/${element.event.$refText}`, sourceId, 'reactsTo'));
      }
    }
  }
};

const formatLiteral = (value: Expression): string => {
  if (isStringLiteral(value)) return value.value;
  if (isNumberLiteral(value)) return String(value.value);
  if (isRefExpr(value)) return value.ref.$refText;
  if (isBinaryExpr(value)) return `${formatLiteral(value.left)} ${value.operator} ${formatLiteral(value.right)}`;
  return '';
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

const refreshEdgeIds = (model: EmModel): void => {
  model.edges = model.edges.map((edgeItem) => ({
    ...edgeItem,
    id: formatEdgeId(edgeItem.source, edgeItem.target, edgeItem.label)
  }));
};

const edge = (source: string, target: string, label?: string): EmEdge => ({
  id: formatEdgeId(source, target, label),
  source,
  target,
  label
});

const formatEdgeId = (source: string, target: string, label?: string): string => `${source}->${target}:${label ?? ''}`;

const scopedId = (kind: string, name: string): string => `${kind}/${name}`;

const safeName = (value: string | undefined, fallback: string): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};
