import { parseEventModelingDsl } from './dslParser';
import type { EmElement, EmField, EmModel, EmSlice } from './model';
import { humanize } from './name';

interface ConfigField {
  name: string;
  type: string;
  example?: string;
  cardinality: 'Single' | 'Multiple';
  optional: boolean;
  idAttribute: boolean;
  generated: boolean;
  technicalAttribute: boolean;
  query: boolean;
  mappings?: ConfigFieldMapping[];
  subfields: [];
}

interface ConfigFieldMapping {
  type: 'DIRECT' | 'DERIVED';
  from: string[];
  rule?: string;
}

interface ConfigElement {
  id: string;
  tags: [];
  elementContext: 'INTERNAL';
  modelContext: string;
  context: 'INTERNAL';
  slice: string;
  title: string;
  fields: ConfigField[];
  type: 'COMMAND' | 'EVENT' | 'SCREEN' | 'READMODEL' | 'PROCESSOR' | 'SPECIFICATION';
  description: string;
  aggregate?: string;
  aggregateDependencies?: string[];
  dependencies: Array<{
    id: string;
    type: 'INBOUND' | 'OUTBOUND';
    title: string;
    elementType: string;
  }>;
  createsAggregate?: boolean;
  triggers?: [];
  sketched?: boolean;
  prototype?: { activeByDefault: boolean };
}

interface ConfigSpecificationElement {
  title: string;
  tags: [];
  id: string;
  index: 0;
  specRow: 0;
  type: 'COMMAND' | 'EVENT';
  fields: Array<{
    name: string;
    example?: string;
  }>;
}

interface ConfigSpecificationError {
  title: string;
  id: string;
  description: string;
  type: 'SPEC_ERROR';
  fields: [];
}

interface ConfigSpecification {
  vertical: false;
  id: string;
  chapter: string;
  sliceName: string;
  title: string;
  given: ConfigSpecificationElement[];
  when: ConfigSpecificationElement[];
  then: ConfigSpecificationElement[] | ConfigSpecificationError;
  comments: [];
  examples: [];
}

interface ConfigStateChange {
  type: 'STATE_CHANGE';
  event?: string;
  eventId?: string;
  to: string;
}


interface ConfigSlice {
  id: string;
  status: 'Created';
  index: number;
  title: string;
  context: string;
  sliceType: 'STATE_CHANGE';
  commands: ConfigElement[];
  events: ConfigElement[];
  readmodels: ConfigElement[];
  screens: ConfigElement[];
  screenImages: [];
  screenLayouts: [];
  processors: ConfigElement[];
  tables: [];
  stateChange?: ConfigStateChange;
  specifications: ConfigSpecification[];
  actors: Array<{ id: string; name: string; title: string }>;
  aggregates: Array<{ id: string; name: string; title: string }>;
}

export interface ConfigRoot {
  slices: ConfigSlice[];
  flows: [];
  aggregates: Array<{ id: string; name: string; title: string; fields: []; states: string[] }>;
  actors: Array<{ id: string; name: string; title: string }>;
  domain?: string;
  context: string;
  codeGen: Record<string, never>;
  sliceGroups: [];
  sliceImages: Record<string, never>;
  sliceLayouts: Record<string, never>;
}

export const dslToConfig = (dsl: string): ConfigRoot => modelToConfig(parseEventModelingDsl(dsl));

