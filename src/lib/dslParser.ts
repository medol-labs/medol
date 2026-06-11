import { createDefaultCoreModule, createDefaultSharedCoreModule, EmptyFileSystem, inject } from 'langium';
import { MedolGeneratedModule, MedolGeneratedSharedModule } from '../language/generated/module';
import {
  isActorRef,
  isAggregate,
  isAutomation,
  isBinaryExpr,
  isCommand,
  isCreatesAggregateMarker,
  isConcept,
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
  isSliceTags,
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
  Concept as AstConcept,
  Event as AstEvent,
  Expression,
  Field as AstField,
  FieldSource,
  Integration as AstIntegration,
  Model as AstModel,
  Policy as AstPolicy,
  ReadModel as AstReadModel,
  Slice as AstSlice,
  Scenario as AstScenario,
  TagExpression,
  Specification as AstSpecification,
  ValidationExpression,
  ValidationOperand,
  UiRef as AstUiRef
} from '../language/generated/ast';
import { EmAggregate, EmContext, EmConcept, EmDomain, EmEdge, EmElement, EmField, EmFieldMapping, EmModel, EmSlice, EmUi, emptyModel } from './model';

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
    slices: [],
    concepts: [],
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
    if (isSlice(element)) {
      context.slices.push(parseSlice(element, context.id, edges));
      continue;
    }
    if (isConcept(element)) {
      context.concepts.push(parseConcept(element, context.id));
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

  const slicesByName = new Map(allContextSlices(context).map((slice) => [slice.name, slice.id]));
  for (const concept of context.concepts) {
    concept.sliceIds = concept.sliceNames
      .map((sliceName) => slicesByName.get(sliceName))
      .filter((sliceId): sliceId is string => Boolean(sliceId));
  }

  return context;
};

const parseConcept = (node: AstConcept, contextId: string): EmConcept => {
  const name = safeName(node.name, 'UnnamedConcept');
  return {
    id: `${contextId}/concept/${name}`,
    name,
    sliceNames: (node.slices ?? [])
      .map((sliceRef) => sliceRef.slice?.$refText)
      .filter((sliceName): sliceName is string => Boolean(sliceName)),
    sliceIds: []
  };
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
      aggregate.slices.push(parseSlice(feature, aggregateId, edges, aggregateId));
    }
  }

  return aggregate;
};

const parseSlice = (node: AstSlice, scopeId: string, edges: EmEdge[], aggregateId?: string): EmSlice => {
  const sliceName = safeName(node.name, 'UnnamedSlice');
  const elements = node.elements ?? [];
  const sliceId = `${scopeId}/slice/${sliceName}`;
  const tags = elements.find(isSliceTags)?.tags ?? [];
  const slice: EmSlice = {
    id: sliceId,
    name: sliceName,
    ...(aggregateId ? { aggregateId } : {}),
    createsAggregate: elements.some(isCreatesAggregateMarker),
    resultingState: elements.find(isState)?.name,
    tags: tags.map((tag) => ({
      name: tag.name,
      ...(tag.expression ? { expression: formatTagExpression(tag.expression) } : {})
    })),
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
      ...(aggregateId ? { aggregateId } : {})
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
      ...(aggregateId ? { aggregateId } : {}),
      ...(parseUi(uiRef) ? { ui: parseUi(uiRef) } : {})
    });
  }

  for (const element of elements) {
    if (isSpecification(element) && element.scenarios.length > 0) {
      for (const scenario of element.scenarios) {
        const parsed = parseScenarioElement(element, scenario, sliceId, aggregateId);
        slice.elements.push(parsed);
        collectScenarioEdges(scenario, parsed.id, edges);
      }
      continue;
    }
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

const parseScenarioElement = (
  specification: AstSpecification,
  scenario: AstScenario,
  sliceId: string,
  aggregateId?: string
): EmElement => ({
  id: `${sliceId}/gwt/${safeName(specification.name, 'UnnamedSpecification')}/${safeName(scenario.name, 'UnnamedScenario')}`,
  kind: 'gwt',
  name: safeName(scenario.name, 'UnnamedScenario'),
  fields: [],
  sliceId,
  aggregateId,
  metadata: {
    specification: safeName(specification.name, 'UnnamedSpecification'),
    ...(specification.rule ? { rule: normalizeMultilineString(specification.rule) } : {}),
    ...Object.fromEntries(
      specification.expressions.map((expression, index) => [`expression${index + 1}`, formatValidationExpression(expression)])
    ),
    ...parseScenarioMetadata(scenario)
  }
});

const parseScenarioMetadata = (
  scenario: Pick<AstScenario, 'givens' | 'when' | 'then'>
): Record<string, string> => {
  const metadata: Record<string, string> = {};
  scenario.givens.forEach((given, index) => {
    const givenIndex = index + 1;
    if (given.event?.$refText) metadata[`given${givenIndex}`] = given.event.$refText;
    for (const assignment of given.condition?.assignments ?? []) {
      metadata[`givenExample:${givenIndex}:${assignment.field}`] = formatLiteral(assignment.value);
    }
  });
  if (scenario.when?.command?.$refText) metadata.when = scenario.when.command.$refText;
  if (scenario.then?.event?.$refText) metadata.then = scenario.then.event.$refText;
  if (scenario.then?.rejection) metadata.thenReject = scenario.then.rejection;
  for (const assignment of scenario.when?.condition?.assignments ?? []) {
    metadata[`example:${assignment.field}`] = formatLiteral(assignment.value);
  }
  return metadata;
};

const collectScenarioEdges = (scenario: AstScenario, sourceId: string, edges: EmEdge[]): void => {
  for (const given of scenario.givens) {
    if (given.event?.$refText) edges.push(edge(`ref/event/${given.event.$refText}`, sourceId, 'given'));
  }
  if (scenario.when?.command?.$refText) edges.push(edge(`ref/command/${scenario.when.command.$refText}`, sourceId, 'when'));
  if (scenario.then?.event?.$refText) edges.push(edge(sourceId, `ref/event/${scenario.then.event.$refText}`, 'then'));
};

const normalizeMultilineString = (value: string): string => {
  const content = value.startsWith('"""') && value.endsWith('"""') ? value.slice(3, -3) : value;
  const lines = content
    .replace(/^\s*\r?\n/, '')
    .replace(/\r?\n\s*$/, '')
    .split(/\r?\n/);
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const indentation = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(indentation)).join('\n').trim();
};

