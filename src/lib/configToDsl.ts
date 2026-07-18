import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { quote, toDslId } from './name';

interface ConfigField {
  name?: string;
  type?: string;
  example?: string;
  dictionary?: string;
  cardinality?: string;
  optional?: boolean;
  idAttribute?: boolean;
  generated?: boolean;
  technicalAttribute?: boolean;
  query?: boolean;
  derived?: boolean;
  mappings?: Array<string | ConfigFieldMapping>;
}

interface ConfigFieldMapping {
  type?: 'DIRECT' | 'DERIVED';
  from?: string[];
  rule?: string;
  lookup?: ConfigDerivedLookup;
}

interface ConfigDerivedLookup {
  key?: string;
  sourceEvent?: string;
  sourceField?: string;
  targetField?: string;
  cacheProjection?: string;
  cacheStrategy?: string;
  missingValuePolicy?: string;
}

interface ConfigElement {
  title?: string;
  aggregate?: string;
  createsAggregate?: boolean;
  port?: boolean;
  listElement?: boolean;
  fields?: ConfigField[];
  dependencies?: Array<{ type?: string; title?: string; elementType?: string }>;
  ui?: ConfigUi;
  dictionaryProvider?: ConfigDictionaryProvider;
}

interface ConfigDictionaryProvider {
  name?: string;
  code?: string;
  value?: string;
  label?: string;
  active?: string;
  state?: string;
  order?: string;
}

interface ConfigUi {
  type?: string;
}

interface ConfigStateChange {
  to?: string;
}

interface ConfigSpecificationElement {
  title?: string;
  fields?: Array<{ name?: string; example?: string }>;
}

interface ConfigSpecificationError {
  title?: string;
  description?: string;
  type?: 'SPEC_ERROR';
}

interface ConfigSpecification {
  title?: string;
  specification?: string;
  rule?: string;
  expressions?: string[];
  given?: ConfigSpecificationElement[];
  when?: ConfigSpecificationElement[];
  then?: ConfigSpecificationElement[] | ConfigSpecificationError;
}

interface ConfigSlice {
  title?: string;
  context?: string;
  commands?: ConfigElement[];
  events?: ConfigElement[];
  screens?: ConfigElement[];
  readmodels?: ConfigElement[];
  processors?: ConfigElement[];
  specifications?: ConfigSpecification[];
  stateChange?: ConfigStateChange;
  aggregates?: Array<{ name?: string; title?: string }>;
  tags?: Array<{ name?: string; expression?: string }>;
  port?: boolean;
  concepts?: string[];
}

interface ConfigAggregate {
  name?: string;
  title?: string;
  states?: string[];
}

type ConfigValueTypeConstraint =
  | { kind: 'format'; format: string }
  | { kind: 'length'; min: number; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'matches'; pattern: string }
  | { kind: 'oneOf'; values: Array<string | number | boolean | null> };

interface ConfigValueType {
  name?: string;
  context?: string;
  kind?: 'scalar' | 'enum' | 'object';
  baseType?: string;
  constraints?: ConfigValueTypeConstraint[];
  values?: string[];
  fields?: ConfigField[];
}

interface ConfigRoot {
  domain?: string;
  context?: string;
  valueTypes?: ConfigValueType[];
  aggregates?: ConfigAggregate[];
  slices?: ConfigSlice[];
  concepts?: Array<{
    name?: string;
    states?: string[];
    slices?: Array<{ name?: string; title?: string }>;
  }>;
}