export const modelToConfig = (model: EmModel): ConfigRoot => {
  const context = model.contexts[0]?.name ?? 'EventModel';
  const slices: ConfigSlice[] = [];
  const aggregateRecords = new Map<string, { id: string; name: string; title: string; fields: []; states: string[] }>();
  const actorRecords = new Map<string, { id: string; name: string; title: string }>();

  const elementsById = new Map<string, EmElement>();
  for (const contextItem of model.contexts) {
    for (const aggregate of contextItem.aggregates) {
      aggregateRecords.set(aggregate.name, {
        id: stableId('aggregate', aggregate.name),
        name: aggregate.name,
        title: humanize(aggregate.name),
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

  const dependenciesByElementId = new Map<string, ConfigElement['dependencies']>();
  for (const edge of model.edges) {
    const source = elementsById.get(edge.source);
    const target = elementsById.get(edge.target);
    if (!source || !target) continue;
    if (source.kind === 'gwt' || target.kind === 'gwt') continue;

    pushDependency(dependenciesByElementId, source.id, {
      id: stableId(target.kind, target.id),
      type: 'OUTBOUND',
      title: humanize(target.name),
      elementType: toElementType(target.kind)
    });
    pushDependency(dependenciesByElementId, target.id, {
      id: stableId(source.kind, source.id),
      type: 'INBOUND',
      title: humanize(source.name),
      elementType: toElementType(source.kind)
    });
  }

  for (const contextItem of model.contexts) {
    for (const aggregate of contextItem.aggregates) {
      for (const slice of aggregate.slices) {
        slices.push(toConfigSlice(slice, aggregate.name, contextItem.name, slices.length, dependenciesByElementId, elementsByReference));
      }
    }
  }

  return {
    slices,
    flows: [],
    aggregates: [...aggregateRecords.values()],
    actors: [...actorRecords.values()],
    ...(model.domains[0] ? { domain: model.domains[0].name } : {}),
    context,
    codeGen: {},
    sliceGroups: [],
    sliceImages: {},
    sliceLayouts: {}
  };
};

const toConfigSlice = (
  slice: EmSlice,
  aggregateName: string,
  context: string,
  index: number,
  dependenciesByElementId: Map<string, ConfigElement['dependencies']>,
  elementsByReference: Map<string, EmElement>
): ConfigSlice => {
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
    status: 'Created',
    index,
    title: humanize(slice.name),
    context,
    sliceType: 'STATE_CHANGE',
    commands: commands.map((element, commandIndex) =>
      toConfigElement(element, 'COMMAND', aggregateName, context, slice.name, dependenciesByElementId, slice.createsAggregate && commandIndex === 0)
    ),
    events: events.map((element) => toConfigElement(element, 'EVENT', aggregateName, context, slice.name, dependenciesByElementId)),
    readmodels: readmodels.map((element) => toConfigElement(element, 'READMODEL', aggregateName, context, slice.name, dependenciesByElementId)),
    screens: screens.map((element) => toConfigElement(element, 'SCREEN', aggregateName, context, slice.name, dependenciesByElementId)),
    screenImages: [],
    screenLayouts: [],
    processors: processors.map((element) => toConfigElement(element, 'PROCESSOR', aggregateName, context, slice.name, dependenciesByElementId)),
    tables: [],
    ...(slice.resultingState ? { stateChange: toConfigStateChange(slice, events) } : {}),
    specifications: specifications.map((element) => toConfigSpecification(element, context, slice.name, elementsByReference)),
    actors,
    aggregates: [{
      id: stableId('aggregate', aggregateName),
      name: aggregateName,
      title: humanize(aggregateName)
    }]
  };
};

const toConfigElement = (
  element: EmElement,
  type: ConfigElement['type'],
  aggregateName: string,
  context: string,
  sliceName: string,
  dependenciesByElementId: Map<string, ConfigElement['dependencies']>,
  createsAggregate = false
): ConfigElement => ({
  id: stableId(element.kind, element.id),
  tags: [],
  elementContext: 'INTERNAL',
  modelContext: context,
  context: 'INTERNAL',
  slice: humanize(sliceName),
  title: humanize(element.name),
  fields: element.fields.map(toConfigField),
  type,
  description: '',
  aggregate: aggregateName,
  aggregateDependencies: [humanize(aggregateName)],
  dependencies: dependenciesByElementId.get(element.id) ?? [],
  createsAggregate,
  triggers: [],
  sketched: false,
  prototype: {
    activeByDefault: false
  }
});

const toConfigStateChange = (slice: EmSlice, events: EmElement[]): ConfigStateChange => {
  const event = events[0];
  return {
    type: 'STATE_CHANGE',
    ...(event ? { event: event.name, eventId: stableId(event.kind, event.id) } : {}),
    to: slice.resultingState ?? ''
  };
};


const toConfigSpecification = (
  element: EmElement,
  context: string,
  sliceName: string,
  elementsByReference: Map<string, EmElement>
): ConfigSpecification => {
  const metadata = element.metadata ?? {};
  const given = Object.entries(metadata)
    .filter(([key]) => /^given\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
    .map(([, eventName]) => elementsByReference.get(`event:${eventName}`))
    .filter((event): event is EmElement => Boolean(event))
    .map((event) => toConfigSpecificationElement(event, 'EVENT'));
  const when = metadata.when ? elementsByReference.get(`command:${metadata.when}`) : undefined;
  const then = metadata.then ? elementsByReference.get(`event:${metadata.then}`) : undefined;
  const examples = specExamples(metadata);

  return {
    vertical: false,
    id: stableId(element.kind, element.id),
    chapter: context,
    sliceName: humanize(sliceName),
    title: humanize(element.name),
    given,
    when: when ? [toConfigSpecificationElement(when, 'COMMAND', examples)] : [],
    then: then
      ? [toConfigSpecificationElement(then, 'EVENT', examples)]
      : {
          title: humanize(element.name),
          id: stableId('spec-error', element.id),
          description: '',
          type: 'SPEC_ERROR',
          fields: []
        },
    comments: [],
    examples: []
  };
};

const toConfigSpecificationElement = (
  element: EmElement,
  type: ConfigSpecificationElement['type'],
  examples: Record<string, string> = {}
): ConfigSpecificationElement => ({
  title: humanize(element.name),
  tags: [],
  id: stableId(element.kind, element.id),
  index: 0,
  specRow: 0,
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

const toConfigField = (field: EmField): ConfigField => ({
  name: field.name,
  type: field.type,
  ...(field.example ? { example: field.example } : {}),
  cardinality: field.cardinality === 'List' ? 'Multiple' : 'Single',
  optional: field.cardinality === 'Optional',
  idAttribute: field.attributes.includes('id'),
  generated: field.attributes.includes('generated'),
  technicalAttribute: field.attributes.includes('technical'),
  query: field.attributes.includes('query'),
  ...(field.mapping ? { mappings: [toConfigFieldMapping(field.mapping)] } : {}),
  subfields: []
});

const toConfigFieldMapping = (mapping: NonNullable<EmField['mapping']>): ConfigFieldMapping => ({
  type: mapping.kind === 'derived' ? 'DERIVED' : 'DIRECT',
  from: mapping.sources,
  ...(mapping.rule ? { rule: mapping.rule } : {})
});

const pushDependency = (
  dependenciesByElementId: Map<string, ConfigElement['dependencies']>,
  elementId: string,
  dependency: ConfigElement['dependencies'][number]
): void => {
  const dependencies = dependenciesByElementId.get(elementId) ?? [];
  if (!dependencies.some((item) => item.id === dependency.id && item.type === dependency.type)) {
    dependencies.push(dependency);
  }
  dependenciesByElementId.set(elementId, dependencies);
};

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

const stableId = (prefix: string, value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
