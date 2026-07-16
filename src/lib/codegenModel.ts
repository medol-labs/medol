import type { EmDictionaryProvider, EmElement, EmField, EmModel, EmSlice } from './model';
import { allContextSlices } from './dslParser';
import { humanize } from './name';
import { coveredSpecificationExpressions } from './specificationCoverage';

export interface CodegenModel {
  rootPackage: 'tech.medo';
  domain?: string;
  domains?: Array<{ id: string; name: string; title: string; contexts: Array<{ id: string; name: string; title: string }> }>;
  deployments?: Array<{ id: string; name: string; title: string; domain?: string; contexts: Array<{ id: string; name: string; title: string }> }>;
  locales?: string[];
  defaultLocale?: string;
  translations?: Record<string, Record<string, string>>;
  contexts: CodegenContext[];
  valueTypes: CodegenValueType[];
  aggregates: CodegenAggregate[];
  concepts: CodegenConcept[];
  transitions: CodegenTransition[];
  actors: CodegenActor[];
  slices: CodegenSlice[];
  externalSystems: CodegenExternalSystem[];
}

export interface CodegenContext {
  id: string;
  name: string;
  title: string;
  domain?: string;
  notes: string[];
  risks: string[];
  decisions: string[];
  metrics: string[];
  valueTypes: Array<{ id: string; name: string; title: string; kind: 'scalar' | 'enum' | 'object' }>;
  aggregates: Array<{ id: string; name: string; title: string }>;
  concepts: Array<{ id: string; name: string; title: string; states: string[] }>;
  externalSystems: Array<{ id: string; name: string; title: string }>;
  slices: Array<{ id: string; name: string; title: string }>;
}

export interface CodegenExternalSystem {
  id: string;
  name: string;
  title: string;
  context: string;
  kind?: string;
  protocol?: string;
  endpoint?: CodegenExternalEndpoint;
  capabilities: CodegenExternalCapability[];
}

export interface CodegenExternalEndpoint {
  type: 'config';
  key: string;
}

export interface CodegenExternalCapability {
  type: 'command' | 'event';
  name: string;
  title: string;
}

export type CodegenValueTypeConstraint =
  | { kind: 'format'; format: string }
  | { kind: 'length'; min: number; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'matches'; pattern: string }
  | { kind: 'oneOf'; values: Array<string | number | boolean | null> };

export interface CodegenValueType {
  id: string;
  name: string;
  title: string;
  context: string;
  kind: 'scalar' | 'enum' | 'object';
  baseType: string;
  constraints: CodegenValueTypeConstraint[];
  values: string[];
  fields: CodegenField[];
}

export interface CodegenConcept {
  id: string;
  name: string;
  title: string;
  context: string;
  states: string[];
  slices: Array<{ id: string; name: string; title: string }>;
}

export interface CodegenAggregate {
  id: string;
  name: string;
  title: string;
  context: string;
  fields: [];
  states: string[];
}

export interface CodegenActor {
  id: string;
  name: string;
  title: string;
}

export interface CodegenTransition {
  id: string;
  context: string;
  owner: CodegenTransitionOwner;
  slice: { id: string; name: string; title: string };
  command?: { id: string; name: string; title: string };
  event?: { id: string; name: string; title: string };
  trigger?: { id: string; name: string; title: string };
  from?: string;
  to: string;
  startsLifecycle: boolean;
}

export interface CodegenTransitionOwner {
  id: string;
  type: 'concept' | 'aggregate';
  name: string;
  title: string;
}

export interface CodegenSlice {
  id: string;
  index: number;
  name: string;
  title: string;
  chapter: string;
  context: string;
  aggregate?: CodegenAggregateRef;
  tags: CodegenSliceTag[];
  concepts: string[];
  commands: CodegenElement[];
  events: CodegenElement[];
  readmodels: CodegenElement[];
  screens: CodegenElement[];
  processors: CodegenElement[];
  specifications: CodegenSpecification[];
  actors: CodegenActor[];
  hotspots: string[];
  stateChange?: CodegenStateChange;
}

