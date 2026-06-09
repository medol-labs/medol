import { humanize } from '../../name';
import type {
  DocumentationBundle,
  DocumentationField,
  DocumentationWorkflow
} from './documentationModel';

export const renderSoftwareDesignMarkdown = (bundle: DocumentationBundle): string => {
  const lines = header(bundle, 'Software Design');

  section(lines, 'Architecture Overview');
  lines.push('The system is organized around bounded contexts, event-driven aggregate workflows, read-side projections, policies, automations, and external integrations.');
  lines.push('');
  appendDiagnostics(lines, bundle);

  section(lines, 'Bounded Contexts');
  lines.push('| Context | Domain | Aggregates | Notes |');
  lines.push('| --- | --- | --- | --- |');
  for (const context of bundle.contexts) {
    lines.push(`| ${cell(humanize(context.name))} | ${cell(context.domain ? humanize(context.domain) : '-')} | ${cell(context.aggregates.map((aggregate) => humanize(aggregate.name)).join(', ') || '-')} | ${cell(context.notes.join('; ') || '-')} |`);
  }
  lines.push('');

  section(lines, 'Aggregate Design');
  for (const context of bundle.contexts) {
    for (const aggregate of context.aggregates) {
      lines.push(`### ${humanize(aggregate.name)}`);
      lines.push('');
      lines.push(`Bounded context: ${humanize(context.name)}`);
      lines.push('');
      lines.push(`Lifecycle: ${aggregate.states.length ? aggregate.states.map(humanize).join(' -> ') : 'Not explicitly modeled'}`);
      lines.push('');
      lines.push(`Capabilities: ${aggregate.sliceNames.map(humanize).join(', ') || 'None modeled'}`);
      lines.push('');
    }
  }

  section(lines, 'Application Flows');
  lines.push('| Context | Aggregate | Capability | Input | Result | Read Side | Trigger |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const workflow of bundle.workflows) {
    const result = workflow.events.map((item) => humanize(item.name)).join(', ')
      || (workflow.resultingState ? humanize(workflow.resultingState) : '-');
    lines.push(`| ${cell(humanize(workflow.context))} | ${cell(humanize(workflow.aggregate))} | ${cell(humanize(workflow.slice))} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(result)} | ${cell(workflow.projections.map(humanize).join(', ') || '-')} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || 'System')} |`);
  }
  lines.push('');

  section(lines, 'UI Composition');
  const uiWorkflows = bundle.workflows.filter((workflow) => workflow.ui);
  if (uiWorkflows.length) {
    lines.push('| View | Interaction | Capability | Command | Read Model |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const workflow of uiWorkflows) {
      lines.push(`| ${cell(humanize(workflow.ui?.name ?? ''))} | ${cell(workflow.ui?.type ?? 'unspecified')} | ${cell(humanize(workflow.slice))} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(workflow.projections.map(humanize).join(', ') || '-')} |`);
    }
  } else {
    lines.push('No UI views are explicitly modeled.');
  }
  lines.push('');

  section(lines, 'Automation And Integration');
  appendList(lines, [
    ...bundle.workflows.flatMap((workflow) =>
      workflow.processors.map((processor) =>
        `${humanize(processor)} participates in ${humanize(workflow.slice)}.`
      )
    ),
    ...bundle.integrations.map((integration) =>
      `${humanize(integration.name)}: ${integration.source ?? 'unspecified source'} -> ${integration.target ?? 'unspecified target'}.`
    )
  ], 'No automations or integrations are explicitly modeled.');
  lines.push('');

  section(lines, 'Quality Attributes And Decisions');
  for (const context of bundle.contexts) {
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    appendLabeledList(lines, 'Decisions', context.decisions);
    appendLabeledList(lines, 'Risks', context.risks);
    appendLabeledList(lines, 'Metrics', context.metrics.map(humanize));
  }

  section(lines, 'Implementation Gaps');
  appendList(lines, collectGaps(bundle), 'No structural gaps were detected.');
  lines.push('');
  return lines.join('\n');
};