export const configToDsl = (config: ConfigRoot): string => {
  const domainName = config.domain ? toDslId(config.domain, 'Domain') : undefined;
  const contextName = toDslId(config.context || config.slices?.[0]?.context || 'EventModel');
  const grouped = new Map<string, ConfigSlice[]>();
  const directSlices: ConfigSlice[] = [];
  const aggregateStates = new Map<string, string[]>();
  const conceptRecords = new Map<string, NonNullable<ConfigRoot['concepts']>[number]>();

  const addConcept = (name: string | undefined, states: string[] = [], slices: Array<{ name?: string; title?: string }> = []): void => {
    const conceptName = toDslId(name, 'Concept');
    const existing = conceptRecords.get(conceptName);
    conceptRecords.set(conceptName, {
      name: conceptName,
      states: [...new Set([...(existing?.states ?? []), ...states])],
      slices: [
        ...(existing?.slices ?? []),
        ...slices.filter((slice) => {
          const sliceName = toDslId(slice.name || slice.title, 'Slice');
          return !(existing?.slices ?? []).some((existingSlice) => toDslId(existingSlice.name || existingSlice.title, 'Slice') === sliceName);
        })
      ]
    });
  };

  for (const aggregate of config.aggregates ?? []) {
    const aggregateId = toDslId(aggregate.name || aggregate.title, 'Aggregate');
    aggregateStates.set(aggregateId, aggregate.states ?? []);
    addConcept(aggregateId, aggregate.states ?? []);
  }

  for (const slice of config.slices ?? []) {
    const aggregateName =
      slice.aggregates?.[0]?.name ||
      slice.aggregates?.[0]?.title ||
      slice.commands?.[0]?.aggregate;
    if (!aggregateName) {
      directSlices.push(slice);
      continue;
    }
    const aggregateId = toDslId(aggregateName, 'Aggregate');
    grouped.set(aggregateId, [...(grouped.get(aggregateId) ?? []), slice]);
  }
  const concepts = config.concepts?.length ? config.concepts : deriveConcepts(config.slices ?? []);
  for (const concept of concepts) {
    addConcept(concept.name, concept.states ?? [], concept.slices ?? []);
  }
  for (const [conceptName, slices] of grouped) {
    addConcept(conceptName, aggregateStates.get(conceptName) ?? [], slices.map((slice) => ({ title: slice.title })));
  }

  const contextIndent = domainName ? 2 : 0;
  const childIndent = contextIndent + 2;
  const lines: string[] = [];

  if (domainName) {
    lines.push(`domain ${domainName} {`);
  }
  lines.push(`${pad(contextIndent)}context ${contextName} {`);
  for (const valueType of config.valueTypes ?? []) {
    appendValueType(lines, valueType, childIndent);
  }
  for (const slices of grouped.values()) {
    for (const slice of slices) appendSlice(lines, slice, childIndent);
  }
  for (const slice of directSlices) appendSlice(lines, slice, childIndent);
  for (const concept of conceptRecords.values()) {
    lines.push(`${pad(childIndent)}concept ${toDslId(concept.name, 'Concept')} {`);
    for (const state of concept.states ?? []) {
      lines.push(`${pad(childIndent + 2)}state ${toDslId(state, 'State')}`);
    }
    for (const slice of concept.slices ?? []) {
      lines.push(`${pad(childIndent + 2)}slice ${toDslId(slice.name || slice.title, 'Slice')}`);
    }
    lines.push(`${pad(childIndent)}}`);
  }
  lines.push(`${pad(contextIndent)}}`);
  if (domainName) {
    lines.push('}');
  }
  return lines.join('\n');
};

const appendValueType = (lines: string[], valueType: ConfigValueType, indent: number): void => {
  const name = toDslId(valueType.name, 'ValueType');
  if (valueType.kind === 'enum') {
    lines.push(`${pad(indent)}enum ${name} {`);
    for (const value of valueType.values ?? []) lines.push(`${pad(indent + 2)}${toDslId(value, 'Value')}`);
    lines.push(`${pad(indent)}}`);
    return;
  }
  if (valueType.kind === 'object') {
    lines.push(`${pad(indent)}value ${name} {`);
    for (const field of valueType.fields ?? []) lines.push(`${pad(indent + 2)}${formatField(field)}`);
    lines.push(`${pad(indent)}}`);
    return;
  }
  const baseType = toDslId(valueType.baseType, 'String');
  const constraints = valueType.constraints ?? [];
  if (constraints.length === 0) {
    lines.push(`${pad(indent)}type ${name} = ${baseType}`);
    return;
  }

  lines.push(`${pad(indent)}type ${name} = ${baseType} {`);
  for (const constraint of constraints) {
    lines.push(`${pad(indent + 2)}${formatValueTypeConstraint(constraint)}`);
  }
  lines.push(`${pad(indent)}}`);
};

const formatValueTypeConstraint = (constraint: ConfigValueTypeConstraint): string => {
  switch (constraint.kind) {
    case 'format':
      return `format ${constraint.format}`;
    case 'length':
      return `length ${constraint.min}..${constraint.max}`;
    case 'range':
      return `range ${constraint.min}..${constraint.max}`;
    case 'matches':
      return `matches ${quote(constraint.pattern)}`;
    case 'oneOf':
      return `oneOf ${constraint.values.map((value) => typeof value === 'string' ? quote(value) : String(value)).join(', ')}`;
  }
};