export interface CodegenSliceTag {
  name: string;
  expression?: string;
}

export interface CodegenAggregateRef {
  id: string;
  name: string;
  title: string;
}

export interface CodegenElement {
  id: string;
  name: string;
  title: string;
  type: CodegenElementType;
  modelContext: string;
  slice: string;
  aggregate?: CodegenAggregateRef;
  fields: CodegenField[];
  dependencies: CodegenDependency[];
  startsLifecycle?: boolean;
  listElement?: boolean;
  ui?: CodegenUi;
  dictionaryProvider?: CodegenDictionaryProvider;
}

export type CodegenElementType = 'COMMAND' | 'EVENT' | 'SCREEN' | 'READMODEL' | 'PROCESSOR' | 'SPECIFICATION';

export interface CodegenField {
  name: string;
  type: string;
  example?: string;
  dictionary?: string;
  cardinality: 'Single' | 'Multiple';
  optional: boolean;
  idAttribute: boolean;
  generated: boolean;
  technicalAttribute: boolean;
  query: boolean;
  source?: CodegenFieldSource;
}

export interface CodegenFieldSource {
  kind: 'direct' | 'derived';
  from: string[];
  rule?: string;
  lookup?: CodegenDerivedLookup;
}

export interface CodegenDerivedLookup {
  key?: string;
  sourceEvent?: string;
  sourceField?: string;
  targetField?: string;
  cacheProjection?: string;
  cacheStrategy?: string;
  missingValuePolicy?: string;
}

export interface CodegenDictionaryProvider {
  name: string;
  code?: string;
  value?: string;
  label?: string;
  active?: string;
  state?: string;
  order?: string;
}

export interface CodegenUi {
  type?: CodegenUiType;
}

export type CodegenUiType =
  | 'list'
  | 'detail'
  | 'form'
  | 'dialog'
  | 'drawer'
  | 'confirm'
  | 'wizard'
  | 'inline'
  | 'background';

export interface CodegenDependency {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  title: string;
  elementType: string;
}

export interface CodegenStateChange {
  event?: string;
  eventId?: string;
  to: string;
}

export interface CodegenSpecification {
  id: string;
  chapter: string;
  sliceName: string;
  title: string;
  specification?: string;
  rule?: string;
  expressions: string[];
  validates: string[];
  given: CodegenSpecificationElement[];
  when: CodegenSpecificationElement[];
  then: CodegenSpecificationElement[] | CodegenSpecificationReject;
}

export interface CodegenSpecificationElement {
  title: string;
  id: string;
  type: 'COMMAND' | 'EVENT';
  fields: Array<{ name: string; example?: string }>;
}

export interface CodegenSpecificationReject {
  title: string;
  id: string;
  description: string;
}