const formatValidationExpression = (expression: ValidationExpression): string => {
  switch (expression.$type) {
    case 'UniqueValidation':
      return `unique ${formatFieldSource(expression.target)}`;
    case 'RequiredValidation':
      return `required ${formatFieldSource(expression.target)}`;
    case 'FormatValidation':
      return `format ${formatFieldSource(expression.target)} ${expression.format}`;
    case 'LengthValidation':
      return `length ${formatFieldSource(expression.target)} ${expression.min}..${expression.max}`;
    case 'RangeValidation':
      return `range ${formatFieldSource(expression.target)} ${expression.min}..${expression.max}`;
    case 'MatchesValidation':
      return `matches ${formatFieldSource(expression.target)} ${JSON.stringify(expression.pattern)}`;
    case 'OneOfValidation':
      return `oneOf ${formatFieldSource(expression.target)} ${expression.values.map(formatValidationLiteral).join(', ')}`;
    case 'AssertValidation':
      return `assert ${formatValidationOperand(expression.left)} ${expression.operator} ${formatValidationOperand(expression.right)}`;
  }
};

const formatValidationOperand = (operand: ValidationOperand): string =>
  operand.$type === 'FieldSource' ? formatFieldSource(operand) : formatValidationLiteral(operand);

const formatValidationLiteral = (literal: Expression): string =>
  isStringLiteral(literal) ? JSON.stringify(literal.value) : formatLiteral(literal);

const formatTagExpression = (expression: TagExpression): string => {
  if (expression.$type === 'TagReference') {
    return expression.parts.join('.');
  }
  return `${expression.function}(${expression.arguments.map(formatTagExpression).join(', ')})`;
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
      const givenIndex = index + 1;
      if (given.event?.$refText) metadata[`given${givenIndex}`] = given.event.$refText;
      for (const assignment of given.condition?.assignments ?? []) {
        metadata[`givenExample:${givenIndex}:${assignment.field}`] = formatLiteral(assignment.value);
      }
    });
    if (node.when?.command?.$refText) metadata.when = node.when.command.$refText;
    if (node.then?.event?.$refText) metadata.then = node.then.event.$refText;
    if (node.then?.rejection) metadata.thenReject = node.then.rejection;
    for (const assignment of node.when?.condition?.assignments ?? []) {
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
    ...context.slices.flatMap((slice) => slice.elements),
    ...context.aggregates.flatMap((aggregate) =>
      aggregate.slices.flatMap((slice) => slice.elements)
    )
  ]);

export const allContextSlices = (context: EmContext): EmSlice[] => [
  ...context.slices,
  ...context.aggregates.flatMap((aggregate) => aggregate.slices)
];

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
