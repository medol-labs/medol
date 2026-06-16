import { humanize } from '../../name';
import type {
  DocumentationBundle,
  DocumentationField,
  DocumentationLanguage,
  DocumentationWorkflow
} from './documentationModel';

export const renderSoftwareDesignMarkdown = (bundle: DocumentationBundle): string => {
  const lines = header(bundle, 'Software Design');

  section(lines, 'Architecture Overview');
  lines.push('The system is organized around bounded contexts, event-driven aggregate workflows, read models, policies, automations, and external integrations.');
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
      lines.push(`<!-- em:section id="software.aggregate.${aggregate.name}" source="${aggregate.id}" -->`);
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
    lines.push(`| ${cell(humanize(workflow.context))} | ${cell(humanize(workflow.aggregate))} | ${cell(humanize(workflow.slice))} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(result)} | ${cell(workflow.readmodels.map(humanize).join(', ') || '-')} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || 'System')} |`);
  }
  lines.push('');

  section(lines, 'UI Composition');
  const uiWorkflows = bundle.workflows.filter((workflow) => workflow.ui);
  if (uiWorkflows.length) {
    lines.push('| View | Interaction | Capability | Command | Read Model |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const workflow of uiWorkflows) {
      lines.push(`| ${cell(humanize(workflow.ui?.name ?? ''))} | ${cell(workflow.ui?.type ?? 'unspecified')} | ${cell(humanize(workflow.slice))} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(workflow.readmodels.map(humanize).join(', ') || '-')} |`);
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
    lines.push(`<!-- em:section id="software.context.${context.name}" source="${context.id}" -->`);
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

export const renderDatabaseDesignMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const zh = language === 'zh-CN';
  const text = databaseText[language];
  const lines = header(bundle, text.title);
  section(lines, text.designScope);
  lines.push(text.designScopeBody);
  lines.push('');
  appendDiagnostics(lines, bundle);

  section(lines, text.inventory);
  lines.push(`| ${text.readModel} | ${text.context} | ${text.aggregate} | ${text.shape} | ${text.sourceEvents} |`);
  lines.push('| --- | --- | --- | --- | --- |');
  for (const readmodel of bundle.readmodels) {
    lines.push(`| ${cell(humanize(readmodel.name))} | ${cell(humanize(readmodel.context))} | ${cell(humanize(readmodel.aggregate))} | ${readmodel.collection ? text.collection : text.singleRecord} | ${cell(readmodel.sourceEvents.map(humanize).join(', ') || text.notModeled)} |`);
  }
  lines.push('');

  for (const readmodel of bundle.readmodels) {
    lines.push(`<!-- em:section id="database.readmodel.${readmodel.name}" sources="${readmodel.id} ${readmodel.sliceId}" -->`);
    lines.push(`## ${humanize(readmodel.name)}`);
    lines.push('');
    lines.push(`${text.owner}${text.labelSeparator} ${humanize(readmodel.context)} / ${humanize(readmodel.aggregate)} / ${humanize(readmodel.slice)}`);
    lines.push('');
    lines.push(`${text.logicalShape}${text.labelSeparator} ${readmodel.collection ? text.collectionReadModel : text.singleRecordReadModel}`);
    lines.push('');
    lines.push(`${text.updatedBy}${text.labelSeparator} ${readmodel.sourceEvents.map(humanize).join(', ') || text.noSubscribedEvent}`);
    lines.push('');
    appendFieldTable(lines, readmodel.fields, language);
    lines.push(`### ${text.keysAndAccessPaths}`);
    lines.push('');
    appendList(lines, [
      readmodel.identifierFields.length
        ? text.logicalIdentifier(readmodel.identifierFields.join(', '))
        : text.noLogicalIdentifier,
      readmodel.queryFields.length
        ? text.candidateQueryIndexes(readmodel.queryFields.join(', '))
        : text.noQueryFields,
      readmodel.collection
        ? text.collectionAccess
        : text.singleRecordAccess
    ]);
    lines.push('');
    lines.push(`### ${text.updateSemantics}`);
    lines.push('');
    appendList(lines, [
      text.applyIdempotently,
      text.trackEventPosition,
      text.confirmRebuild,
      ...readmodel.fields
        .filter((field) => field.mapping)
        .map((field) => `${field.name}: ${formatMapping(field, zh)}.`)
    ]);
    lines.push('');
  }

  section(lines, text.crossCuttingDecisions);
  appendList(lines, [
    text.storageDecision,
    text.boundaryDecision,
    text.rebuildDecision,
    text.sensitiveDataDecision
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
    lines.push(`<!-- em:section id="process.context.${context.name}" source="${context.id}" -->`);
    section(lines, `${humanize(context.name)} Process`);
    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    lines.push('| Step | Actor / Trigger | Interaction | Command | Event / State | Read Model | Rules |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    workflows.forEach((workflow, index) => {
      lines.push(`| ${index + 1} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || 'System')} | ${cell(workflow.ui ? `${humanize(workflow.ui.name)} (${workflow.ui.type ?? 'unspecified'})` : '-')} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell([
        ...workflow.events.map((item) => humanize(item.name)),
        ...(workflow.resultingState ? [`state: ${humanize(workflow.resultingState)}`] : [])
      ].join(', ') || '-')} | ${cell(workflow.readmodels.map(humanize).join(', ') || '-')} | ${cell(workflow.specifications.map((specification) => humanize(specification.name)).join(', ') || '-')} |`);
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
  lines.push(`<!-- em:section id="process.slice.${workflow.slice}" source="${workflow.id}" -->`);
  lines.push(`### ${humanize(workflow.slice)}`);
  lines.push('');
  lines.push(`Aggregate: ${humanize(workflow.aggregate)}`);
  lines.push('');
  if (workflow.startsLifecycle) lines.push(`- Starts the ${humanize(workflow.aggregate)} lifecycle.`);
  if (workflow.actor) lines.push(`- Initiated by ${humanize(workflow.actor)}.`);
  if (workflow.ui) lines.push(`- Interaction: ${humanize(workflow.ui.name)} (${workflow.ui.type ?? 'unspecified'}).`);
  for (const command of workflow.commands) lines.push(`- Command: ${humanize(command.name)}.`);
  for (const event of workflow.events) lines.push(`- Event: ${humanize(event.name)}.`);
  if (workflow.resultingState) lines.push(`- Resulting state: ${humanize(workflow.resultingState)}.`);
  for (const readmodel of workflow.readmodels) lines.push(`- Read-side result: ${humanize(readmodel)}.`);
  lines.push('');
  if (workflow.specifications.length) {
    lines.push('Acceptance scenarios:');
    lines.push('');
    for (const specification of workflow.specifications) {
      const result = specification.reject
        ? `reject "${specification.reject}"`
        : specification.then
          ? humanize(specification.then)
          : 'unspecified result';
      const title = specification.specification
        ? `${humanize(specification.specification)} / ${humanize(specification.name)}`
        : humanize(specification.name);
      lines.push(`- ${title}: given ${specification.given.map(humanize).join(', ') || 'unspecified precondition'}, when ${specification.when ? humanize(specification.when) : 'unspecified action'}, then ${result}.`);
      if (specification.rule) lines.push(`  Rule: ${specification.rule.replace(/\n/g, ' ')}`);
      if (specification.expressions.length) lines.push(`  Expressions: ${specification.expressions.join('; ')}`);
      if (specification.validates.length) lines.push(`  Validates: ${specification.validates.join('; ')}`);
    }
    lines.push('');
  }
};

const appendFieldTable = (
  lines: string[],
  fields: DocumentationField[],
  language: DocumentationLanguage = 'en'
): void => {
  const zh = language === 'zh-CN';
  const text = databaseText[language];
  lines.push(`### ${text.logicalSchema}`);
  lines.push('');
  if (!fields.length) {
    lines.push(text.noFields);
    lines.push('');
    return;
  }
  lines.push(`| ${text.field} | ${text.type} | ${text.cardinality} | ${text.attributes} | ${text.example} | ${text.sourceDerivation} |`);
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const field of fields) {
    lines.push(`| ${cell(field.name)} | ${cell(field.type)} | ${cell(localizeCardinality(field.cardinality, zh))} | ${cell(localizeAttributes(field.attributes, zh))} | ${cell(field.example ?? '-')} | ${cell(field.mapping ? formatMapping(field, zh) : '-')} |`);
  }
  lines.push('');
};

const formatMapping = (field: DocumentationField, zh = false): string => {
  if (!field.mapping) return '-';
  if (!zh) {
    const source = field.mapping.sources.length ? ` from ${field.mapping.sources.join(', ')}` : '';
    const rule = field.mapping.rule ? `; rule: ${field.mapping.rule}` : '';
    return `${field.mapping.kind}${source}${rule}`;
  }
  const kind = field.mapping.kind === 'derived' ? '派生' : '来源';
  const source = field.mapping.sources.length ? `：${field.mapping.sources.join(', ')}` : '';
  const rule = field.mapping.rule ? `；规则：${field.mapping.rule}` : '';
  return `${kind}${source}${rule}`;
};

const localizeCardinality = (value: string, zh: boolean): string => {
  if (!zh) return value;
  return ({
    Single: '单值',
    Optional: '可选',
    List: '列表'
  } as Record<string, string>)[value] ?? value;
};

const localizeAttributes = (attributes: string[], zh: boolean): string => {
  if (!attributes.length) return '-';
  if (!zh) return attributes.join(', ');
  return attributes.map((attribute) => ({
    id: '标识',
    query: '查询',
    optional: '可选',
    generated: '生成',
    technical: '技术字段'
  } as Record<string, string>)[attribute] ?? attribute).join(', ');
};

const databaseText = {
  en: {
    title: 'Read Model Database Design',
    designScope: 'Design Scope',
    designScopeBody: 'This document describes the read-side data model inferred from Event Modeling read models. Storage engines, physical table names, retention, and consistency SLAs remain implementation decisions unless explicitly stated.',
    inventory: 'Read Model Inventory',
    readModel: 'Read Model',
    context: 'Context',
    aggregate: 'Aggregate',
    shape: 'Shape',
    sourceEvents: 'Source Events',
    collection: 'Collection',
    singleRecord: 'Single record',
    notModeled: 'Not modeled',
    owner: 'Owner',
    labelSeparator: ':',
    logicalShape: 'Logical shape',
    collectionReadModel: 'collection/list read model',
    singleRecordReadModel: 'single-record read model',
    updatedBy: 'Updated by',
    noSubscribedEvent: 'No subscribed event is explicitly modeled',
    logicalSchema: 'Logical Schema',
    field: 'Field',
    type: 'Type',
    cardinality: 'Cardinality',
    attributes: 'Attributes',
    example: 'Example',
    sourceDerivation: 'Source / Derivation',
    noFields: 'No read model fields are explicitly modeled.',
    keysAndAccessPaths: 'Keys And Access Paths',
    logicalIdentifier: (fields: string) => `Logical identifier: ${fields}.`,
    noLogicalIdentifier: 'Logical identifier is not explicitly marked; confirm the read model key.',
    candidateQueryIndexes: (fields: string) => `Candidate query indexes: ${fields}.`,
    noQueryFields: 'No query fields are explicitly marked; derive indexes from API and UI access patterns.',
    collectionAccess: 'Provide deterministic ordering and pagination for collection access.',
    singleRecordAccess: 'Define uniqueness and upsert behavior for the single-record view.',
    updateSemantics: 'Update Semantics',
    applyIdempotently: 'Apply subscribed events idempotently.',
    trackEventPosition: 'Track event position or version when replay and recovery are required.',
    confirmRebuild: 'Confirm deletion, retention, backfill, and rebuild behavior.',
    crossCuttingDecisions: 'Cross-Cutting Database Decisions',
    storageDecision: 'Choose storage technology per read model access pattern rather than treating read models as aggregate persistence.',
    boundaryDecision: 'Separate write-model transaction boundaries from eventually consistent read-model updates.',
    rebuildDecision: 'Define read model rebuild, schema migration, observability, and failure recovery procedures.',
    sensitiveDataDecision: 'Validate personally identifiable or sensitive fields and define masking and retention controls.'
  },
  'zh-CN': {
    title: 'Read Model 数据库设计',
    designScope: '设计范围',
    designScopeBody: '本文档描述由 Event Modeling Read Model 推导出的读侧数据模型。除非领域模型明确说明，否则存储引擎、物理表名、数据保留策略和一致性 SLA 均属于后续实现决策。',
    inventory: 'Read Model 清单',
    readModel: 'Read Model',
    context: '限界上下文',
    aggregate: '聚合',
    shape: '形态',
    sourceEvents: '来源事件',
    collection: '集合/列表',
    singleRecord: '单条记录',
    notModeled: '尚未明确',
    owner: '归属',
    labelSeparator: '：',
    logicalShape: '逻辑形态',
    collectionReadModel: '集合/列表 Read Model',
    singleRecordReadModel: '单条记录 Read Model',
    updatedBy: '订阅事件',
    noSubscribedEvent: '尚未明确订阅事件',
    logicalSchema: '逻辑结构',
    field: '字段',
    type: '类型',
    cardinality: '数量',
    attributes: '属性',
    example: '示例',
    sourceDerivation: '来源/计算规则',
    noFields: '尚未明确建模 Read Model 字段。',
    keysAndAccessPaths: '主键与访问路径',
    logicalIdentifier: (fields: string) => `逻辑标识：${fields}。`,
    noLogicalIdentifier: '尚未明确标记逻辑标识字段，请确认 Read Model 主键。',
    candidateQueryIndexes: (fields: string) => `候选查询索引：${fields}。`,
    noQueryFields: '尚未明确标记查询字段，请根据 API 与页面访问模式推导索引。',
    collectionAccess: '集合访问需要提供稳定排序与分页能力。',
    singleRecordAccess: '单条记录视图需要定义唯一性与 upsert 行为。',
    updateSemantics: '更新语义',
    applyIdempotently: '订阅事件处理需要具备幂等性。',
    trackEventPosition: '需要支持重放与恢复时，应记录事件位置或版本。',
    confirmRebuild: '需要确认删除、保留、回填与重建行为。',
    crossCuttingDecisions: '数据库通用决策',
    storageDecision: '根据 Read Model 访问模式选择存储技术，不应把读模型直接等同于聚合持久化。',
    boundaryDecision: '写模型事务边界与最终一致的读模型更新需要分离设计。',
    rebuildDecision: '需要定义 Read Model 重建、Schema 迁移、可观测性与失败恢复流程。',
    sensitiveDataDecision: '涉及个人身份信息或敏感字段时，需要定义脱敏与保留控制。'
  }
} satisfies Record<DocumentationLanguage, {
  title: string;
  designScope: string;
  designScopeBody: string;
  inventory: string;
  readModel: string;
  context: string;
  aggregate: string;
  shape: string;
  sourceEvents: string;
  collection: string;
  singleRecord: string;
  notModeled: string;
  owner: string;
  labelSeparator: string;
  logicalShape: string;
  collectionReadModel: string;
  singleRecordReadModel: string;
  updatedBy: string;
  noSubscribedEvent: string;
  logicalSchema: string;
  field: string;
  type: string;
  cardinality: string;
  attributes: string;
  example: string;
  sourceDerivation: string;
  noFields: string;
  keysAndAccessPaths: string;
  logicalIdentifier: (fields: string) => string;
  noLogicalIdentifier: string;
  candidateQueryIndexes: (fields: string) => string;
  noQueryFields: string;
  collectionAccess: string;
  singleRecordAccess: string;
  updateSemantics: string;
  applyIdempotently: string;
  trackEventPosition: string;
  confirmRebuild: string;
  crossCuttingDecisions: string;
  storageDecision: string;
  boundaryDecision: string;
  rebuildDecision: string;
  sensitiveDataDecision: string;
}>;

const collectGaps = (bundle: DocumentationBundle): string[] => [
  ...bundle.workflows
    .filter((workflow) => workflow.commands.length > 0 && workflow.events.length === 0)
    .map((workflow) => `${humanize(workflow.slice)} has a command but no explicit result event.`),
  ...summarizeMissingSpecifications(bundle),
  ...bundle.readmodels
    .filter((readmodel) => readmodel.sourceEvents.length === 0)
    .map((readmodel) => `${humanize(readmodel.name)} has no explicit event subscription.`),
  ...bundle.readmodels
    .filter((readmodel) => readmodel.identifierFields.length === 0)
    .map((readmodel) => `${humanize(readmodel.name)} has no field marked as an identifier.`)
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
  ''
];

const section = (lines: string[], title: string): void => {
  lines.push(`## ${title}`);
  lines.push('');
};

const appendDiagnostics = (lines: string[], bundle: DocumentationBundle): void => {
  if (!bundle.diagnostics.length) return;
  lines.push('> MEDOL contains diagnostics. Treat affected sections as incomplete until these are resolved.');
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