export const modelToCodegenModel = (model: EmModel): CodegenModel => {
  const aggregateRecords = new Map<string, CodegenAggregate>();
  const actorRecords = new Map<string, CodegenActor>();
  const elementsById = new Map<string, EmElement>();
  const domainByContextId = new Map<string, string>();
  const contextByName = new Map(model.contexts.map((contextItem) => [contextItem.name, contextItem]));

  for (const domain of model.domains) {
    for (const contextItem of domain.contexts) {
      domainByContextId.set(contextItem.id, domain.name);
    }
  }

  for (const contextItem of model.contexts) {
    for (const aggregate of contextItem.aggregates) {
      aggregateRecords.set(aggregate.id, {
        id: stableId('aggregate', aggregate.id),
        name: aggregate.name,
        title: humanize(aggregate.name),
        context: contextItem.name,
        fields: [],
        states: aggregate.states
      });

    }

    for (const slice of allContextSlices(contextItem)) {
      for (const element of slice.elements) {
        elementsById.set(element.id, element);
        if (element.kind === 'actor') {
          actorRecords.set(`${contextItem.id}:${element.name}`, {
            id: stableId('actor', `context/${contextItem.name}/actor/${element.name}`),
            name: element.name,
            title: humanize(element.name)
          });
        }
      }
    }
  }

  const elementsByReference = new Map<string, EmElement>();
  for (const element of elementsById.values()) {
    if (element.kind === 'command' || element.kind === 'event') {
      elementsByReference.set(`${element.kind}:${element.name}`, element);
    }
  }

  const dependenciesByElementId = buildDependencies(model, elementsById);
  const slices: CodegenSlice[] = [];

  for (const contextItem of model.contexts) {
    for (const aggregate of contextItem.aggregates) {
      const aggregateRef = toCodegenAggregateRef(aggregate);
      for (const slice of aggregate.slices) {
        slices.push(toCodegenSlice(
          slice,
          aggregateRef,
          contextItem.name,
          slices.length,
          dependenciesByElementId,
          elementsByReference,
          contextItem.concepts.filter((concept) => concept.sliceIds.includes(slice.id)).map((concept) => concept.name)
        ));
      }
    }
    for (const slice of contextItem.slices) {
      slices.push(toCodegenSlice(
        slice,
        undefined,
        contextItem.name,
        slices.length,
        dependenciesByElementId,
        elementsByReference,
        contextItem.concepts.filter((concept) => concept.sliceIds.includes(slice.id)).map((concept) => concept.name)
      ));
    }
  }

  return {
    rootPackage: 'tech.medo',
    ...(model.domains[0] ? { domain: model.domains[0].name } : {}),
    ...(model.domains.length
      ? {
          domains: model.domains.map((domain) => ({
            id: stableId('domain', domain.id),
            name: domain.name,
            title: humanize(domain.name),
            contexts: domain.contexts.map((contextItem) => ({
              id: stableId('context', contextItem.id),
              name: contextItem.name,
              title: humanize(contextItem.name)
            }))
          }))
        }
      : {}),
    ...(model.deployments.length
      ? {
          deployments: model.deployments.map((deployment) => ({
            id: stableId('deployment', deployment.id),
            name: deployment.name,
            title: humanize(deployment.name),
            ...(deployment.domain ? { domain: deployment.domain } : {}),
            contexts: deployment.contexts.map((contextName) => {
              const contextItem = contextByName.get(contextName);
              return {
                id: stableId('context', contextItem?.id ?? contextName),
                name: contextName,
                title: humanize(contextName)
              };
            })
          }))
        }
      : {}),
    contexts: model.contexts.map((contextItem) => ({
      id: stableId('context', contextItem.id),
      name: contextItem.name,
      title: humanize(contextItem.name),
      ...(domainByContextId.get(contextItem.id) ? { domain: domainByContextId.get(contextItem.id) } : {}),
      notes: contextItem.notes,
      risks: contextItem.risks,
      decisions: contextItem.decisions,
      metrics: contextItem.metrics,
      valueTypes: contextItem.valueTypes.map((valueType) => ({
        id: stableId('type', valueType.id),
        name: valueType.name,
        title: humanize(valueType.name),
        kind: valueType.kind
      })),
      aggregates: contextItem.aggregates.map(toCodegenAggregateRef),
      concepts: contextItem.concepts.map((concept) => ({
        id: stableId('concept', concept.id),
        name: concept.name,
        title: humanize(concept.name),
        states: concept.states
      })),
      externalSystems: contextItem.externalSystems.map((external) => ({
        id: stableId('external', external.id),
        name: external.name,
        title: humanize(external.name)
      })),
      slices: contextItem.slices.map(toCodegenSliceRef)
    })),
    valueTypes: model.contexts.flatMap((contextItem) => contextItem.valueTypes.map((valueType) => ({
      id: stableId('type', valueType.id),
      name: valueType.name,
      title: humanize(valueType.name),
      context: contextItem.name,
      baseType: valueType.baseType,
      kind: valueType.kind,
      constraints: valueType.constraints,
      values: valueType.values,
      fields: valueType.fields.map(toCodegenField)
    }))),
    aggregates: [...aggregateRecords.values()],
    concepts: model.contexts.flatMap((contextItem) => contextItem.concepts.map((concept) => ({
      id: stableId('concept', concept.id),
      name: concept.name,
      title: humanize(concept.name),
      context: contextItem.name,
      states: concept.states,
      slices: concept.sliceNames.map((sliceName) => {
        const slice = allContextSlices(contextItem).find((candidate) => candidate.name === sliceName);
        return slice ? toCodegenSliceRef(slice) : {
          id: stableId('slice', `${contextItem.id}/slice/${sliceName}`),
          name: sliceName,
          title: humanize(sliceName)
        };
      })
    }))),
    transitions: buildTransitions(model),
    actors: [...actorRecords.values()],
    slices,
    externalSystems: model.contexts.flatMap((contextItem) => contextItem.externalSystems.map((external) => ({
      id: stableId('external', external.id),
      name: external.name,
      title: humanize(external.name),
      context: contextItem.name,
      ...(external.kind ? { kind: external.kind } : {}),
      ...(external.protocol ? { protocol: external.protocol } : {}),
      ...(external.endpoint ? { endpoint: external.endpoint } : {}),
      capabilities: external.capabilities.map((capability) => ({
        type: capability.type,
        name: capability.name,
        title: humanize(capability.name)
      }))
    })))
  };
};

