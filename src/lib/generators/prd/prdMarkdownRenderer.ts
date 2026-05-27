import { humanize } from '../../name';
import type { PrdDocument, PrdField, PrdSlice } from './prdModel';

export const renderPrdMarkdown = (document: PrdDocument): string => {
  const lines: string[] = [];

  lines.push(`# ${document.title} PRD`);
  lines.push('');
  lines.push('<!-- em:section id="prd.section.overview" -->');
  lines.push('## Product Overview');
  lines.push('');
  lines.push(document.overview);
  lines.push('');
  if (document.notes.length) {
    lines.push('### Notes');
    lines.push('');
    appendList(lines, document.notes);
    lines.push('');
  }

  lines.push('<!-- em:section id="prd.section.actors" -->');
  lines.push('## Actors');
  lines.push('');
  appendList(lines, document.actors.map((actor) => humanize(actor.name)), 'No actors are explicitly modeled yet.');
  lines.push('');

  lines.push('<!-- em:section id="prd.section.aggregates" -->');
  lines.push('## Core Business Objects');
  lines.push('');
  if (document.aggregates.length) {
    for (const aggregate of document.aggregates) {
      lines.push(`### ${humanize(aggregate.name)}`);
      lines.push('');
      lines.push(`Source: \`${aggregate.id}\``);
      lines.push('');
      if (aggregate.states.length) {
        lines.push('Lifecycle states:');
        appendList(lines, aggregate.states.map(humanize));
      } else {
        lines.push('Lifecycle states are not explicitly modeled yet.');
      }
      lines.push('');
    }
  } else {
    lines.push('No aggregates are explicitly modeled yet.');
    lines.push('');
  }

  lines.push('## Functional Requirements');
  lines.push('');
  for (const slice of document.slices) {
    appendSlice(lines, slice);
  }

  lines.push('<!-- em:section id="prd.section.dataDictionary" -->');
  lines.push('## Data Dictionary');
  lines.push('');
  if (document.dataDictionary.length) {
    lines.push('| Owner | Field | Type | Cardinality | Attributes | Mapping |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const field of document.dataDictionary) {
      lines.push(`| ${escapeTable(humanize(field.owner))} | ${escapeTable(field.name)} | ${escapeTable(field.type)} | ${escapeTable(field.cardinality)} | ${escapeTable(field.attributes.join(', ') || '-')} | ${escapeTable(field.mapping ?? '-')} |`);
    }
  } else {
    lines.push('No fields are explicitly modeled yet.');
  }
  lines.push('');

  lines.push('<!-- em:section id="prd.section.automations" -->');
  lines.push('## Automation, Policies, And Integrations');
  lines.push('');
  if (document.automations.length) {
    for (const automation of document.automations) {
      lines.push(`### ${humanize(automation.name)}`);
      lines.push('');
      lines.push(`Type: ${humanize(automation.kind)}`);
      lines.push('');
      const metadata = Object.entries(automation.metadata);
      if (metadata.length) {
        appendList(lines, metadata.map(([key, value]) => `${key}: ${value}`));
        lines.push('');
      }
    }
  } else {
    lines.push('No automation, policies, or integrations are explicitly modeled yet.');
    lines.push('');
  }

  lines.push('<!-- em:section id="prd.section.risks" -->');
  lines.push('## Risks And Decisions');
  lines.push('');
  lines.push('### Risks');
  lines.push('');
  appendList(lines, document.risks, 'No risks are explicitly modeled yet.');
  lines.push('');
  lines.push('### Decisions');
  lines.push('');
  appendList(lines, document.decisions, 'No decisions are explicitly modeled yet.');
  lines.push('');
  lines.push('### Metrics');
  lines.push('');
  appendList(lines, document.metrics.map(humanize), 'No metrics are explicitly modeled yet.');
  lines.push('');

  lines.push('<!-- em:section id="prd.section.openQuestions" -->');
  lines.push('## Open Questions');
  lines.push('');
  appendList(lines, document.openQuestions, 'No open questions were generated.');
  lines.push('');

  return lines.join('\n');
};

