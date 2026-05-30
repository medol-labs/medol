import type { EmElement, EmField, EmModel, EmSlice } from './model';
import { humanize } from './name';

export interface CodegenModel {
  rootPackage: 'tech.medo';
  domain?: string;
  contexts: CodegenContext[];
  aggregates: CodegenAggregate[];
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
  aggregates: Array<{ id: string; name: string; title: string }>;
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
  aggregate: CodegenAggregateRef;
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
  createsAggregate?: boolean;
  listElement?: boolean;
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
  given: CodegenSpecificationElement[];
  when: CodegenSpecificationElement[];
  then: CodegenSpecificationElement[] | CodegenSpecificationError;
}

export interface CodegenSpecificationElement {
  title: string;
  id: string;
  type: 'COMMAND' | 'EVENT';
  fields: Array<{ name: string; example?: string }>;
}

export interface CodegenSpecificationError {
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

      for (const slice of aggregate.slices) {
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
          elementsByReference
        ));
      }
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
      aggregates: contextItem.aggregates.map((aggregate) => toCodegenAggregateRef(aggregate.name))
    })),
    aggregates: [...aggregateRecords.values()],
    actors: [...actorRecords.values()],
    slices
  };
};

const toCodegenSlice = (
  slice: EmSlice,
  aggregate: CodegenAggregateRef,
  context: string,
  index: number,
  dependenciesByElementId: Map<string, CodegenDependency[]>,
  elementsByReference: Map<string, EmElement>
): CodegenSlice => {
  const commands = slice.elements.filter((element) => element.kind === 'command');
  const events = slice.elements.filter((element) => element.kind === 'event');
  const screens = slice.elements.filter((element) => element.kind === 'screen');
  const readmodels = slice.elements.filter((element) => element.kind === 'projection');
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
    aggregate,
    commands: commands.map((element, commandIndex) =>
      toCodegenElement(element, 'COMMAND', aggregate, context, slice.name, dependenciesByElementId, slice.createsAggregate && commandIndex === 0)
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
  aggregate: CodegenAggregateRef,
  context: string,
  sliceName: string,
  dependenciesByElementId: Map<string, CodegenDependency[]>,
  createsAggregate = false
): CodegenElement => ({
  id: stableId(element.kind, element.id),
  name: element.name,
  title: humanize(element.name),
  type,
  modelContext: context,
  slice: humanize(sliceName),
  aggregate,
  fields: element.fields.map(toCodegenField),
  dependencies: dependenciesByElementId.get(element.id) ?? [],
  ...(createsAggregate ? { createsAggregate } : {}),
  ...(type === 'READMODEL' && element.listElement ? { listElement: true } : {})
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
    .map(([, eventName]) => elementsByReference.get(`event:${eventName}`))
    .filter((event): event is EmElement => Boolean(event))
    .map((event) => toCodegenSpecificationElement(event, 'EVENT'));
  const when = metadata.when ? elementsByReference.get(`command:${metadata.when}`) : undefined;
  const then = metadata.then ? elementsByReference.get(`event:${metadata.then}`) : undefined;
  const examples = specExamples(metadata);

  return {
    id: stableId(element.kind, element.id),
    chapter: context,
    sliceName: humanize(sliceName),
    title: humanize(element.name),
    given,
    when: when ? [toCodegenSpecificationElement(when, 'COMMAND', examples)] : [],
    then: then
      ? [toCodegenSpecificationElement(then, 'EVENT', examples)]
      : {
          title: humanize(element.name),
          id: stableId('spec-error', element.id),
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
    case 'projection':
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