const buildTransitions = (model: EmModel): CodegenTransition[] => {
  const eventToSlice = new Map<string, EmSlice>();
  const elementsById = new Map<string, EmElement>();
  const contextBySliceId = new Map<string, string>();
  const ownersBySliceId = new Map<string, CodegenTransitionOwner[]>();

  for (const contextItem of model.contexts) {
    const contextSlices = allContextSlices(contextItem);

    for (const aggregate of contextItem.aggregates) {
      const owner: CodegenTransitionOwner = {
        id: stableId('aggregate', aggregate.id),
        type: 'aggregate',
        name: aggregate.name,
        title: humanize(aggregate.name)
      };
      for (const slice of aggregate.slices) {
        ownersBySliceId.set(slice.id, [...(ownersBySliceId.get(slice.id) ?? []), owner]);
      }
    }

    for (const concept of contextItem.concepts) {
      const owner: CodegenTransitionOwner = {
        id: stableId('concept', concept.id),
        type: 'concept',
        name: concept.name,
        title: humanize(concept.name)
      };
      for (const sliceId of concept.sliceIds) {
        ownersBySliceId.set(sliceId, [...(ownersBySliceId.get(sliceId) ?? []), owner]);
      }
    }

    for (const slice of contextSlices) {
      contextBySliceId.set(slice.id, contextItem.name);
      for (const element of slice.elements) {
        elementsById.set(element.id, element);
        if (element.kind === 'event') eventToSlice.set(element.id, slice);
      }
    }
  }

  const reactsToBySliceId = new Map<string, EmElement>();
  for (const edge of model.edges) {
    if (edge.label !== 'reactsTo') continue;
    const source = elementsById.get(edge.source);
    const target = elementsById.get(edge.target);
    if (!source || source.kind !== 'event' || !target?.sliceId) continue;
    reactsToBySliceId.set(target.sliceId, source);
  }

  const transitions: CodegenTransition[] = [];
  for (const contextItem of model.contexts) {
    for (const slice of allContextSlices(contextItem)) {
      if (!slice.resultingState) continue;
      const owners = ownersBySliceId.get(slice.id) ?? [];
      if (owners.length === 0) continue;

      const command = slice.elements.find((element) => element.kind === 'command');
      const event = slice.elements.find((element) => element.kind === 'event');
      const trigger = reactsToBySliceId.get(slice.id);

      for (const owner of owners) {
        transitions.push({
          id: stableId('transition', `${owner.id}/${slice.id}`),
          context: contextBySliceId.get(slice.id) ?? contextItem.name,
          owner,
          slice: toCodegenSliceRef(slice),
          ...(command ? { command: toCodegenTransitionElement(command) } : {}),
          ...(event ? { event: toCodegenTransitionElement(event) } : {}),
          ...(trigger ? { trigger: toCodegenTransitionElement(trigger) } : {}),
          ...(!slice.startsLifecycle ? inferTransitionFromState(owner, trigger, eventToSlice, ownersBySliceId) : {}),
          to: slice.resultingState,
          startsLifecycle: Boolean(slice.startsLifecycle)
        });
      }
    }
  }

  return transitions;
};

