import type {
  CodegenDependency,
  CodegenElement,
  CodegenField,
  CodegenFieldSource,
  CodegenModel,
  CodegenSlice,
  CodegenSpecification,
  CodegenSpecificationElement,
  CodegenStateChange,
  CodegenUi
} from './codegenModel';
import { stableId } from './codegenModel';

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
  listElement?: boolean;
  aggregateDependencies?: string[];
  dependencies: Array<{
    id: string;
    type: 'INBOUND' | 'OUTBOUND';
    title: string;
    elementType: string;
  }>;
  createsAggregate?: boolean;
  ui?: CodegenUi;
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
  chapter: string;
  context: string;
  sliceType: 'STATE_CHANGE';
  tags: Array<{ name: string; expression?: string }>;
  concepts: string[];
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
  concepts: Array<{
    id: string;
    name: string;
    title: string;
    context: string;
    slices: Array<{ id: string; name: string; title: string }>;
  }>;
  domain?: string;
  context: string;
  codeGen: ConfigCodeGen;
  sliceGroups: [];
  sliceImages: Record<string, never>;
  sliceLayouts: Record<string, never>;
}

interface ConfigCodeGen {
  application: string;
  rootPackage: 'tech.medo';
  contextPackage: string;
}

export const codegenModelToConfig = (model: CodegenModel): ConfigRoot => ({
  slices: model.slices.map(toConfigSlice),
  flows: [],
  aggregates: model.aggregates.map((aggregate) => ({
    id: aggregate.id,
    name: aggregate.name,
    title: aggregate.title,
    fields: aggregate.fields,
    states: aggregate.states
  })),
  actors: model.actors,
  concepts: model.concepts,
  ...(model.domain ? { domain: model.domain } : {}),
  context: getPrimaryContextName(model),
  codeGen: {
    application: model.domain ?? '',
    rootPackage: model.rootPackage,
    contextPackage: getPrimaryContextName(model)
  },
  sliceGroups: [],
  sliceImages: {},
  sliceLayouts: {}
});

const getPrimaryContextName = (model: CodegenModel): string => model.contexts[0]?.name ?? 'EventModel';

const toConfigSlice = (slice: CodegenSlice): ConfigSlice => ({
  id: slice.id,
  status: 'Created',
  index: slice.index,
  title: slice.title,
  chapter: slice.chapter,
  context: slice.context,
  sliceType: 'STATE_CHANGE',
  tags: slice.tags,
  concepts: slice.concepts,
  commands: slice.commands.map(toConfigElement),
  events: slice.events.map(toConfigElement),
  readmodels: slice.readmodels.map(toConfigElement),
  screens: slice.screens.map(toConfigElement),
  screenImages: [],
  screenLayouts: [],
  processors: slice.processors.map(toConfigElement),
  tables: [],
  ...(slice.stateChange ? { stateChange: toConfigStateChange(slice.stateChange) } : {}),
  specifications: slice.specifications.map(toConfigSpecification),
  actors: slice.actors,
  aggregates: slice.aggregate ? [slice.aggregate] : []
});

const toConfigElement = (element: CodegenElement): ConfigElement => ({
  id: element.id,
  tags: [],
  elementContext: 'INTERNAL',
  modelContext: element.modelContext,
  context: 'INTERNAL',
  slice: element.slice,
  title: element.title,
  fields: element.fields.map(toConfigField),
  type: element.type,
  description: '',
  aggregate: element.aggregate?.name,
  ...(element.type === 'READMODEL' && element.listElement ? { listElement: true } : {}),
  ...(element.aggregate ? { aggregateDependencies: [element.aggregate.title] } : {}),
  dependencies: element.dependencies.map(toConfigDependency),
  createsAggregate: element.createsAggregate ?? false,
  ...(element.ui ? { ui: element.ui } : {}),
  triggers: [],
  sketched: false,
  prototype: {
    activeByDefault: false
  }
});

const toConfigDependency = (dependency: CodegenDependency): ConfigElement['dependencies'][number] => ({
  id: dependency.id,
  type: dependency.direction,
  title: dependency.title,
  elementType: dependency.elementType
});

const toConfigStateChange = (stateChange: CodegenStateChange): ConfigStateChange => ({
  type: 'STATE_CHANGE',
  ...(stateChange.event ? { event: stateChange.event } : {}),
  ...(stateChange.eventId ? { eventId: stateChange.eventId } : {}),
  to: stateChange.to
});

const toConfigSpecification = (specification: CodegenSpecification): ConfigSpecification => ({
  vertical: false,
  id: specification.id,
  chapter: specification.chapter,
  sliceName: specification.sliceName,
  title: specification.title,
  given: specification.given.map((element) => toConfigSpecificationElement(element)),
  when: specification.when.map((element) => toConfigSpecificationElement(element)),
  then: Array.isArray(specification.then)
    ? specification.then.map((element) => toConfigSpecificationElement(element))
    : {
        title: specification.then.title,
        id: specification.then.id || stableId('spec-reject', specification.id),
        description: specification.then.description,
        type: 'SPEC_ERROR',
        fields: []
      },
  comments: [],
  examples: []
});

const toConfigSpecificationElement = (element: CodegenSpecificationElement): ConfigSpecificationElement => ({
  title: element.title,
  tags: [],
  id: element.id,
  index: 0,
  specRow: 0,
  type: element.type,
  fields: element.fields
});

const toConfigField = (field: CodegenField): ConfigField => ({
  name: field.name,
  type: field.type,
  ...(field.example ? { example: field.example } : {}),
  cardinality: field.cardinality,
  optional: field.optional,
  idAttribute: field.idAttribute,
  generated: field.generated,
  technicalAttribute: field.technicalAttribute,
  query: field.query,
  ...(field.source ? { mappings: [toConfigFieldMapping(field.source)] } : {}),
  subfields: []
});

const toConfigFieldMapping = (source: CodegenFieldSource): ConfigFieldMapping => ({
  type: source.kind === 'derived' ? 'DERIVED' : 'DIRECT',
  from: source.from,
  ...(source.rule ? { rule: source.rule } : {})
});