const deriveConcepts = (
  slices: ConfigSlice[]
): NonNullable<ConfigRoot['concepts']> => {
  const concepts = new Map<string, Array<{ name?: string; title?: string }>>();
  for (const slice of slices) {
    if (!slice.title) continue;
    for (const concept of slice.concepts ?? []) {
      concepts.set(concept, [...(concepts.get(concept) ?? []), { title: slice.title }]);
    }
  }
  return [...concepts].map(([name, conceptSlices]) => ({ name, states: [], slices: conceptSlices }));
};

const appendSlice = (lines: string[], slice: ConfigSlice, indent: number): void => {
  const elementIndent = indent + 2;
  lines.push(`${pad(indent)}slice ${toDslId(slice.title, 'Slice')} {`);
  if ((slice.tags ?? []).length > 0) {
    lines.push(`${pad(elementIndent)}tags {`);
    for (const tag of slice.tags ?? []) {
      const expression = tag.expression ? ` = ${tag.expression}` : '';
      lines.push(`${pad(elementIndent + 2)}${toDslId(tag.name, 'tag')}${expression}`);
    }
    lines.push(`${pad(elementIndent)}}`);
  }
  if (slice.commands?.some((command) => command.createsAggregate)) {
    lines.push(`${pad(elementIndent)}startsLifecycle`);
  }
  if (slice.port || slice.commands?.some((command) => command.port)) {
    lines.push(`${pad(elementIndent)}port`);
  }
  const screen = slice.screens?.[0];
  if (screen?.title) lines.push(...formatUi(screen, elementIndent));

  for (const command of slice.commands ?? []) appendElement(lines, 'command', command, elementIndent);
  for (const event of slice.events ?? []) appendElement(lines, 'event', event, elementIndent);
  if (slice.stateChange?.to) lines.push(`${pad(elementIndent)}state ${toDslId(slice.stateChange.to, 'State')}`);
  for (const readmodel of slice.readmodels ?? []) {
    appendElement(lines, 'readmodel', readmodel, elementIndent, readmodel.dependencies
      ?.filter((dependency) => dependency.elementType === 'EVENT' && dependency.title)
      .map((dependency) => `subscribe ${toDslId(dependency.title, 'Event')}`) ?? []);
  }
  for (const processor of slice.processors ?? []) {
    lines.push(`${pad(elementIndent)}automation ${toDslId(processor.title, 'Automation')} {`);
    for (const dependency of processor.dependencies ?? []) {
      if (dependency.elementType === 'COMMAND' && dependency.title) {
        lines.push(`${pad(elementIndent + 2)}emits ${toDslId(dependency.title, 'Command')}`);
      }
    }
    lines.push(`${pad(elementIndent)}}`);
  }
  appendSpecifications(lines, slice.specifications ?? [], elementIndent);
  lines.push(`${pad(indent)}}`);
};

const appendSpecifications = (
  lines: string[],
  specifications: ConfigSpecification[],
  indent: number
): void => {
  const grouped = new Map<string, ConfigSpecification[]>();
  for (const specification of specifications) {
    if (!specification.specification && !specification.rule) {
      appendSpecification(lines, specification, indent);
      continue;
    }
    const name = specification.specification || specification.title || 'Business rule';
    grouped.set(name, [...(grouped.get(name) ?? []), specification]);
  }

  for (const [name, scenarios] of grouped) {
    const definition = scenarios[0];
    lines.push(`${pad(indent)}specification ${quote(name)} {`);
    if (definition.rule?.trim()) {
      appendMultilineRule(lines, definition.rule, indent + 2);
    }
    if ((definition.expressions?.length ?? 0) > 0) {
      lines.push(`${pad(indent + 2)}expression {`);
      for (const expression of definition.expressions ?? []) {
        lines.push(`${pad(indent + 4)}${expression}`);
      }
      lines.push(`${pad(indent + 2)}}`);
    }
    for (const scenario of scenarios) appendScenario(lines, scenario, indent + 2);
    lines.push(`${pad(indent)}}`);
  }
};

const appendMultilineRule = (lines: string[], rule: string, indent: number): void => {
  lines.push(`${pad(indent)}rule """`);
  for (const line of rule.split(/\r?\n/)) lines.push(`${pad(indent + 2)}${line}`);
  lines.push(`${pad(indent)}"""`);
};