const inferTransitionFromState = (
  owner: CodegenTransitionOwner,
  trigger: EmElement | undefined,
  eventToSlice: Map<string, EmSlice>,
  ownersBySliceId: Map<string, CodegenTransitionOwner[]>
): { from: string } | {} => {
  if (!trigger) return {};
  const sourceSlice = eventToSlice.get(trigger.id);
  if (!sourceSlice?.resultingState) return {};
  const sourceOwners = ownersBySliceId.get(sourceSlice.id) ?? [];
  const sameOwner = sourceOwners.some((candidate) => candidate.id === owner.id && candidate.type === owner.type);
  return sameOwner ? { from: sourceSlice.resultingState } : {};
};

const toCodegenTransitionElement = (element: EmElement): { id: string; name: string; title: string } => ({
  id: stableId(element.kind, element.id),
  name: element.name,
  title: humanize(element.name)
});

const toCodegenSlice = (
  slice: EmSlice,
  aggregate: CodegenAggregateRef | undefined,
  context: string,
  index: number,
  dependenciesByElementId: Map<string, CodegenDependency[]>,
  elementsByReference: Map<string, EmElement>,
  concepts: string[] = []
): CodegenSlice => {
  const commands = slice.elements.filter((element) => element.kind === 'command');
  const events = slice.elements.filter((element) => element.kind === 'event');
  const screens = slice.elements.filter((element) => element.kind === 'screen');
  const readmodels = slice.elements.filter((element) => element.kind === 'readmodel');
  const processors = slice.elements.filter((element) => element.kind === 'automation');
  const specifications = slice.elements.filter((element) => element.kind === 'gwt');
  const actors = slice.elements
    .filter((element) => element.kind === 'actor')
    .map((element) => ({
      id: stableId('actor', `context/${context}/actor/${element.name}`),
      name: element.name,
      title: humanize(element.name)
    }));

  return {
    id: stableId('slice', slice.id),
    index,
    name: slice.name,
    title: humanize(slice.name),
    chapter: context,
    context,
    ...(aggregate ? { aggregate } : {}),
    tags: slice.tags,
    concepts,
    commands: commands.map((element, commandIndex) =>
      toCodegenElement(
        element,
        'COMMAND',
        aggregate,
        context,
        slice.name,
        dependenciesByElementId,
        slice.startsLifecycle && commandIndex === 0,
        screens[0]?.ui
      )
    ),
    events: events.map((element) => toCodegenElement(element, 'EVENT', aggregate, context, slice.name, dependenciesByElementId)),
    readmodels: readmodels.map((element) => toCodegenElement(element, 'READMODEL', aggregate, context, slice.name, dependenciesByElementId)),
    screens: screens.map((element) => toCodegenElement(element, 'SCREEN', aggregate, context, slice.name, dependenciesByElementId)),
    processors: processors.map((element) => toCodegenElement(element, 'PROCESSOR', aggregate, context, slice.name, dependenciesByElementId)),
    specifications: specifications.map((element) => toCodegenSpecification(element, context, slice.name, elementsByReference)),
    actors,
    hotspots: slice.hotspots,
    ...(slice.resultingState ? { stateChange: toCodegenStateChange(slice, events) } : {})
  };
};

const toCodegenElement = (
  element: EmElement,
  type: CodegenElementType,
  aggregate: CodegenAggregateRef | undefined,
  context: string,
  sliceName: string,
  dependenciesByElementId: Map<string, CodegenDependency[]>,
  startsLifecycle = false,
  ui?: CodegenUi
): CodegenElement => ({
  id: stableId(element.kind, element.id),
  name: element.name,
  title: humanize(element.name),
  type,
  modelContext: context,
  slice: humanize(sliceName),
  ...(aggregate ? { aggregate } : {}),
  fields: element.fields.map(toCodegenField),
  dependencies: dependenciesByElementId.get(element.id) ?? [],
  ...(startsLifecycle ? { startsLifecycle } : {}),
  ...(type === 'READMODEL' && element.listElement ? { listElement: true } : {}),
  ...(ui ?? element.ui ? { ui: ui ?? element.ui } : {}),
  ...(type === 'READMODEL' && element.dictionaryProvider ? { dictionaryProvider: toCodegenDictionaryProvider(element.dictionaryProvider) } : {})
});

