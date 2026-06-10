import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { quote, toDslId } from './name';

interface ConfigField {
  name?: string;
  type?: string;
  example?: string;
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
}

interface ConfigElement {
  title?: string;
  aggregate?: string;
  createsAggregate?: boolean;
  listElement?: boolean;
  fields?: ConfigField[];
  dependencies?: Array<{ type?: string; title?: string; elementType?: string }>;
  ui?: ConfigUi;
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
}

interface ConfigAggregate {
  name?: string;
  title?: string;
  states?: string[];
}

interface ConfigRoot {
  domain?: string;
  context?: string;
  aggregates?: ConfigAggregate[];
  slices?: ConfigSlice[];
}

export const configToDsl = (config: ConfigRoot): string => {
  const domainName = config.domain ? toDslId(config.domain, 'Domain') : undefined;
  const contextName = toDslId(config.context || config.slices?.[0]?.context || 'EventModel');
  const grouped = new Map<string, ConfigSlice[]>();
  const aggregateStates = new Map<string, string[]>();

  for (const aggregate of config.aggregates ?? []) {
    const aggregateId = toDslId(aggregate.name || aggregate.title, 'Aggregate');
    aggregateStates.set(aggregateId, aggregate.states ?? []);
  }

  for (const slice of config.slices ?? []) {
    const aggregateName =
      slice.aggregates?.[0]?.name ||
      slice.aggregates?.[0]?.title ||
      slice.commands?.[0]?.aggregate ||
      'Default';
    const aggregateId = toDslId(aggregateName, 'Aggregate');
    grouped.set(aggregateId, [...(grouped.get(aggregateId) ?? []), slice]);
  }

  const contextIndent = domainName ? 2 : 0;
  const aggregateIndent = contextIndent + 2;
  const sliceIndent = aggregateIndent + 2;
  const elementIndent = sliceIndent + 2;
  const lines: string[] = [];

  if (domainName) {
    lines.push(`domain ${domainName} {`);
  }
  lines.push(`${pad(contextIndent)}context ${contextName} {`);
  for (const [aggregateName, slices] of grouped) {
    lines.push(`${pad(aggregateIndent)}aggregate ${aggregateName} {`);
    for (const state of aggregateStates.get(aggregateName) ?? []) {
      lines.push(`${pad(aggregateIndent + 2)}state ${toDslId(state, 'State')}`);
    }
    for (const slice of slices) {
      lines.push(`${pad(sliceIndent)}slice ${toDslId(slice.title, 'Slice')} {`);
      if (slice.commands?.some((command) => command.createsAggregate)) {
        lines.push(`${pad(elementIndent)}createsAggregate`);
      }
      const screen = slice.screens?.[0];
      if (screen?.title) {
        lines.push(...formatUi(screen, elementIndent));
      }

      for (const command of slice.commands ?? []) {
        appendElement(lines, 'command', command, elementIndent);
      }
      for (const event of slice.events ?? []) {
        appendElement(lines, 'event', event, elementIndent);
      }
      appendSpecificationErrors(lines, slice.specifications ?? [], elementIndent);
      if (slice.stateChange?.to) {
        lines.push(`${pad(elementIndent)}state ${toDslId(slice.stateChange.to, 'State')}`);
      }
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
      for (const specification of slice.specifications ?? []) {
        appendSpecification(lines, specification, elementIndent);
      }
      lines.push(`${pad(sliceIndent)}}`);
    }
    lines.push(`${pad(aggregateIndent)}}`);
  }
  lines.push(`${pad(contextIndent)}}`);
  if (domainName) {
    lines.push('}');
  }
  return lines.join('\n');
};

const appendSpecificationErrors = (
  lines: string[],
  specifications: ConfigSpecification[],
  indent: number
): void => {
  const seen = new Set<string>();
  for (const specification of specifications) {
    if (Array.isArray(specification.then) || specification.then?.type !== 'SPEC_ERROR') continue;
    const name = toDslId(specification.then.title || specification.title, 'DomainError');
    if (seen.has(name)) continue;
    seen.add(name);
    const description = specification.then.description ? ` ${quote(specification.then.description)}` : '';
    lines.push(`${pad(indent)}error ${name}${description}`);
  }
};

const appendSpecification = (
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

  lines.push(`${pad(indent)}specification ${quote(specification.title || 'Business rule')} {`);
  for (const given of specification.given ?? []) {
    if (given.title) appendSpecificationGiven(lines, given, indent + 2);
  }
  appendSpecificationWhen(lines, when, indent + 2);
  if (!Array.isArray(specification.then) && specification.then?.type === 'SPEC_ERROR') {
    lines.push(`${pad(indent + 2)}then error ${toDslId(then.title, 'DomainError')}`);
  } else {
    lines.push(`${pad(indent + 2)}then ${toDslId(then.title, 'Event')}`);
  }
  lines.push(`${pad(indent)}}`);
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
  for (const field of element.fields ?? []) {
    lines.push(`${pad}  ${formatField(field)}`);
  }
  for (const extraLine of extraLines) {
    lines.push(`${pad}  ${extraLine}`);
  }
  lines.push(`${pad}}`);
};

const formatField = (field: ConfigField): string => {
  const type = toDslId(field.type, 'String');
  const cardinality = field.cardinality === 'Multiple' ? '[]' : field.optional ? '?' : '';
  const attributes = [
    field.idAttribute ? 'id' : '',
    field.generated ? 'generated' : '',
    field.technicalAttribute ? 'technical' : '',
    field.query ? 'query' : ''
  ].filter(Boolean);
  const prefix = `${toDslId(field.name, 'field')}: ${type}${cardinality}${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
  const mapping = formatMapping(field);
  if (field.example && !mapping.details) {
    return `${prefix}${mapping.inline} { example ${quote(field.example)} }`;
  }
  if (field.example && mapping.details) {
    return `${prefix}${mapping.inline} { ${mapping.details} example ${quote(field.example)} }`;
  }
  return `${prefix}${mapping.inline}${mapping.details ? ` { ${mapping.details} }` : ''}`;
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
  if (!mapping.rule) {
    return { inline: sources.length ? ` derived from ${formatSources(sources)}` : ' derived' };
  }

  return {
    inline: ' derived',
    details: `${sources.length ? `from ${formatSources(sources)} ` : ''}rule ${quote(mapping.rule)}`
  };
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