const appendScenario = (
  lines: string[],
  specification: ConfigSpecification,
  indent: number
): void => {
  lines.push(`${pad(indent)}scenario ${quote(specification.title || 'Scenario')} {`);
  appendSpecificationBody(lines, specification, indent + 2);
  lines.push(`${pad(indent)}}`);
};

const appendSpecification = (
  lines: string[],
  specification: ConfigSpecification,
  indent: number
): void => {
  lines.push(`${pad(indent)}specification ${quote(specification.title || 'Business rule')} {`);
  appendSpecificationBody(lines, specification, indent + 2);
  lines.push(`${pad(indent)}}`);
};

const appendSpecificationBody = (
  lines: string[],
  specification: ConfigSpecification,
  indent: number
): void => {
  const when = specification.when?.[0];
  const then = Array.isArray(specification.then)
    ? specification.then[0]
    : specification.then?.type === 'SPEC_ERROR'
      ? specification.then
      : undefined;
  if (!when?.title || !then?.title) return;

  for (const given of specification.given ?? []) {
    if (given.title) appendSpecificationGiven(lines, given, indent);
  }
  appendSpecificationWhen(lines, when, indent);
  if (!Array.isArray(specification.then) && specification.then?.type === 'SPEC_ERROR') {
    lines.push(`${pad(indent)}then reject ${quote(specification.then.description || specification.then.title || 'Rejected by domain rule')}`);
  } else {
    lines.push(`${pad(indent)}then ${toDslId(then.title, 'Event')}`);
  }
};

const appendSpecificationGiven = (
  lines: string[],
  given: ConfigSpecificationElement,
  indent: number
): void => {
  const examples = specificationExamples(given);
  const eventName = toDslId(given.title, 'Event');
  if (examples.length === 0) {
    lines.push(`${pad(indent)}given ${eventName}`);
    return;
  }

  lines.push(`${pad(indent)}given ${eventName} {`);
  appendSpecificationAssignments(lines, examples, indent + 2);
  lines.push(`${pad(indent)}}`);
};

const appendSpecificationWhen = (
  lines: string[],
  when: ConfigSpecificationElement,
  indent: number
): void => {
  const examples = specificationExamples(when);
  const commandName = toDslId(when.title, 'Command');
  if (examples.length === 0) {
    lines.push(`${pad(indent)}when ${commandName}`);
    return;
  }

  lines.push(`${pad(indent)}when ${commandName} {`);
  appendSpecificationAssignments(lines, examples, indent + 2);
  lines.push(`${pad(indent)}}`);
};

const specificationExamples = (
  element: ConfigSpecificationElement
): Array<{ name: string; example: string }> => (
  (element.fields ?? []).filter(
    (field): field is { name: string; example: string } => Boolean(field.name && field.example !== undefined)
  )
);

const appendSpecificationAssignments = (
  lines: string[],
  examples: Array<{ name: string; example: string }>,
  indent: number
): void => {
  for (const field of examples) {
    lines.push(`${pad(indent)}${toDslId(field.name, 'field')} = ${quote(field.example)}`);
  }
};

const formatUi = (screen: ConfigElement, indent: number): string[] => {
  const name = toDslId(screen.title, 'Screen');
  const type = screen.ui?.type ? ` ${screen.ui.type}` : '';
  return [`${pad(indent)}ui ${name}${type}`];
};

const pad = (indent: number): string => ' '.repeat(indent);

const appendElement = (lines: string[], kind: 'command' | 'event' | 'readmodel', element: ConfigElement, indent: number, extraLines: string[] = []): void => {
  const pad = ' '.repeat(indent);
  const listMarker = kind === 'readmodel' && element.listElement ? '[]' : '';
  lines.push(`${pad}${kind} ${toDslId(element.title, kind)}${listMarker} {`);
  if (kind === 'readmodel' && element.dictionaryProvider) {
    appendDictionaryProvider(lines, element.dictionaryProvider, indent + 2);
  }
  for (const field of element.fields ?? []) {
    lines.push(`${pad}  ${formatField(field)}`);
  }
  for (const extraLine of extraLines) {
    lines.push(`${pad}  ${extraLine}`);
  }
  lines.push(`${pad}}`);
};