const toCodegenSliceRef = (slice: EmSlice): { id: string; name: string; title: string } => ({
  id: stableId('slice', slice.id),
  name: slice.name,
  title: humanize(slice.name)
});

const toCodegenStateChange = (slice: EmSlice, events: EmElement[]): CodegenStateChange => {
  const event = events[0];
  return {
    ...(event ? { event: event.name, eventId: stableId(event.kind, event.id) } : {}),
    to: slice.resultingState ?? ''
  };
};

const toCodegenSpecification = (
  element: EmElement,
  context: string,
  sliceName: string,
  elementsByReference: Map<string, EmElement>
): CodegenSpecification => {
  const metadata = element.metadata ?? {};
  const given = Object.entries(metadata)
    .filter(([key]) => /^given\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
    .map(([key, eventName]) => ({
      event: elementsByReference.get(`event:${eventName}`),
      examples: givenSpecExamples(metadata, Number(key.slice(5)))
    }))
    .filter((item): item is { event: EmElement; examples: Record<string, string> } => Boolean(item.event))
    .map(({ event, examples: givenExamples }) => toCodegenSpecificationElement(event, 'EVENT', givenExamples));
  const when = metadata.when ? elementsByReference.get(`command:${metadata.when}`) : undefined;
  const then = metadata.then ? elementsByReference.get(`event:${metadata.then}`) : undefined;
  const thenReject = metadata.thenReject;
  const examples = specExamples(metadata);
  const expressions = Object.entries(metadata)
    .filter(([key]) => /^expression\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(10)) - Number(right.slice(10)))
    .map(([, expression]) => expression);

  return {
    id: stableId(element.kind, element.id),
    chapter: context,
    sliceName: humanize(sliceName),
    title: humanize(element.name),
    ...(metadata.specification ? { specification: metadata.specification } : {}),
    ...(metadata.rule ? { rule: metadata.rule } : {}),
    expressions,
    validates: coveredSpecificationExpressions({ expressions, metadata }),
    given,
    when: when ? [toCodegenSpecificationElement(when, 'COMMAND', examples)] : [],
    then: then
      ? [toCodegenSpecificationElement(then, 'EVENT', examples)]
      : thenReject
        ? {
            title: 'Rejected',
            id: stableId('spec-reject', element.id),
            description: thenReject
          }
        : {
            title: humanize(element.name),
            id: stableId('spec-reject', element.id),
            description: ''
          }
  };
};

const toCodegenSpecificationElement = (
  element: EmElement,
  type: CodegenSpecificationElement['type'],
  examples: Record<string, string> = {}
): CodegenSpecificationElement => ({
  title: humanize(element.name),
  id: stableId(element.kind, element.id),
  type,
  fields: element.fields.map((field) => ({
    name: field.name,
    ...(examples[field.name] ? { example: examples[field.name] } : {})
  }))
});

const specExamples = (metadata: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => key.startsWith('example:'))
      .map(([key, value]) => [key.slice('example:'.length), value])
  );

const givenSpecExamples = (
  metadata: Record<string, string>,
  givenIndex: number
): Record<string, string> => {
  const prefix = `givenExample:${givenIndex}:`;
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
};

const toCodegenField = (field: EmField): CodegenField => ({
  name: field.name,
  type: field.type,
  ...(field.example ? { example: field.example } : {}),
  ...(field.dictionary ? { dictionary: field.dictionary } : {}),
  cardinality: field.cardinality === 'List' || field.cardinality === 'OptionalList' ? 'Multiple' : 'Single',
  optional: field.cardinality === 'Optional' || field.cardinality === 'OptionalList',
  idAttribute: field.attributes.includes('id'),
  generated: field.attributes.includes('generated'),
  technicalAttribute: field.attributes.includes('technical'),
  query: field.attributes.includes('query'),
  ...(field.mapping ? { source: toCodegenFieldSource(field.mapping) } : {})
});

