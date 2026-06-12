import type { EmElement, EmField, EmModel, EmSlice } from './model';
import { allContextSlices } from './dslParser';
import { humanize } from './name';

export interface CodegenModel {
  rootPackage: 'tech.medo';
  domain?: string;
  contexts: CodegenContext[];
  valueTypes: CodegenValueType[];
  aggregates: CodegenAggregate[];
  concepts: CodegenConcept[];
  actors: CodegenActor[];
  slices: CodegenSlice[];
}

export interface CodegenContext {
  id: string;
  name: string;
  title: string;
  notes: string[];
  risks: string[];
  decisions: string[];
  metrics: string[];
  valueTypes: Array<{ id: string; name: string; title: string }>;
  aggregates: Array<{ id: string; name: string; title: string }>;
  concepts: Array<{ id: string; name: string; title: string; states: string[] }>;
  slices: Array<{ id: string; name: string; title: string }>;
}

export type CodegenValueTypeConstraint =
  | { kind: 'format'; format: string }
  | { kind: 'length'; min: number; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'matches'; pattern: string }
  | { kind: 'oneOf'; values: Array<string | number> };

export interface CodegenValueType {
  id: string;
  name: string;
  title: string;
  context: string;
  baseType: string;
  constraints: CodegenValueTypeConstraint[];
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
}

export type CodegenElementType = 'COMMAND' | 'EVENT' | 'SCREEN' | 'READMODEL' | 'PROCESSOR' | 'SPECIFICATION';

export interface CodegenField {
  name: string;
  type: string;
  example?: string;
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

  for (const contextItem of model.contexts) {
    for (const aggregate of contextItem.aggregates) {
      aggregateRecords.set(aggregate.name, {
        id: stableId('aggregate', aggregate.name),
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
          actorRecords.set(element.name, {
            id: stableId('actor', element.name),
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
      const aggregateRef = toCodegenAggregateRef(aggregate.name);
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
    contexts: model.contexts.map((contextItem) => ({
      id: stableId('context', contextItem.id),
      name: contextItem.name,
      title: humanize(contextItem.name),
      notes: contextItem.notes,
      risks: contextItem.risks,
      decisions: contextItem.decisions,
      metrics: contextItem.metrics,
      valueTypes: contextItem.valueTypes.map((valueType) => ({
        id: stableId('type', valueType.id),
        name: valueType.name,
        title: humanize(valueType.name)
      })),
      aggregates: contextItem.aggregates.map((aggregate) => toCodegenAggregateRef(aggregate.name)),
      concepts: contextItem.concepts.map((concept) => ({
        id: stableId('concept', concept.id),
        name: concept.name,
        title: humanize(concept.name),
        states: concept.states
      })),
      slices: contextItem.slices.map(toCodegenSliceRef)
    })),
    valueTypes: model.contexts.flatMap((contextItem) => contextItem.valueTypes.map((valueType) => ({
      id: stableId('type', valueType.id),
      name: valueType.name,
      title: humanize(valueType.name),
      context: contextItem.name,
      baseType: valueType.baseType,
      constraints: valueType.constraints
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
    actors: [...actorRecords.values()],
    slices
  };
};

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
  const processors = slice.elements.filter((element) => element.kind === 'automation' || element.kind === 'policy');
  const specifications = slice.elements.filter((element) => element.kind === 'gwt');
  const actors = slice.elements
    .filter((element) => element.kind === 'actor')
    .map((element) => ({
      id: stableId('actor', element.name),
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
  ...(ui ?? element.ui ? { ui: ui ?? element.ui } : {})
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

  return {
    id: stableId(element.kind, element.id),
    chapter: context,
    sliceName: humanize(sliceName),
    title: humanize(element.name),
    ...(metadata.specification ? { specification: metadata.specification } : {}),
    ...(metadata.rule ? { rule: metadata.rule } : {}),
    expressions: Object.entries(metadata)
      .filter(([key]) => /^expression\d+$/.test(key))
      .sort(([left], [right]) => Number(left.slice(10)) - Number(right.slice(10)))
      .map(([, expression]) => expression),
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
  cardinality: field.cardinality === 'List' ? 'Multiple' : 'Single',
  optional: field.cardinality === 'Optional',
  idAttribute: field.attributes.includes('id'),
  generated: field.attributes.includes('generated'),
  technicalAttribute: field.attributes.includes('technical'),
  query: field.attributes.includes('query'),
  ...(field.mapping ? { source: toCodegenFieldSource(field.mapping) } : {})
});

const toCodegenFieldSource = (mapping: NonNullable<EmField['mapping']>): CodegenFieldSource => ({
  kind: mapping.kind === 'derived' ? 'derived' : 'direct',
  from: mapping.sources,
  ...(mapping.rule ? { rule: mapping.rule } : {})
});

const buildDependencies = (model: EmModel, elementsById: Map<string, EmElement>): Map<string, CodegenDependency[]> => {
  const dependenciesByElementId = new Map<string, CodegenDependency[]>();

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

const toCodegenAggregateRef = (aggregateName: string): CodegenAggregateRef => ({
  id: stableId('aggregate', aggregateName),
  name: aggregateName,
  title: humanize(aggregateName)
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
    case 'policy':
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