export const renderDatabaseDesignMarkdown = (bundle: DocumentationBundle): string => {
  const lines = header(bundle, 'Projection Database Design');
  section(lines, 'Design Scope');
  lines.push('This document describes the read-side data model inferred from Event Modeling projections. Storage engines, physical table names, retention, and consistency SLAs remain implementation decisions unless explicitly stated.');
  lines.push('');
  appendDiagnostics(lines, bundle);

  section(lines, 'Projection Inventory');
  lines.push('| Projection | Context | Aggregate | Shape | Source Events |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const projection of bundle.projections) {
    lines.push(`| ${cell(humanize(projection.name))} | ${cell(humanize(projection.context))} | ${cell(humanize(projection.aggregate))} | ${projection.collection ? 'Collection' : 'Single record'} | ${cell(projection.sourceEvents.map(humanize).join(', ') || 'Not modeled')} |`);
  }
  lines.push('');

  for (const projection of bundle.projections) {
    lines.push(`<!-- em:section id="database.projection.${projection.name}" source="${projection.id}" -->`);
    lines.push(`## ${humanize(projection.name)}`);
    lines.push('');
    lines.push(`Owner: ${humanize(projection.context)} / ${humanize(projection.aggregate)} / ${humanize(projection.slice)}`);
    lines.push('');
    lines.push(`Logical shape: ${projection.collection ? 'collection/list read model' : 'single-record read model'}`);
    lines.push('');
    lines.push(`Updated by: ${projection.sourceEvents.map(humanize).join(', ') || 'No subscribed event is explicitly modeled'}`);
    lines.push('');
    appendFieldTable(lines, projection.fields);
    lines.push('### Keys And Access Paths');
    lines.push('');
    appendList(lines, [
      projection.identifierFields.length
        ? `Logical identifier: ${projection.identifierFields.join(', ')}.`
        : 'Logical identifier is not explicitly marked; confirm the projection key.',
      projection.queryFields.length
        ? `Candidate query indexes: ${projection.queryFields.join(', ')}.`
        : 'No query fields are explicitly marked; derive indexes from API and UI access patterns.',
      projection.collection
        ? 'Provide deterministic ordering and pagination for collection access.'
        : 'Define uniqueness and upsert behavior for the single-record view.'
    ]);
    lines.push('');
    lines.push('### Update Semantics');
    lines.push('');
    appendList(lines, [
      'Apply subscribed events idempotently.',
      'Track event position or version when replay and recovery are required.',
      'Confirm deletion, retention, backfill, and rebuild behavior.',
      ...projection.fields
        .filter((field) => field.mapping)
        .map((field) => `${field.name}: ${formatMapping(field)}.`)
    ]);
    lines.push('');
  }

  section(lines, 'Cross-Cutting Database Decisions');
  appendList(lines, [
    'Choose storage technology per projection access pattern rather than treating projections as aggregate persistence.',
    'Separate write-model transaction boundaries from eventually consistent read-model updates.',
    'Define projection rebuild, schema migration, observability, and failure recovery procedures.',
    'Validate personally identifiable or sensitive fields and define masking and retention controls.'
  ]);
  lines.push('');
  return lines.join('\n');
};

export const renderProcessMarkdown = (bundle: DocumentationBundle): string => {
  const lines = header(bundle, 'Business Process');
  section(lines, 'End-To-End Overview');
  lines.push('```mermaid');
  lines.push('flowchart LR');
  for (const [index, workflow] of bundle.workflows.entries()) {
    const nodeId = `W${index + 1}`;
    lines.push(`  ${nodeId}["${mermaidLabel(humanize(workflow.slice))}"]`);
    if (index > 0 && bundle.workflows[index - 1].context === workflow.context) {
      lines.push(`  W${index} --> ${nodeId}`);
    }
  }
  lines.push('```');
  lines.push('');

  for (const context of bundle.contexts) {
    section(lines, `${humanize(context.name)} Process`);
    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    lines.push('| Step | Actor / Trigger | Interaction | Command | Event / State | Read Model | Rules |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    workflows.forEach((workflow, index) => {
      lines.push(`| ${index + 1} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || 'System')} | ${cell(workflow.ui ? `${humanize(workflow.ui.name)} (${workflow.ui.type ?? 'unspecified'})` : '-')} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell([
        ...workflow.events.map((item) => humanize(item.name)),
        ...(workflow.resultingState ? [`state: ${humanize(workflow.resultingState)}`] : [])
      ].join(', ') || '-')} | ${cell(workflow.projections.map(humanize).join(', ') || '-')} | ${cell(workflow.specifications.map((specification) => humanize(specification.name)).join(', ') || '-')} |`);
    });
    lines.push('');

    for (const workflow of workflows) {
      appendWorkflow(lines, workflow);
    }
  }

  section(lines, 'Process Risks And Open Questions');
  appendList(lines, [
    ...bundle.contexts.flatMap((context) => context.risks),
    ...bundle.workflows.flatMap((workflow) =>
      workflow.hotspots.map((hotspot) => `${humanize(workflow.slice)}: ${hotspot}`)
    ),
    ...collectGaps(bundle)
  ], 'No process risks or open questions are explicitly modeled.');
  lines.push('');
  return lines.join('\n');
};