const toCodegenFieldSource = (mapping: NonNullable<EmField['mapping']>): CodegenFieldSource => ({
  kind: mapping.kind === 'derived' ? 'derived' : 'direct',
  from: mapping.sources,
  ...(mapping.rule ? { rule: mapping.rule } : {}),
  ...(mapping.lookup ? { lookup: mapping.lookup } : {})
});

const toCodegenDictionaryProvider = (provider: EmDictionaryProvider): CodegenDictionaryProvider => ({
  name: provider.name,
  ...(provider.code ? { code: provider.code } : {}),
  ...(provider.value ? { value: provider.value } : {}),
  ...(provider.label ? { label: provider.label } : {}),
  ...(provider.active ? { active: provider.active } : {}),
  ...(provider.state ? { state: provider.state } : {}),
  ...(provider.order ? { order: provider.order } : {})
});

const buildDependencies = (model: EmModel, elementsById: Map<string, EmElement>): Map<string, CodegenDependency[]> => {
  const dependenciesByElementId = new Map<string, CodegenDependency[]>();
  const elements = [...elementsById.values()];
  const findElementByKindAndName = (kind: EmElement['kind'], name: string): EmElement | undefined =>
    elements.find((element) => element.kind === kind && element.name === name);

  for (const edge of model.edges) {
    const source = elementsById.get(edge.source);
    const target = elementsById.get(edge.target);
    if (!source || !target) continue;
    if (source.kind === 'gwt' || target.kind === 'gwt') continue;

    pushDependency(dependenciesByElementId, source.id, {
      id: stableId(target.kind, target.id),
      direction: 'OUTBOUND',
      title: humanize(target.name),
      elementType: toElementType(target.kind)
    });
    pushDependency(dependenciesByElementId, target.id, {
      id: stableId(source.kind, source.id),
      direction: 'INBOUND',
      title: humanize(source.name),
      elementType: toElementType(source.kind)
    });
  }

  for (const element of elementsById.values()) {
    if (element.kind !== 'gwt') continue;
    const metadata = element.metadata ?? {};
    if (!metadata.when || !metadata.then) continue;
    const command = findElementByKindAndName('command', metadata.when);
    const event = findElementByKindAndName('event', metadata.then);
    if (!command || !event) continue;
    pushDependency(dependenciesByElementId, command.id, {
      id: stableId(event.kind, event.id),
      direction: 'OUTBOUND',
      title: humanize(event.name),
      elementType: toElementType(event.kind)
    });
    pushDependency(dependenciesByElementId, event.id, {
      id: stableId(command.kind, command.id),
      direction: 'INBOUND',
      title: humanize(command.name),
      elementType: toElementType(command.kind)
    });
  }

  return dependenciesByElementId;
};

const pushDependency = (
  dependenciesByElementId: Map<string, CodegenDependency[]>,
  elementId: string,
  dependency: CodegenDependency
): void => {
  const dependencies = dependenciesByElementId.get(elementId) ?? [];
  if (!dependencies.some((item) => item.id === dependency.id && item.direction === dependency.direction)) {
    dependencies.push(dependency);
  }
  dependenciesByElementId.set(elementId, dependencies);
};

const toCodegenAggregateRef = (aggregate: { id: string; name: string }): CodegenAggregateRef => ({
  id: stableId('aggregate', aggregate.id),
  name: aggregate.name,
  title: humanize(aggregate.name)
});

const toElementType = (kind: EmElement['kind']): string => {
  switch (kind) {
    case 'command':
      return 'COMMAND';
    case 'event':
      return 'EVENT';
    case 'screen':
      return 'SCREEN';
    case 'readmodel':
      return 'READMODEL';
    case 'automation':
      return 'PROCESSOR';
    case 'gwt':
      return 'SPECIFICATION';
    default:
      return kind.toUpperCase();
  }
};

export const stableId = (prefix: string, value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