const appendDictionaryProvider = (lines: string[], provider: ConfigDictionaryProvider, indent: number): void => {
  const pad = ' '.repeat(indent);
  lines.push(`${pad}dictionaryProvider ${toDslId(provider.name, 'DictionaryProvider')} {`);
  for (const key of ['code', 'value', 'label', 'active', 'state', 'order'] as const) {
    const field = provider[key];
    if (field) lines.push(`${pad}  ${key} ${toDslId(field, 'field')}`);
  }
  lines.push(`${pad}}`);
};

const formatField = (field: ConfigField): string => {
  const type = toDslType(field.type);
  const cardinality = field.cardinality === 'Multiple'
    ? field.optional ? '[]?' : '[]'
    : field.optional ? '?' : '';
  const attributes = [
    field.idAttribute ? 'id' : '',
    field.generated ? 'generated' : '',
    field.technicalAttribute ? 'technical' : '',
    field.query ? 'query' : ''
  ].filter(Boolean);
  const prefix = `${toDslId(field.name, 'field')}: ${type}${cardinality}${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
  const dictionary = field.dictionary ? ` dictionary ${quote(field.dictionary)}` : '';
  const mapping = formatMapping(field);
  if (field.example && !mapping.details) {
    return `${prefix}${dictionary}${mapping.inline} { example ${quote(field.example)} }`;
  }
  if (field.example && mapping.details) {
    return `${prefix}${dictionary}${mapping.inline} { ${mapping.details} example ${quote(field.example)} }`;
  }
  return `${prefix}${dictionary}${mapping.inline}${mapping.details ? ` { ${mapping.details} }` : ''}`;
};

const toDslType = (value: string | undefined): string => {
  const parts = (value || 'String').split('.').filter(Boolean);
  if (parts.length === 0) return 'String';
  return parts.map((part, index) => toDslId(part, index === 0 ? 'String' : 'Type')).join('.');
};

const formatMapping = (field: ConfigField): { inline: string; details?: string } => {
  const mapping = field.mappings?.[0];
  if (typeof mapping === 'string') {
    return { inline: ` from ${formatSources([mapping])}` };
  }
  if (!mapping) {
    return { inline: field.derived ? ' derived' : '' };
  }

  const sources = mapping.from ?? [];
  if (mapping.type !== 'DERIVED') {
    return { inline: sources.length ? ` from ${formatSources(sources)}` : '' };
  }
  if (!mapping.rule && !mapping.lookup) {
    return { inline: sources.length ? ` derived from ${formatSources(sources)}` : ' derived' };
  }

  const lookupDetails = formatLookupDetails(mapping.lookup);
  return {
    inline: ' derived',
    details: [
      sources.length ? `from ${formatSources(sources)}` : '',
      lookupDetails,
      mapping.rule ? `rule ${quote(mapping.rule)}` : ''
    ].filter(Boolean).join(' ')
  };
};

const formatLookupDetails = (lookup?: ConfigDerivedLookup): string => {
  if (!lookup) return '';
  return [
    lookup.key ? `lookup key ${formatSources([lookup.key])}` : '',
    lookup.sourceEvent ? `source event ${toDslId(lookup.sourceEvent, 'Event')}` : '',
    lookup.sourceField ? `source field ${formatSources([lookup.sourceField])}` : '',
    lookup.targetField ? `target field ${formatSources([lookup.targetField])}` : '',
    lookup.cacheProjection ? `cache projection ${toDslId(lookup.cacheProjection, 'Projection')}` : '',
    lookup.cacheStrategy ? `cache strategy ${toDslId(lookup.cacheStrategy, 'Strategy')}` : '',
    lookup.missingValuePolicy ? `missing policy ${toDslId(lookup.missingValuePolicy, 'policy')}` : ''
  ].filter(Boolean).join(' ');
};

const formatSources = (sources: string[]): string =>
  sources
    .map((source) => source.split('.').map((part) => toDslId(part, 'Source')).join('.'))
    .join(', ');

const runCli = (): void => {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run config:to-medol -- ../b-config.json');
    process.exitCode = 1;
    return;
  }

  const config = JSON.parse(readFileSync(input, 'utf8')) as ConfigRoot;
  console.log(`// Generated from ${quote(basename(input))}`);
  console.log(configToDsl(config));
};

if (process.argv[1]?.endsWith('configToDsl.ts')) {
  runCli();
}