const appendWorkflow = (lines: string[], workflow: DocumentationWorkflow): void => {
  lines.push(`### ${humanize(workflow.slice)}`);
  lines.push('');
  lines.push(`Aggregate: ${humanize(workflow.aggregate)}`);
  lines.push('');
  if (workflow.createsAggregate) lines.push(`- Creates a new ${humanize(workflow.aggregate)}.`);
  if (workflow.actor) lines.push(`- Initiated by ${humanize(workflow.actor)}.`);
  if (workflow.ui) lines.push(`- Interaction: ${humanize(workflow.ui.name)} (${workflow.ui.type ?? 'unspecified'}).`);
  for (const command of workflow.commands) lines.push(`- Command: ${humanize(command.name)}.`);
  for (const event of workflow.events) lines.push(`- Event: ${humanize(event.name)}.`);
  if (workflow.resultingState) lines.push(`- Resulting state: ${humanize(workflow.resultingState)}.`);
  for (const projection of workflow.projections) lines.push(`- Read-side result: ${humanize(projection)}.`);
  lines.push('');
  if (workflow.specifications.length) {
    lines.push('Acceptance scenarios:');
    lines.push('');
    for (const specification of workflow.specifications) {
      lines.push(`- ${humanize(specification.name)}: given ${specification.given.map(humanize).join(', ') || 'unspecified precondition'}, when ${specification.when ? humanize(specification.when) : 'unspecified action'}, then ${specification.then ? humanize(specification.then) : 'unspecified result'}.`);
    }
    lines.push('');
  }
};

const appendFieldTable = (lines: string[], fields: DocumentationField[]): void => {
  lines.push('### Logical Schema');
  lines.push('');
  if (!fields.length) {
    lines.push('No projection fields are explicitly modeled.');
    lines.push('');
    return;
  }
  lines.push('| Field | Type | Cardinality | Attributes | Example | Source / Derivation |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const field of fields) {
    lines.push(`| ${cell(field.name)} | ${cell(field.type)} | ${cell(field.cardinality)} | ${cell(field.attributes.join(', ') || '-')} | ${cell(field.example ?? '-')} | ${cell(field.mapping ? formatMapping(field) : '-')} |`);
  }
  lines.push('');
};

const formatMapping = (field: DocumentationField): string => {
  if (!field.mapping) return '-';
  const source = field.mapping.sources.length ? ` from ${field.mapping.sources.join(', ')}` : '';
  const rule = field.mapping.rule ? `; rule: ${field.mapping.rule}` : '';
  return `${field.mapping.kind}${source}${rule}`;
};

const collectGaps = (bundle: DocumentationBundle): string[] => [
  ...bundle.workflows
    .filter((workflow) => workflow.commands.length > 0 && workflow.events.length === 0)
    .map((workflow) => `${humanize(workflow.slice)} has a command but no explicit result event.`),
  ...summarizeMissingSpecifications(bundle),
  ...bundle.projections
    .filter((projection) => projection.sourceEvents.length === 0)
    .map((projection) => `${humanize(projection.name)} has no explicit event subscription.`),
  ...bundle.projections
    .filter((projection) => projection.identifierFields.length === 0)
    .map((projection) => `${humanize(projection.name)} has no field marked as an identifier.`)
];

const summarizeMissingSpecifications = (bundle: DocumentationBundle): string[] => {
  const missingByContext = new Map<string, string[]>();
  for (const workflow of bundle.workflows) {
    if (workflow.commands.length === 0 || workflow.specifications.length > 0) continue;
    const names = missingByContext.get(workflow.context) ?? [];
    names.push(humanize(workflow.slice));
    missingByContext.set(workflow.context, names);
  }

  return [...missingByContext.entries()].map(([context, names]) => {
    const examples = names.slice(0, 4).join(', ');
    const remainder = names.length > 4 ? ` and ${names.length - 4} more` : '';
    return `${humanize(context)} has ${names.length} command workflows without explicit acceptance specifications: ${examples}${remainder}.`;
  });
};

const header = (bundle: DocumentationBundle, suffix: string): string[] => [
  `# ${bundle.title} ${suffix}`,
  '',
  `Generated from Event Modeling DSL at ${bundle.generatedAt}.`,
  ''
];

const section = (lines: string[], title: string): void => {
  lines.push(`## ${title}`);
  lines.push('');
};

const appendDiagnostics = (lines: string[], bundle: DocumentationBundle): void => {
  if (!bundle.diagnostics.length) return;
  lines.push('> The DSL contains diagnostics. Treat affected sections as incomplete until these are resolved.');
  lines.push('');
  appendList(lines, bundle.diagnostics);
  lines.push('');
};

const appendLabeledList = (lines: string[], label: string, values: string[]): void => {
  lines.push(`**${label}**`);
  lines.push('');
  appendList(lines, values, `No ${label.toLowerCase()} are explicitly modeled.`);
  lines.push('');
};

const appendList = (lines: string[], values: string[], emptyText?: string): void => {
  if (!values.length) {
    if (emptyText) lines.push(emptyText);
    return;
  }
  for (const value of values) lines.push(`- ${value}`);
};

const cell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mermaidLabel = (value: string): string => value.replace(/"/g, "'");