const appendSlice = (lines: string[], slice: PrdSlice): void => {
  lines.push(`<!-- em:section id="prd.section.slice.${slice.name}" source="${slice.id}" -->`);
  lines.push(`### ${humanize(slice.name)}`);
  lines.push('');
  lines.push(`Aggregate: ${humanize(slice.aggregate)}`);
  if (slice.actor) lines.push(`Actor: ${humanize(slice.actor)}`);
  if (slice.ui) lines.push(`Screen: ${humanize(slice.ui)}`);
  if (slice.command) lines.push(`Command: ${humanize(slice.command.name)}`);
  if (slice.event) lines.push(`Result Event: ${humanize(slice.event.name)}`);
  if (slice.resultingState) lines.push(`Result State: ${humanize(slice.resultingState)}`);
  if (slice.createsAggregate) lines.push('Creates Aggregate: yes');
  lines.push('');

  lines.push('User story:');
  lines.push('');
  lines.push(buildUserStory(slice));
  lines.push('');

  lines.push('Acceptance criteria:');
  appendList(lines, buildAcceptanceCriteria(slice), 'Acceptance criteria are not explicitly modeled yet.');
  lines.push('');

  if (slice.businessRules.length) {
    lines.push('Business rules:');
    appendList(lines, slice.businessRules);
    lines.push('');
  }

  if (slice.projectionNames.length) {
    lines.push('Read models:');
    appendList(lines, slice.projectionNames.map(humanize));
    lines.push('');
  }

  if (slice.hotspots.length) {
    lines.push('Hotspots:');
    appendList(lines, slice.hotspots);
    lines.push('');
  }

  appendFields(lines, 'Command fields', slice.command?.fields ?? []);
  appendFields(lines, 'Event fields', slice.event?.fields ?? []);
};

const buildUserStory = (slice: PrdSlice): string => {
  const actor = slice.actor ? `${articleFor(humanize(slice.actor))} ${humanize(slice.actor)}` : 'a user or system actor';
  const action = slice.command
    ? humanize(slice.command.name).toLowerCase()
    : slice.projectionNames.length
      ? `view ${slice.projectionNames.map(humanize).join(', ')}`
      : humanize(slice.name).toLowerCase();
  const outcome = slice.event
    ? `so that ${humanize(slice.event.name).toLowerCase()} is recorded`
    : slice.projectionNames.length
      ? `so that ${slice.projectionNames.map(humanize).join(', ')} can be viewed`
      : `so that the ${humanize(slice.aggregate).toLowerCase()} workflow can progress`;
  return `As ${actor}, I want to ${action} ${outcome}.`;
};

const buildAcceptanceCriteria = (slice: PrdSlice): string[] => {
  const criteria: string[] = [];
  if (slice.command && slice.event) {
    criteria.push(`When ${humanize(slice.command.name)} succeeds, ${humanize(slice.event.name)} is produced.`);
  }
  if (slice.resultingState) {
    criteria.push(`The ${humanize(slice.aggregate)} state becomes ${humanize(slice.resultingState)}.`);
  }
  if (slice.createsAggregate) {
    criteria.push(`A new ${humanize(slice.aggregate)} instance is created.`);
  }
  for (const rule of slice.businessRules) {
    criteria.push(rule);
  }
  return criteria;
};

const appendFields = (lines: string[], title: string, fields: PrdField[]): void => {
  if (!fields.length) return;
  lines.push(`${title}:`);
  appendList(lines, fields.map((field) => `${field.name}: ${field.type}${field.cardinality === 'Single' ? '' : ` (${field.cardinality})`}`));
  lines.push('');
};

const appendList = (lines: string[], values: string[], emptyText?: string): void => {
  if (!values.length) {
    if (emptyText) lines.push(emptyText);
    return;
  }
  for (const value of values) {
    lines.push(`- ${value}`);
  }
};

const articleFor = (value: string): string => /^[aeiou]/i.test(value) ? 'an' : 'a';

const escapeTable = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
