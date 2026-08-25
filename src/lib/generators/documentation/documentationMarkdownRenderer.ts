import { humanize } from '../../name';
import { documentFrontMatterLines } from './documentFrontMatter';
import { medolSoftwareVersion } from './documentVersion';
import type {
  DocumentationBundle,
  DocumentationField,
  DocumentationLanguage,
  DocumentationWorkflow
} from './documentationModel';

const defaultInstallationDatabaseName = 'umadb';

export const renderSoftwareDesignMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = softwareText[language];
  const lines = header(bundle, text.title, language);

  section(lines, text.summaryDesign);
  lines.push(text.summaryIntro);
  lines.push('');
  appendDiagnostics(lines, bundle, language);

  lines.push(`### ${text.contextMap}`);
  lines.push('');
  lines.push(`| ${text.context} | ${text.domain} | ${text.businessObjects} | ${text.primaryResponsibilities} |`);
  lines.push('| --- | --- | --- | --- |');
  for (const context of bundle.contexts) {
    lines.push(`| ${cell(humanize(context.name))} | ${cell(context.domain ? humanize(context.domain) : '-')} | ${cell(context.aggregates.map((aggregate) => humanize(aggregate.name)).join(', ') || '-')} | ${cell(context.notes.join('; ') || text.notModeled)} |`);
  }
  lines.push('');

  lines.push(`### ${text.deploymentView}`);
  lines.push('');
  if (bundle.deployments.length) {
    lines.push(`| ${text.deployment} | ${text.domain} | ${text.includedContexts} |`);
    lines.push('| --- | --- | --- |');
    for (const deployment of bundle.deployments) {
      lines.push(`| ${cell(humanize(deployment.name))} | ${cell(deployment.domain ? humanize(deployment.domain) : '-')} | ${cell(deployment.contexts.map(humanize).join(', ') || '-')} |`);
    }
  } else {
    lines.push(text.noDeployments);
  }
  lines.push('');

  lines.push(`### ${text.logicalArchitecture}`);
  lines.push('');
  appendList(lines, text.architectureLayers(bundle));
  lines.push('');

  section(lines, text.detailedDesign);
  for (const context of bundle.contexts) {
    lines.push(`<!-- em:section id="software.context.${context.name}" source="${context.id}" -->`);
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    lines.push(`${text.contextResponsibility}: ${context.notes.join(' ') || text.notModeled}`);
    lines.push('');

    lines.push(`#### ${text.businessObjectDesign}`);
    lines.push('');
    if (context.aggregates.length) {
      lines.push(`| ${text.objectName} | ${text.objectType} | ${text.lifecycle} | ${text.capabilities} |`);
      lines.push('| --- | --- | --- | --- |');
      for (const aggregate of context.aggregates) {
        lines.push(`| ${cell(humanize(aggregate.name))} | ${cell(text.objectTypeLabel[aggregate.type])} | ${cell(aggregate.states.length ? aggregate.states.map(humanize).join(' -> ') : text.notModeled)} | ${cell(aggregate.sliceNames.map(humanize).join(', ') || text.notModeled)} |`);
      }
    } else {
      lines.push(text.noBusinessObjects);
    }
    lines.push('');

    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    lines.push(`#### ${text.applicationServiceDesign}`);
    lines.push('');
    lines.push(`| ${text.capability} | ${text.actorOrTrigger} | ${text.input} | ${text.businessResult} | ${text.readSide} | ${text.rules} |`);
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const workflow of workflows) {
      lines.push(`| ${cell(humanize(workflow.slice))} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || text.system)} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(formatWorkflowResult(workflow, language))} | ${cell(workflow.readmodels.map(humanize).join(', ') || '-')} | ${cell(workflow.specifications.map((specification) => humanize(specification.name)).join(', ') || text.notModeled)} |`);
    }
    lines.push('');

    for (const workflow of workflows) {
      appendSoftwareWorkflow(lines, workflow, language);
    }

    lines.push(`#### ${text.contextDataDesign}`);
    lines.push('');
    const readmodels = bundle.readmodels.filter((readmodel) => readmodel.context === context.name);
    if (readmodels.length) {
      lines.push(`| ${text.readModel} | ${text.shape} | ${text.sourceEvents} | ${text.keyFields} | ${text.queryFields} |`);
      lines.push('| --- | --- | --- | --- | --- |');
      for (const readmodel of readmodels) {
        lines.push(`| ${cell(humanize(readmodel.name))} | ${cell(readmodel.collection ? text.collection : text.singleRecord)} | ${cell(readmodel.sourceEvents.map(humanize).join(', ') || text.notModeled)} | ${cell(readmodel.identifierFields.join(', ') || text.notModeled)} | ${cell(readmodel.queryFields.join(', ') || text.notModeled)} |`);
      }
    } else {
      lines.push(text.noReadmodels);
    }
    lines.push('');

    if (context.valueTypes.length) {
      lines.push(`#### ${text.valueTypeDesign}`);
      lines.push('');
      lines.push(`| ${text.valueType} | ${text.kind} | ${text.baseType} | ${text.constraintsOrFields} |`);
      lines.push('| --- | --- | --- | --- |');
      for (const valueType of context.valueTypes) {
        const details = valueType.values.length
          ? valueType.values.join(', ')
          : valueType.fields.map((field) => `${field.name}: ${field.type}`).join(', ');
        lines.push(`| ${cell(humanize(valueType.name))} | ${cell(valueType.kind)} | ${cell(valueType.baseType)} | ${cell(details || '-')} |`);
      }
      lines.push('');
    }
  }

  section(lines, text.interfaceAndIntegrationDesign);
  const uiWorkflows = bundle.workflows.filter((workflow) => workflow.ui);
  if (uiWorkflows.length) {
    lines.push(`### ${text.uiDesign}`);
    lines.push('');
    lines.push(`| ${text.view} | ${text.interaction} | ${text.capability} | ${text.input} | ${text.readSide} |`);
    lines.push('| --- | --- | --- | --- | --- |');
    for (const workflow of uiWorkflows) {
      lines.push(`| ${cell(humanize(workflow.ui?.name ?? ''))} | ${cell(workflow.ui?.type ?? 'unspecified')} | ${cell(humanize(workflow.slice))} | ${cell(workflow.commands.map((item) => humanize(item.name)).join(', ') || '-')} | ${cell(workflow.readmodels.map(humanize).join(', ') || '-')} |`);
    }
    lines.push('');
  }

  const integrationRows = [
    ...bundle.integrations.map((integration) => ({
      name: integration.name,
      context: integration.context,
      source: integration.source ?? text.notModeled,
      target: integration.target ?? text.notModeled
    })),
    ...bundle.contexts.flatMap((context) =>
      context.externalSystems.map((system) => ({
        name: system.name,
        context: context.name,
        source: system.kind ?? text.externalSystem,
        target: system.capabilities.map((capability) => `${capability.type}:${capability.name}`).join(', ') || system.protocol || text.notModeled
      }))
    )
  ];
  if (integrationRows.length) {
    lines.push(`### ${text.integrationDesign}`);
    lines.push('');
    lines.push(`| ${text.integration} | ${text.context} | ${text.source} | ${text.target} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const integration of integrationRows) {
      lines.push(`| ${cell(humanize(integration.name))} | ${cell(humanize(integration.context))} | ${cell(humanize(integration.source))} | ${cell(humanize(integration.target))} |`);
    }
  } else {
    lines.push(text.noIntegrations);
  }
  lines.push('');

  section(lines, text.exceptionAndRuleDesign);
  appendList(lines, summarizeSpecifications(bundle, language), text.noSpecifications);
  lines.push('');

  section(lines, text.qualityAndOperationsDesign);
  for (const context of bundle.contexts) {
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    appendLabeledList(lines, text.decisions, context.decisions, text.noDecisions);
    appendLabeledList(lines, text.risks, context.risks, text.noRisks);
    appendLabeledList(lines, text.metrics, context.metrics.map(humanize), text.noMetrics);
  }

  section(lines, text.implementationGaps);
  appendList(lines, collectGaps(bundle, language), text.noGaps);
  lines.push('');
  return lines.join('\n');
};

const renderLegacySoftwareDesignMarkdown = (bundle: DocumentationBundle): string => {
  const lines = header(bundle, 'Software Design');

  section(lines, 'Architecture Overview');
  lines.push('The system is organized around bounded contexts, event-driven aggregate workflows, read models, automations, and external integrations.');
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

const appendSoftwareWorkflow = (
  lines: string[],
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): void => {
  const text = softwareText[language];
  lines.push(`<!-- em:section id="software.slice.${workflow.slice}" source="${workflow.id}" -->`);
  lines.push(`##### ${humanize(workflow.slice)}`);
  lines.push('');
  appendList(lines, [
    `${text.owner}: ${humanize(workflow.aggregate)}.`,
    `${text.actorOrTrigger}: ${workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || text.system}.`,
    `${text.input}: ${workflow.commands.map((command) => humanize(command.name)).join(', ') || text.notModeled}.`,
    `${text.businessResult}: ${formatWorkflowResult(workflow, language)}.`,
    `${text.readSide}: ${workflow.readmodels.map(humanize).join(', ') || text.notModeled}.`
  ]);
  if (workflow.specifications.length) {
    lines.push('');
    lines.push(`**${text.ruleAndExceptionDesign}**`);
    lines.push('');
    appendList(lines, workflow.specifications.map((specification) =>
      formatSpecificationSummary(specification, language)
    ));
  }
  if (workflow.hotspots.length) {
    lines.push('');
    lines.push(`**${text.openDesignQuestions}**`);
    lines.push('');
    appendList(lines, workflow.hotspots);
  }
  lines.push('');
};

const formatWorkflowResult = (
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): string => {
  const text = softwareText[language];
  return [
    ...workflow.events.map((item) => humanize(item.name)),
    ...(workflow.resultingState ? [`${text.state}: ${humanize(workflow.resultingState)}`] : [])
  ].join(', ') || text.notModeled;
};

const summarizeSpecifications = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[] =>
  bundle.workflows.flatMap((workflow) =>
    workflow.specifications.map((specification) =>
      `${humanize(workflow.context)} / ${humanize(workflow.slice)}: ${formatSpecificationSummary(specification, language)}`
    )
  );

const formatSpecificationSummary = (
  specification: DocumentationWorkflow['specifications'][number],
  language: DocumentationLanguage
): string => {
  const text = softwareText[language];
  const title = specification.specification
    ? `${humanize(specification.specification)} / ${humanize(specification.name)}`
    : humanize(specification.name);
  const result = specification.reject
    ? `${text.reject}: ${specification.reject}`
    : specification.error
      ? `${text.error}: ${specification.error}`
      : specification.then
        ? humanize(specification.then)
        : text.notModeled;
  return `${title} - ${text.when} ${specification.when ? humanize(specification.when) : text.notModeled}, ${text.then} ${result}.`;
};

const softwareText = {
  en: {
    title: 'Software Design Document',
    summaryDesign: 'Summary Design',
    summaryIntro: 'This document describes the system design derived from the reviewed domain model. It separates high-level architecture decisions from detailed context, capability, data, and integration design.',
    contextMap: 'Bounded Context And Module Map',
    context: 'Context',
    domain: 'Domain',
    businessObjects: 'Business Objects',
    primaryResponsibilities: 'Primary Responsibilities',
    deploymentView: 'Deployment View',
    deployment: 'Deployment',
    includedContexts: 'Included Contexts',
    noDeployments: 'No deployable boundaries are explicitly modeled. Treat deployment packaging as an implementation decision.',
    logicalArchitecture: 'Logical Architecture',
    architectureLayers: (bundle: DocumentationBundle) => [
      `Presentation layer: ${bundle.workflows.filter((workflow) => workflow.ui).length} modeled UI entry points provide user and operator access.`,
      `Application layer: ${bundle.workflows.length} capabilities coordinate commands, business results, rules, and automation triggers.`,
      `Domain layer: ${bundle.contexts.flatMap((context) => context.aggregates).length} business objects own lifecycle state and invariants.`,
      `Read side: ${bundle.readmodels.length} read models support list, detail, dashboard, eligibility, catalog, and operational views.`,
      `Integration layer: ${bundle.integrations.length + bundle.contexts.flatMap((context) => context.externalSystems).length} integration points connect external systems, runtimes, or downstream services.`
    ],
    detailedDesign: 'Detailed Design',
    contextResponsibility: 'Context responsibility',
    businessObjectDesign: 'Business Object Design',
    objectName: 'Object',
    objectType: 'Type',
    objectTypeLabel: {
      aggregate: 'Aggregate',
      concept: 'Concept'
    },
    lifecycle: 'Lifecycle',
    capabilities: 'Capabilities',
    noBusinessObjects: 'No explicit business objects are modeled in this context.',
    applicationServiceDesign: 'Application And Capability Design',
    capability: 'Capability',
    actorOrTrigger: 'Actor / Trigger',
    input: 'Input',
    businessResult: 'Business Result',
    readSide: 'Read Side',
    rules: 'Rules',
    system: 'System',
    owner: 'Owner',
    ruleAndExceptionDesign: 'Rule And Exception Design',
    openDesignQuestions: 'Open Design Questions',
    contextDataDesign: 'Context Data Design',
    readModel: 'Read Model',
    shape: 'Shape',
    sourceEvents: 'Source Events',
    keyFields: 'Key Fields',
    queryFields: 'Query Fields',
    collection: 'Collection',
    singleRecord: 'Single record',
    noReadmodels: 'No read models are explicitly modeled in this context.',
    valueTypeDesign: 'Value Type Design',
    valueType: 'Value Type',
    kind: 'Kind',
    baseType: 'Base Type',
    constraintsOrFields: 'Constraints / Fields',
    interfaceAndIntegrationDesign: 'Interface And Integration Design',
    uiDesign: 'UI Design',
    view: 'View',
    interaction: 'Interaction',
    integrationDesign: 'Integration Design',
    integration: 'Integration',
    source: 'Source',
    target: 'Target',
    externalSystem: 'External system',
    noIntegrations: 'No automations, integrations, or external systems are explicitly modeled.',
    exceptionAndRuleDesign: 'Exception And Rule Design',
    noSpecifications: 'No explicit business rules or exception scenarios are modeled.',
    qualityAndOperationsDesign: 'Quality, Operations, And Observability Design',
    decisions: 'Decisions',
    risks: 'Risks',
    metrics: 'Metrics',
    noDecisions: 'No decisions are explicitly modeled.',
    noRisks: 'No risks are explicitly modeled.',
    noMetrics: 'No metrics are explicitly modeled.',
    implementationGaps: 'Implementation Gaps',
    noGaps: 'No structural gaps were detected.',
    notModeled: 'Not explicitly modeled',
    state: 'state',
    when: 'when',
    then: 'then',
    reject: 'reject',
    error: 'error',
    diagnosticsWarning: 'MEDOL contains diagnostics. Treat affected sections as incomplete until these are resolved.'
  },
  'zh-CN': {
    title: '软件设计文档',
    summaryDesign: '概要设计',
    summaryIntro: '本文档描述由已评审领域模型推导出的软件设计。文档将系统级架构决策与上下文、业务能力、数据、接口和集成的详细设计分开说明，便于研发、测试和交付协同。',
    contextMap: '限界上下文与模块划分',
    context: '限界上下文',
    domain: '业务域',
    businessObjects: '业务对象',
    primaryResponsibilities: '主要职责',
    deploymentView: '部署视图',
    deployment: '部署单元',
    includedContexts: '包含上下文',
    noDeployments: '当前未明确建模部署边界，部署打包方式需作为实现决策补充。',
    logicalArchitecture: '逻辑架构',
    architectureLayers: (bundle: DocumentationBundle) => [
      `表现层：${bundle.workflows.filter((workflow) => workflow.ui).length} 个已建模页面入口承载用户和运维操作。`,
      `应用层：${bundle.workflows.length} 个业务能力负责编排输入、业务结果、规则校验与自动化触发。`,
      `领域层：${bundle.contexts.flatMap((context) => context.aggregates).length} 个业务对象维护生命周期状态与业务不变量。`,
      `读侧模型：${bundle.readmodels.length} 个 Read Model 支撑列表、详情、仪表板、资格判断、目录和运维视图。`,
      `集成层：${bundle.integrations.length + bundle.contexts.flatMap((context) => context.externalSystems).length} 个集成点连接外部系统、运行时或下游服务。`
    ],
    detailedDesign: '详细设计',
    contextResponsibility: '上下文职责',
    businessObjectDesign: '业务对象设计',
    objectName: '对象',
    objectType: '类型',
    objectTypeLabel: {
      aggregate: '聚合',
      concept: '概念'
    },
    lifecycle: '生命周期',
    capabilities: '业务能力',
    noBusinessObjects: '该上下文尚未明确建模业务对象。',
    applicationServiceDesign: '应用服务与能力设计',
    capability: '业务能力',
    actorOrTrigger: '角色/触发条件',
    input: '输入',
    businessResult: '业务结果',
    readSide: '读侧结果',
    rules: '规则',
    system: '系统',
    owner: '归属',
    ruleAndExceptionDesign: '规则与异常设计',
    openDesignQuestions: '待确认设计问题',
    contextDataDesign: '上下文数据设计',
    readModel: 'Read Model',
    shape: '形态',
    sourceEvents: '来源事件',
    keyFields: '关键字段',
    queryFields: '查询字段',
    collection: '集合/列表',
    singleRecord: '单条记录',
    noReadmodels: '该上下文尚未明确建模 Read Model。',
    valueTypeDesign: '值类型设计',
    valueType: '值类型',
    kind: '类型',
    baseType: '基础类型',
    constraintsOrFields: '约束/字段',
    interfaceAndIntegrationDesign: '接口与集成设计',
    uiDesign: '页面设计',
    view: '页面',
    interaction: '交互',
    integrationDesign: '集成设计',
    integration: '集成',
    source: '来源',
    target: '目标',
    externalSystem: '外部系统',
    noIntegrations: '当前未明确自动化、集成或外部系统。',
    exceptionAndRuleDesign: '异常与规则设计',
    noSpecifications: '当前未明确业务规则或异常场景。',
    qualityAndOperationsDesign: '质量属性、运维与可观测性设计',
    decisions: '设计决策',
    risks: '风险',
    metrics: '指标',
    noDecisions: '尚未明确设计决策。',
    noRisks: '尚未明确风险。',
    noMetrics: '尚未明确指标。',
    implementationGaps: '实现缺口',
    noGaps: '未检测到结构性缺口。',
    notModeled: '尚未明确',
    state: '状态',
    when: '当',
    then: '则',
    reject: '拒绝',
    error: '错误',
    diagnosticsWarning: '当前领域模型存在诊断错误；相关章节在问题修复前应视为不完整。'
  }
} satisfies Record<DocumentationLanguage, {
  title: string;
  summaryDesign: string;
  summaryIntro: string;
  contextMap: string;
  context: string;
  domain: string;
  businessObjects: string;
  primaryResponsibilities: string;
  deploymentView: string;
  deployment: string;
  includedContexts: string;
  noDeployments: string;
  logicalArchitecture: string;
  architectureLayers: (bundle: DocumentationBundle) => string[];
  detailedDesign: string;
  contextResponsibility: string;
  businessObjectDesign: string;
  objectName: string;
  objectType: string;
  objectTypeLabel: Record<'aggregate' | 'concept', string>;
  lifecycle: string;
  capabilities: string;
  noBusinessObjects: string;
  applicationServiceDesign: string;
  capability: string;
  actorOrTrigger: string;
  input: string;
  businessResult: string;
  readSide: string;
  rules: string;
  system: string;
  owner: string;
  ruleAndExceptionDesign: string;
  openDesignQuestions: string;
  contextDataDesign: string;
  readModel: string;
  shape: string;
  sourceEvents: string;
  keyFields: string;
  queryFields: string;
  collection: string;
  singleRecord: string;
  noReadmodels: string;
  valueTypeDesign: string;
  valueType: string;
  kind: string;
  baseType: string;
  constraintsOrFields: string;
  interfaceAndIntegrationDesign: string;
  uiDesign: string;
  view: string;
  interaction: string;
  integrationDesign: string;
  integration: string;
  source: string;
  target: string;
  externalSystem: string;
  noIntegrations: string;
  exceptionAndRuleDesign: string;
  noSpecifications: string;
  qualityAndOperationsDesign: string;
  decisions: string;
  risks: string;
  metrics: string;
  noDecisions: string;
  noRisks: string;
  noMetrics: string;
  implementationGaps: string;
  noGaps: string;
  notModeled: string;
  state: string;
  when: string;
  then: string;
  reject: string;
  error: string;
  diagnosticsWarning: string;
}>;

const testOutlineText = {
  en: {
    title: 'Test Outline',
    objectivesAndScope: 'Test Objectives And Scope',
    objectives: (bundle: DocumentationBundle) => [
      `Cover ${bundle.contexts.length} business contexts, ${bundle.workflows.length} functional capabilities, ${bundle.readmodels.length} read models, and ${bundle.integrations.length} modeled integrations.`,
      'Define what must be tested, how the test space is divided, which scenarios matter, and what level of coverage is expected before detailed test cases are written.',
      'Use modeled slices, specifications, events, projections, automations, and integrations as the traceable source for test design.'
    ],
    testObject: 'Test Object',
    objectContext: 'Context',
    objectUnit: 'Test Unit',
    objectOwner: 'Business Object',
    objectTrigger: 'Actor / Trigger',
    objectObservableResult: 'Observable Result',
    scopeBoundary: 'Scope Boundary',
    inScope: 'In Scope',
    outOfScope: 'Out Of Scope',
    scopeInItems: [
      'Modeled slices, commands, events, specifications, state transitions, read-model updates, automation triggers, and external integrations.',
      'Happy paths, business-rule rejection paths, permission boundaries, duplicate operation handling, idempotency, retry behavior, and data consistency.'
    ],
    scopeOutItems: [
      'Unmodeled business processes, implementation-only technical details, production operations, and external-system internal behavior outside the modeled contract.',
      'Concrete input values, step-by-step execution procedure, and expected payload examples belong to detailed test cases rather than this outline.'
    ],
    scenarioCoverage: 'Test Scenario Coverage',
    scenarioUnit: 'Test Unit',
    normalPath: 'Normal Path',
    businessRules: 'Business Rules / Exceptions',
    stateAndEvents: 'State And Events',
    readSideAndAutomation: 'Read Side / Automation',
    coverageFocus: 'Coverage Focus',
    normalPathTemplate: (slice: string) => `Complete ${slice} successfully.`,
    noExplicitRules: 'Derive negative scenarios from validation, state, permission, boundary, duplicate, and missing-field conditions.',
    eventExpectation: 'Success emits',
    stateExpectation: 'state',
    noEventsModeled: 'Event outcome requires confirmation',
    noReadSideOrAutomation: 'Read-side or automation outcome requires confirmation',
    coverageChecklist: 'happy path; rejection path; idempotency; permission; boundary; concurrency',
    testTypes: 'Test Types',
    testTypeItems: [
      'Specification Test: map Given / When / Then rules to executable domain scenarios.',
      'Domain Test: verify aggregate or concept state transitions, invariants, rejection paths, and emitted events.',
      'Adapter Contract Test: verify ports, external-system contracts, failure mapping, retries, and timeout behavior.',
      'Integration Test: verify cross-context handoffs, event handlers, automations, projections, and external dependencies.',
      'Workflow / E2E Test: verify user-visible or operator-visible business flows across UI/API, domain, and read side.',
      'Regression Test: preserve coverage for lifecycle transitions, business rules, permissions, read-model rebuilds, and previously fixed defects.'
    ],
    testStrategy: 'Test Strategy',
    strategy: [
      'Use scenario-based functional tests for user-facing capabilities and system-triggered workflows.',
      'Use API or service-level tests for operations without a UI entry point.',
      'Use integration tests for external systems, automation triggers, and cross-context handoffs.',
      'Use read-model assertions to verify eventual consistency, projection freshness, key selection, filtering, sorting, replay, and idempotent updates.',
      'Use regression suites around lifecycle transitions, permission boundaries, validation rules, and retry behavior.'
    ],
    environmentAndData: 'Test Environment And Test Data',
    environmentChecklist: [
      'Prepare stable identifiers, reference data, dictionary values, and representative user roles before test execution.',
      'Prepare valid, invalid, duplicate, boundary, and missing-field payloads for each business operation.',
      'Prepare read-model seed or replay data so list, detail, dashboard, and catalog views can be verified deterministically.',
      'Prepare integration doubles or sandbox services for external systems and runtime adapters.'
    ],
    functionalScope: 'Functional Test Scope',
    caseArea: 'Case Area',
    actorOrTrigger: 'Actor / Trigger',
    input: 'Input',
    expectedResult: 'Expected Result',
    priorityBasis: 'Priority Basis',
    system: 'System',
    lifecycleStart: 'Lifecycle start',
    ruleCovered: 'Rule covered',
    reviewRequired: 'Review required',
    noCapabilities: 'No capabilities are explicitly modeled in this context.',
    ruleAndExceptionTesting: 'Business Rule And Exception Testing',
    noRules: 'No explicit rules or exception paths are modeled.',
    interfaceAndIntegrationTesting: 'Interface And Integration Testing',
    verifyAutomationTrigger: 'verify trigger, payload, retry, and failure handling for',
    noIntegrations: 'No integrations or automations are explicitly modeled.',
    dataAndReadModelTesting: 'Data And Read Model Testing',
    readModel: 'Read Model',
    shape: 'Shape',
    sourceEvents: 'Source Events',
    keyAssertions: 'Key Assertions',
    identifier: 'identifier',
    identifierMissing: 'identifier requires confirmation',
    query: 'query',
    queryByAccessPattern: 'derive query assertions from access pattern',
    paginationAndOrdering: 'pagination and deterministic ordering',
    uniqueUpsert: 'unique record and upsert behavior',
    collection: 'Collection',
    singleRecord: 'Single record',
    noReadmodels: 'No read models are explicitly modeled.',
    nonFunctionalTesting: 'Non-Functional Test Scope',
    nonFunctionalChecklist: [
      'Permission and tenant isolation tests for each user-facing operation.',
      'Idempotency, duplicate submission, retry, and concurrency tests for state-changing operations.',
      'Audit, traceability, masking, and retention checks for sensitive or regulated data.',
      'Performance smoke tests for list, detail, dashboard, and high-volume read models.',
      'Failure recovery tests for automation, integration, and read-model replay paths.'
    ],
    regressionAndAutomation: 'Regression And Automation Plan',
    contextRegression: (context: string) => `Build smoke and regression coverage for ${context} capabilities, state changes, and read-side views.`,
    gapDrivenTest: 'Gap-driven test',
    exitCriteria: 'Exit Criteria',
    exitChecklist: [
      'All P0/P1 functional flows pass in the target environment.',
      'All explicit business rules have positive and negative coverage.',
      'Critical read models are verified for update source, identifiers, query behavior, and rebuild assumptions.',
      'Known gaps and open questions are either resolved or accepted by product, engineering, and QA stakeholders.',
      'Regression automation covers lifecycle transitions, permissions, retries, and major integration paths.'
    ],
    notModeled: 'Not explicitly modeled'
  },
  'zh-CN': {
    title: '测试大纲',
    objectivesAndScope: '测试目标与范围',
    objectives: (bundle: DocumentationBundle) => [
      `覆盖 ${bundle.contexts.length} 个业务上下文、${bundle.workflows.length} 个功能能力、${bundle.readmodels.length} 个 Read Model 和 ${bundle.integrations.length} 个已建模集成点。`,
      '在编写详细测试用例之前，定义系统要测什么、怎么划分测试单元、重点场景在哪里，以及覆盖到什么程度算测试设计充分。',
      '以模型中的 Slice、Specification、事件、Projection、Automation 和集成为可追溯来源，形成后续测试用例和自动化测试的设计依据。'
    ],
    testObject: '测试对象',
    objectContext: '上下文',
    objectUnit: '测试单元',
    objectOwner: '业务对象',
    objectTrigger: '角色/触发条件',
    objectObservableResult: '可观察结果',
    scopeBoundary: '测试范围边界',
    inScope: '纳入测试范围',
    outOfScope: '不纳入测试范围',
    scopeInItems: [
      '模型中已明确的 Slice、Command、Event、Specification、状态流转、Read Model 更新、Automation 触发和外部集成。',
      '基于模型推导的正常路径、业务拒绝路径、权限边界、重复操作、幂等、重试、并发和数据一致性验证。'
    ],
    scopeOutItems: [
      '未建模业务流程、纯实现细节、生产运维操作，以及超出已建模集成契约的外部系统内部行为。',
      '具体输入值、逐步操作步骤、接口报文样例等属于详细测试用例，不在测试大纲中展开。'
    ],
    scenarioCoverage: '测试场景覆盖',
    scenarioUnit: '测试单元',
    normalPath: '正常路径',
    businessRules: '业务规则/异常',
    stateAndEvents: '状态与事件',
    readSideAndAutomation: '读侧/自动化',
    coverageFocus: '覆盖重点',
    normalPathTemplate: (slice: string) => `成功完成 ${slice}。`,
    noExplicitRules: '从校验、状态、权限、边界、重复提交和缺失字段推导反向场景。',
    eventExpectation: '成功时产生',
    stateExpectation: '状态',
    noEventsModeled: '事件结果需确认',
    noReadSideOrAutomation: '读侧或自动化结果需确认',
    coverageChecklist: '正常路径；拒绝路径；幂等；权限；边界；并发',
    testTypes: '测试类型',
    testTypeItems: [
      'Specification Test：将 Given / When / Then 规则映射为可执行领域场景。',
      'Domain Test：验证聚合或概念的状态流转、不变量、拒绝路径和产生事件。',
      'Adapter Contract Test：验证端口、外部系统契约、失败映射、重试和超时行为。',
      'Integration Test：验证跨上下文协作、事件处理器、自动化、Projection 和外部依赖。',
      'Workflow / E2E Test：验证用户或运维可感知的端到端业务流程。',
      'Regression Test：固化生命周期流转、业务规则、权限、Read Model 重放和历史缺陷回归覆盖。'
    ],
    testStrategy: '测试策略',
    strategy: [
      '面向用户功能和系统触发流程采用场景化功能测试。',
      '没有页面入口的操作采用 API 或服务层测试。',
      '外部系统、自动化触发和跨上下文协作采用集成测试。',
      'Read Model 通过最终一致性、投影新鲜度、主键、过滤、排序、重放和幂等更新断言进行验证。',
      '生命周期流转、权限边界、校验规则和重试行为纳入回归测试。'
    ],
    environmentAndData: '测试环境与测试数据',
    environmentChecklist: [
      '测试执行前准备稳定的标识、参考数据、字典值和代表性用户角色。',
      '为每个业务操作准备有效、无效、重复、边界和缺失字段请求数据。',
      '为列表、详情、仪表板和目录视图准备可确定验证的种子数据或回放数据。',
      '为外部系统和运行时适配器准备集成沙箱或替身服务。'
    ],
    functionalScope: '功能测试范围',
    caseArea: '测试域',
    actorOrTrigger: '角色/触发条件',
    input: '输入',
    expectedResult: '预期结果',
    priorityBasis: '优先级依据',
    system: '系统',
    lifecycleStart: '生命周期起点',
    ruleCovered: '规则已覆盖',
    reviewRequired: '需评审确认',
    noCapabilities: '该上下文尚未明确建模功能能力。',
    ruleAndExceptionTesting: '业务规则与异常测试',
    noRules: '当前未明确业务规则或异常路径。',
    interfaceAndIntegrationTesting: '接口与集成测试',
    verifyAutomationTrigger: '验证触发条件、载荷、重试和失败处理：',
    noIntegrations: '当前未明确集成或自动化。',
    dataAndReadModelTesting: '数据与 Read Model 测试',
    readModel: 'Read Model',
    shape: '形态',
    sourceEvents: '来源事件',
    keyAssertions: '关键断言',
    identifier: '标识',
    identifierMissing: '标识需确认',
    query: '查询',
    queryByAccessPattern: '按访问模式推导查询断言',
    paginationAndOrdering: '分页与稳定排序',
    uniqueUpsert: '唯一记录与 upsert 行为',
    collection: '集合/列表',
    singleRecord: '单条记录',
    noReadmodels: '当前未明确 Read Model。',
    nonFunctionalTesting: '非功能测试范围',
    nonFunctionalChecklist: [
      '每个面向用户操作需要覆盖权限与租户隔离测试。',
      '会改变状态的操作需要覆盖幂等、重复提交、重试和并发测试。',
      '涉及敏感或监管数据时需要覆盖审计、追踪、脱敏和保留策略检查。',
      '列表、详情、仪表板和高数据量读模型需要做性能冒烟测试。',
      '自动化、集成和 Read Model 重放路径需要覆盖失败恢复测试。'
    ],
    regressionAndAutomation: '回归与自动化计划',
    contextRegression: (context: string) => `为 ${context} 的业务能力、状态变化和读侧视图建立冒烟与回归覆盖。`,
    gapDrivenTest: '缺口驱动测试',
    exitCriteria: '准出标准',
    exitChecklist: [
      '目标环境中所有 P0/P1 功能流程测试通过。',
      '所有明确业务规则均具备正向和反向测试覆盖。',
      '关键 Read Model 已验证更新来源、标识、查询行为和重建假设。',
      '已知缺口和待确认事项已解决，或由产品、研发、测试共同接受。',
      '回归自动化覆盖生命周期流转、权限、重试和主要集成路径。'
    ],
    notModeled: '尚未明确'
  }
} satisfies Record<DocumentationLanguage, {
  title: string;
  objectivesAndScope: string;
  objectives: (bundle: DocumentationBundle) => string[];
  testObject: string;
  objectContext: string;
  objectUnit: string;
  objectOwner: string;
  objectTrigger: string;
  objectObservableResult: string;
  scopeBoundary: string;
  inScope: string;
  outOfScope: string;
  scopeInItems: string[];
  scopeOutItems: string[];
  scenarioCoverage: string;
  scenarioUnit: string;
  normalPath: string;
  businessRules: string;
  stateAndEvents: string;
  readSideAndAutomation: string;
  coverageFocus: string;
  normalPathTemplate: (slice: string) => string;
  noExplicitRules: string;
  eventExpectation: string;
  stateExpectation: string;
  noEventsModeled: string;
  noReadSideOrAutomation: string;
  coverageChecklist: string;
  testTypes: string;
  testTypeItems: string[];
  testStrategy: string;
  strategy: string[];
  environmentAndData: string;
  environmentChecklist: string[];
  functionalScope: string;
  caseArea: string;
  actorOrTrigger: string;
  input: string;
  expectedResult: string;
  priorityBasis: string;
  system: string;
  lifecycleStart: string;
  ruleCovered: string;
  reviewRequired: string;
  noCapabilities: string;
  ruleAndExceptionTesting: string;
  noRules: string;
  interfaceAndIntegrationTesting: string;
  verifyAutomationTrigger: string;
  noIntegrations: string;
  dataAndReadModelTesting: string;
  readModel: string;
  shape: string;
  sourceEvents: string;
  keyAssertions: string;
  identifier: string;
  identifierMissing: string;
  query: string;
  queryByAccessPattern: string;
  paginationAndOrdering: string;
  uniqueUpsert: string;
  collection: string;
  singleRecord: string;
  noReadmodels: string;
  nonFunctionalTesting: string;
  nonFunctionalChecklist: string[];
  regressionAndAutomation: string;
  contextRegression: (context: string) => string;
  gapDrivenTest: string;
  exitCriteria: string;
  exitChecklist: string[];
  notModeled: string;
}>;

export const renderDatabaseDesignMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const zh = language === 'zh-CN';
  const text = databaseText[language];
  const lines = header(bundle, text.title, language);
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

export const renderProcessMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const lines = header(bundle, 'Business Process', language);
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

export const renderTestOutlineMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = testOutlineText[language];
  const lines = header(bundle, text.title, language);

  section(lines, text.objectivesAndScope);
  appendList(lines, text.objectives(bundle));
  lines.push('');
  appendDiagnostics(lines, bundle, language);

  section(lines, text.testObject);
  lines.push(`| ${text.objectContext} | ${text.objectUnit} | ${text.objectOwner} | ${text.objectTrigger} | ${text.objectObservableResult} |`);
  lines.push('| --- | --- | --- | --- | --- |');
  for (const workflow of bundle.workflows) {
    lines.push(`| ${cell(humanize(workflow.context))} | ${cell(humanize(workflow.slice))} | ${cell(humanize(workflow.aggregate))} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || text.system)} | ${cell(formatWorkflowResult(workflow, language))} |`);
  }
  if (bundle.workflows.length === 0) lines.push(`| ${text.notModeled} | ${text.notModeled} | ${text.notModeled} | ${text.notModeled} | ${text.notModeled} |`);
  lines.push('');

  section(lines, text.scopeBoundary);
  lines.push(`### ${text.inScope}`);
  lines.push('');
  appendList(lines, text.scopeInItems);
  lines.push('');
  lines.push(`### ${text.outOfScope}`);
  lines.push('');
  appendList(lines, text.scopeOutItems);
  lines.push('');

  section(lines, text.testStrategy);
  appendList(lines, text.strategy);
  lines.push('');

  section(lines, text.environmentAndData);
  appendList(lines, text.environmentChecklist);
  lines.push('');

  section(lines, text.testTypes);
  appendList(lines, text.testTypeItems);
  lines.push('');

  section(lines, text.functionalScope);
  for (const context of bundle.contexts) {
    lines.push(`<!-- em:section id="test.context.${context.name}" source="${context.id}" -->`);
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    if (!workflows.length) {
      lines.push(text.noCapabilities);
      lines.push('');
      continue;
    }
    lines.push(`| ${text.caseArea} | ${text.actorOrTrigger} | ${text.input} | ${text.expectedResult} | ${text.priorityBasis} |`);
    lines.push('| --- | --- | --- | --- | --- |');
    for (const workflow of workflows) {
      lines.push(`| ${cell(humanize(workflow.slice))} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || text.system)} | ${cell(workflow.commands.map((command) => humanize(command.name)).join(', ') || '-')} | ${cell(formatWorkflowResult(workflow, language))} | ${cell(workflow.startsLifecycle ? text.lifecycleStart : workflow.specifications.length ? text.ruleCovered : text.reviewRequired)} |`);
    }
    lines.push('');
  }

  section(lines, text.scenarioCoverage);
  if (bundle.workflows.length) {
    lines.push(`| ${text.scenarioUnit} | ${text.normalPath} | ${text.businessRules} | ${text.stateAndEvents} | ${text.readSideAndAutomation} | ${text.coverageFocus} |`);
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const workflow of bundle.workflows) {
      const rules = workflow.specifications.length
        ? workflow.specifications.map((specification) => formatSpecificationSummary(specification, language)).join('; ')
        : text.noExplicitRules;
      const stateAndEvents = [
        workflow.events.length ? `${text.eventExpectation}: ${workflow.events.map((event) => humanize(event.name)).join(', ')}` : text.noEventsModeled,
        ...(workflow.resultingState ? [`${text.stateExpectation}: ${humanize(workflow.resultingState)}`] : [])
      ].join('; ');
      const readSideAndAutomation = [
        ...workflow.readmodels.map(humanize),
        ...workflow.processors.map(humanize)
      ].join(', ') || text.noReadSideOrAutomation;
      lines.push(`| ${cell(humanize(workflow.slice))} | ${cell(text.normalPathTemplate(humanize(workflow.slice)))} | ${cell(rules)} | ${cell(stateAndEvents)} | ${cell(readSideAndAutomation)} | ${cell(text.coverageChecklist)} |`);
    }
  } else {
    lines.push(text.noCapabilities);
  }
  lines.push('');

  section(lines, text.ruleAndExceptionTesting);
  const specificationRows = summarizeSpecifications(bundle, language);
  appendList(lines, specificationRows, text.noRules);
  lines.push('');

  section(lines, text.interfaceAndIntegrationTesting);
  const integrationRows = [
    ...bundle.integrations.map((integration) =>
      `${humanize(integration.context)} / ${humanize(integration.name)}: ${humanize(integration.source ?? text.notModeled)} -> ${humanize(integration.target ?? text.notModeled)}.`
    ),
    ...bundle.contexts.flatMap((context) =>
      context.externalSystems.map((system) =>
        `${humanize(context.name)} / ${humanize(system.name)}: ${system.capabilities.map((capability) => `${capability.type}:${capability.name}`).join(', ') || system.protocol || text.notModeled}.`
      )
    )
  ];
  appendList(lines, [
    ...integrationRows,
    ...bundle.workflows.flatMap((workflow) =>
      workflow.processors.map((processor) =>
        `${humanize(workflow.context)} / ${humanize(processor)}: ${text.verifyAutomationTrigger} ${humanize(workflow.slice)}.`
      )
    )
  ], text.noIntegrations);
  lines.push('');

  section(lines, text.dataAndReadModelTesting);
  if (bundle.readmodels.length) {
    lines.push(`| ${text.readModel} | ${text.shape} | ${text.sourceEvents} | ${text.keyAssertions} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const readmodel of bundle.readmodels) {
      const assertions = [
        readmodel.identifierFields.length ? `${text.identifier}: ${readmodel.identifierFields.join(', ')}` : text.identifierMissing,
        readmodel.queryFields.length ? `${text.query}: ${readmodel.queryFields.join(', ')}` : text.queryByAccessPattern,
        readmodel.collection ? text.paginationAndOrdering : text.uniqueUpsert
      ];
      lines.push(`| ${cell(humanize(readmodel.name))} | ${cell(readmodel.collection ? text.collection : text.singleRecord)} | ${cell(readmodel.sourceEvents.map(humanize).join(', ') || text.notModeled)} | ${cell(assertions.join('; '))} |`);
    }
  } else {
    lines.push(text.noReadmodels);
  }
  lines.push('');

  section(lines, text.nonFunctionalTesting);
  appendList(lines, text.nonFunctionalChecklist);
  lines.push('');

  section(lines, text.regressionAndAutomation);
  appendList(lines, [
    ...bundle.contexts.map((context) => text.contextRegression(humanize(context.name))),
    ...collectGaps(bundle, language).map((gap) => `${text.gapDrivenTest}: ${gap}`)
  ]);
  lines.push('');

  section(lines, text.exitCriteria);
  appendList(lines, text.exitChecklist);
  lines.push('');

  return lines.join('\n');
};

export const renderUserJourneyMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = userJourneyText[language];
  const lines = header(bundle, text.title, language);
  const actors = collectJourneyActors(bundle, language);

  section(lines, text.overview);
  lines.push(text.overviewBody(bundle));
  lines.push('');
  appendDiagnostics(lines, bundle, language);

  section(lines, text.actorJourneySummary);
  if (actors.length) {
    lines.push(`| ${text.actor} | ${text.goals} | ${text.mainTouchpoints} | ${text.keyResults} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const actor of actors) {
      const workflows = bundle.workflows.filter((workflow) => journeyActor(workflow, language) === actor);
      lines.push(`| ${cell(actor)} | ${cell(workflows.map((workflow) => humanize(workflow.slice)).join(', ') || text.notModeled)} | ${cell(workflows.map(formatJourneyTouchpoint).filter(Boolean).join(', ') || text.systemTouchpoint)} | ${cell(workflows.map((workflow) => formatWorkflowResult(workflow, language)).join('; ') || text.notModeled)} |`);
    }
  } else {
    lines.push(text.noActors);
  }
  lines.push('');

  section(lines, text.endToEndJourneyMap);
  lines.push('```mermaid');
  lines.push('flowchart LR');
  for (const [index, workflow] of bundle.workflows.entries()) {
    const nodeId = `J${index + 1}`;
    const actor = journeyActor(workflow, language);
    lines.push(`  ${nodeId}["${mermaidLabel(`${actor}: ${humanize(workflow.slice)}`)}"]`);
    if (index > 0 && bundle.workflows[index - 1].context === workflow.context) {
      lines.push(`  J${index} --> ${nodeId}`);
    }
  }
  if (bundle.workflows.length === 0) lines.push(`  Empty["${mermaidLabel(text.noCapabilities)}"]`);
  lines.push('```');
  lines.push('');

  section(lines, text.contextJourneys);
  for (const context of bundle.contexts) {
    lines.push(`<!-- em:section id="user-journey.context.${context.name}" source="${context.id}" -->`);
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    if (!workflows.length) {
      lines.push(text.noCapabilities);
      lines.push('');
      continue;
    }
    lines.push(`| ${text.step} | ${text.actorOrTrigger} | ${text.userGoal} | ${text.touchpoint} | ${text.businessResult} | ${text.evidence} |`);
    lines.push('| --- | --- | --- | --- | --- | --- |');
    workflows.forEach((workflow, index) => {
      lines.push(`| ${index + 1} | ${cell(journeyActor(workflow, language))} | ${cell(humanize(workflow.slice))} | ${cell(formatJourneyTouchpoint(workflow) || text.systemTouchpoint)} | ${cell(formatWorkflowResult(workflow, language))} | ${cell(formatJourneyEvidence(workflow, language))} |`);
    });
    lines.push('');
  }

  section(lines, text.momentsAndRules);
  appendList(lines, [
    ...bundle.workflows.flatMap((workflow) =>
      workflow.specifications.map((specification) =>
        `${humanize(workflow.slice)}: ${formatSpecificationSummary(specification, language)}`
      )
    ),
    ...bundle.workflows.flatMap((workflow) =>
      workflow.hotspots.map((hotspot) => `${humanize(workflow.slice)}: ${hotspot}`)
    )
  ], text.noRules);
  lines.push('');

  section(lines, text.dataAndFeedback);
  if (bundle.readmodels.length) {
    lines.push(`| ${text.readModel} | ${text.whereAppears} | ${text.updatedBy} | ${text.userValue} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const readmodel of bundle.readmodels) {
      lines.push(`| ${cell(humanize(readmodel.name))} | ${cell(`${humanize(readmodel.context)} / ${humanize(readmodel.slice)}`)} | ${cell(readmodel.sourceEvents.map(humanize).join(', ') || text.notModeled)} | ${cell(formatReadModelAccess(readmodel, language))} |`);
    }
  } else {
    lines.push(text.noReadmodels);
  }
  lines.push('');

  section(lines, text.aiPrompt);
  lines.push(text.aiPromptIntro);
  lines.push('');
  lines.push('```text');
  lines.push(...text.promptLines);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
};

export const renderInstallationManualMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = installationManualText[language];
  const guide = installationGuideText[language];
  const lines = header(bundle, text.title, language);

  section(lines, guide.documentOverview);
  lines.push(guide.documentPurpose(bundle.title));
  lines.push('');
  appendDiagnostics(lines, bundle, language);
  appendTable(lines, [guide.item, guide.content], [
    [guide.systemName, bundle.title],
    [guide.softwareVersion, medolSoftwareVersion],
    [guide.manualVersion, medolSoftwareVersion],
    [guide.releaseDate, bundle.generatedAt.slice(0, 10)],
    [guide.deploymentMode, guide.deploymentModeValue],
    [guide.targetReaders, guide.targetReadersValue],
    [guide.prerequisites, guide.prerequisitesValue]
  ]);
  lines.push('');

  section(lines, guide.deploymentArchitecture);
  lines.push(`### ${guide.systemComponents}`);
  lines.push('');
  appendTable(lines, [guide.component, guide.installLocation, guide.description], buildInstallationComponentRows(bundle, language));
  lines.push('');
  lines.push(`### ${guide.deploymentTopology}`);
  lines.push('');
  appendInstallationTopology(lines, bundle, language);
  lines.push('');
  lines.push(`### ${guide.componentDependencies}`);
  lines.push('');
  appendTable(lines, [guide.sourceComponent, guide.targetComponent, guide.relationship], buildInstallationDependencyRows(bundle, language));
  lines.push('');

  section(lines, guide.environmentRequirements);
  lines.push(`### ${guide.hardwareRequirements}`);
  lines.push('');
  appendTable(lines, [guide.resource, guide.minimum, guide.testRecommended, guide.productionRecommended], buildHardwareRequirementRows(language));
  lines.push('');
  lines.push(`### ${guide.softwareRequirements}`);
  lines.push('');
  appendTable(lines, [guide.software, guide.supportedVersion, guide.note], buildSoftwareRequirementRows(language));
  lines.push('');

  section(lines, guide.networkRequirements);
  appendTable(lines, [guide.source, guide.destination, guide.port, guide.protocol, guide.purpose], buildPortRequirementRows(bundle, language));
  lines.push('');
  appendList(lines, guide.networkChecklist(bundle));
  lines.push('');

  section(lines, guide.preInstallationPreparation);
  lines.push(`### ${guide.installationMedia}`);
  lines.push('');
  lines.push(guide.mediaDescription);
  lines.push('');
  lines.push('```text');
  lines.push(...guide.mediaTree(bundle.title));
  lines.push('```');
  lines.push('');
  appendTable(lines, [guide.artifact, guide.version, guide.checksum, guide.description], buildInstallationMediaRows(bundle, language));
  lines.push('');
  lines.push(`### ${guide.preparationChecklist}`);
  lines.push('');
  appendTable(lines, [guide.preparationItem, guide.commandOrAction, guide.expectedResult], buildPreInstallationRows(bundle, language));
  lines.push('');

  section(lines, guide.systemInstallation);
  appendTable(lines, [guide.step, guide.operationPurpose, guide.command, guide.expectedOutput, guide.exceptionHandling], buildSystemInstallationRows(bundle, language));
  lines.push('');

  section(lines, guide.systemConfiguration);
  appendTable(lines, [guide.parameter, guide.required, guide.defaultValue, guide.example, guide.description], buildInstallationConfigRows(bundle, language));
  lines.push('');

  section(lines, guide.systemInitialization);
  appendTable(lines, [guide.initializationItem, guide.action, guide.expectedResult], buildSystemInitializationRows(bundle, language));
  lines.push('');

  section(lines, guide.serviceLifecycle);
  appendTable(lines, [guide.operation, guide.command, guide.description], buildServiceLifecycleRows(language));
  lines.push('');
  appendList(lines, guide.lifecycleOrder);
  lines.push('');

  section(lines, guide.installationVerification);
  appendTable(lines, [guide.verificationLevel, guide.verificationMethod, guide.successCriteria], buildInstallationAcceptanceRows(bundle, language));
  lines.push('');

  section(lines, guide.upgradeRollback);
  appendTable(lines, [guide.phase, guide.action, guide.note], buildUpgradeRollbackRows(language));
  lines.push('');

  section(lines, guide.troubleshooting);
  lines.push(`### ${guide.logLocations}`);
  lines.push('');
  appendTable(lines, [guide.component, guide.logLocation, guide.checkCommand], buildLogLocationRows(language));
  lines.push('');
  lines.push(`### ${guide.commonIssues}`);
  lines.push('');
  appendTable(lines, [guide.problem, guide.possibleCause, guide.checkMethod], buildTroubleshootingRows(language));
  lines.push('');

  return lines.join('\n');
};

export const renderUserManualMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = userManualText[language];
  const lines = header(bundle, text.title, language);

  section(lines, text.overview);
  lines.push(text.overviewBody(bundle));
  lines.push('');
  appendDiagnostics(lines, bundle, language);

  section(lines, text.rolesAndAccess);
  const actors = [...new Set(bundle.workflows.map((workflow) => workflow.actor).filter((actor): actor is string => Boolean(actor)))];
  if (actors.length) {
    lines.push(`| ${text.role} | ${text.availableCapabilities} | ${text.primaryEntry} |`);
    lines.push('| --- | --- | --- |');
    for (const actor of actors) {
      const workflows = bundle.workflows.filter((workflow) => workflow.actor === actor);
      lines.push(`| ${cell(humanize(actor))} | ${cell(workflows.map((workflow) => humanize(workflow.slice)).join(', ') || text.notModeled)} | ${cell(workflows.map((workflow) => workflow.ui?.name ? humanize(workflow.ui.name) : undefined).filter(Boolean).join(', ') || text.systemEntry)} |`);
    }
  } else {
    lines.push(text.noActors);
  }
  lines.push('');

  section(lines, text.quickStart);
  appendList(lines, text.quickStartChecklist(bundle));
  lines.push('');

  section(lines, text.featureGuide);
  for (const context of bundle.contexts) {
    lines.push(`<!-- em:section id="user-manual.context.${context.name}" source="${context.id}" -->`);
    lines.push(`### ${humanize(context.name)}`);
    lines.push('');
    lines.push(`${text.contextSummary}: ${context.notes.join(' ') || text.notModeled}`);
    lines.push('');
    const workflows = bundle.workflows.filter((workflow) => workflow.context === context.name);
    if (!workflows.length) {
      lines.push(text.noCapabilities);
      lines.push('');
      continue;
    }
    for (const workflow of workflows) appendUserWorkflow(lines, workflow, language);
  }

  section(lines, text.dataViews);
  if (bundle.readmodels.length) {
    lines.push(`| ${text.readModel} | ${text.whereUsed} | ${text.searchAndKeys} | ${text.updatedBy} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const readmodel of bundle.readmodels) {
      lines.push(`| ${cell(humanize(readmodel.name))} | ${cell(`${humanize(readmodel.context)} / ${humanize(readmodel.slice)}`)} | ${cell(formatReadModelAccess(readmodel, language))} | ${cell(readmodel.sourceEvents.map(humanize).join(', ') || text.notModeled)} |`);
    }
  } else {
    lines.push(text.noReadmodels);
  }
  lines.push('');

  section(lines, text.rulesAndExceptions);
  const ruleRows = summarizeSpecifications(bundle, language);
  appendList(lines, ruleRows, text.noRules);
  lines.push('');

  section(lines, text.troubleshooting);
  appendList(lines, text.troubleshootingChecklist(bundle));
  lines.push('');

  return lines.join('\n');
};

const appendUserWorkflow = (
  lines: string[],
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): void => {
  const text = userManualText[language];
  lines.push(`<!-- em:section id="user-manual.slice.${workflow.slice}" source="${workflow.id}" -->`);
  lines.push(`#### ${humanize(workflow.slice)}`);
  lines.push('');
  lines.push(`| ${text.item} | ${text.description} |`);
  lines.push('| --- | --- |');
  lines.push(`| ${text.entry} | ${cell(workflow.ui?.name ? `${humanize(workflow.ui.name)}${workflow.ui.type ? ` (${workflow.ui.type})` : ''}` : text.systemEntry)} |`);
  lines.push(`| ${text.actorOrTrigger} | ${cell(workflow.actor ? humanize(workflow.actor) : workflow.processors.map(humanize).join(', ') || text.system)} |`);
  lines.push(`| ${text.businessObject} | ${cell(humanize(workflow.aggregate))} |`);
  lines.push(`| ${text.successResult} | ${cell(formatWorkflowResult(workflow, language))} |`);
  lines.push('');

  appendList(lines, text.workflowSteps(workflow));
  lines.push('');
  appendUserInputTable(lines, workflow, language);
  if (workflow.specifications.length || workflow.hotspots.length) {
    lines.push(`**${text.notes}**`);
    lines.push('');
    appendList(lines, [
      ...workflow.specifications.map((specification) => formatSpecificationSummary(specification, language)),
      ...workflow.hotspots.map((hotspot) => `${text.reviewQuestion}: ${hotspot}`)
    ]);
    lines.push('');
  }
};

const appendUserInputTable = (
  lines: string[],
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): void => {
  const text = userManualText[language];
  const fields = workflow.commands.flatMap((command) =>
    command.fields.map((field) => ({ command: command.name, field }))
  );
  if (!fields.length) {
    lines.push(text.noInputFields);
    lines.push('');
    return;
  }
  lines.push(`| ${text.command} | ${text.field} | ${text.type} | ${text.requirement} | ${text.exampleOrRule} |`);
  lines.push('| --- | --- | --- | --- | --- |');
  for (const { command, field } of fields) {
    lines.push(`| ${cell(humanize(command))} | ${cell(field.name)} | ${cell(field.type)} | ${cell(formatFieldRequirement(field, language))} | ${cell(formatFieldUsage(field, language))} |`);
  }
  lines.push('');
};

const appendTable = (lines: string[], headers: string[], rows: string[][]): void => {
  lines.push(`| ${headers.map(cell).join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${row.map(cell).join(' | ')} |`);
  }
};

const hasUiWorkflows = (bundle: DocumentationBundle): boolean =>
  bundle.workflows.some((workflow) => Boolean(workflow.ui));

const hasFileFlow = (bundle: DocumentationBundle): boolean =>
  bundle.workflows.some((workflow) =>
    workflow.commands.some((command) =>
      command.fields.some((field) =>
        field.attributes.includes('uploadFile')
        || field.attributes.includes('file')
        || /file|upload|attachment/i.test(field.name)
      )
    )
  );

const hasAsyncFlow = (bundle: DocumentationBundle): boolean =>
  bundle.workflows.some((workflow) => workflow.processors.length > 0)
  || bundle.integrations.length > 0
  || bundle.contexts.some((context) => context.externalSystems.length > 0);

const hasRuntimeAgent = (bundle: DocumentationBundle): boolean =>
  [
    ...bundle.deployments.map((deployment) => deployment.name),
    ...bundle.contexts.map((context) => context.name),
    ...bundle.workflows.flatMap((workflow) => [
      workflow.slice,
      workflow.aggregate,
      workflow.actor ?? '',
      ...workflow.processors
    ])
  ].some((value) => /runtime|agent|node/i.test(value));

const productSlug = (value: string): string =>
  value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  || 'product';

const buildInstallationComponentRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    ...(hasUiWorkflows(bundle) ? [[text.webComponent, text.edgeOrWebNode, text.webComponentDescription]] : []),
    [text.backendComponent, text.applicationNode, text.backendComponentDescription],
    [text.databaseComponent, text.databaseNode, text.databaseComponentDescription],
    ...(hasFileFlow(bundle) ? [[text.storageComponent, text.storageNode, text.storageComponentDescription]] : []),
    ...(hasAsyncFlow(bundle) ? [[text.middlewareComponent, text.middlewareNode, text.middlewareComponentDescription]] : []),
    ...(hasRuntimeAgent(bundle) ? [[text.agentComponent, text.runtimeNode, text.agentComponentDescription]] : []),
    ...(collectManualDependencyRows(bundle, language).length
      ? [[text.externalComponent, text.externalNetwork, text.externalComponentDescription]]
      : [])
  ];
};

const buildInstallationDependencyRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    ...(hasUiWorkflows(bundle) ? [[text.webComponent, text.backendComponent, text.webToBackend]] : []),
    [text.backendComponent, text.databaseComponent, text.backendToDatabase],
    ...(hasFileFlow(bundle) ? [[text.backendComponent, text.storageComponent, text.backendToStorage]] : []),
    ...(hasAsyncFlow(bundle) ? [[text.backendComponent, text.middlewareComponent, text.backendToMiddleware]] : []),
    ...(hasRuntimeAgent(bundle) ? [[text.agentComponent, text.backendComponent, text.agentToPlatform]] : []),
    ...collectManualDependencyRows(bundle, language)
      .slice(0, 8)
      .map((dependency) => [text.backendComponent, dependency.name, dependency.configuration])
  ];
};

const appendInstallationTopology = (
  lines: string[],
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): void => {
  const text = installationGuideText[language];
  const nodes = [
    ['User', text.userBrowser],
    ['Web', hasUiWorkflows(bundle) ? text.webComponent : text.reverseProxyPlaceholder],
    ['Api', text.backendComponent],
    ['Db', text.databaseComponent],
    ...(hasFileFlow(bundle) ? [['Storage', text.storageComponent]] : []),
    ...(hasAsyncFlow(bundle) ? [['Middleware', text.middlewareComponent]] : []),
    ...(hasRuntimeAgent(bundle) ? [['Agent', text.agentComponent]] : []),
    ...(collectManualDependencyRows(bundle, language).length ? [['External', text.externalComponent]] : [])
  ];
  lines.push('```mermaid');
  lines.push('flowchart TB');
  for (const [id, label] of nodes) lines.push(`  ${id}["${mermaidLabel(label)}"]`);
  lines.push('  User --> Web');
  lines.push('  Web --> Api');
  lines.push('  Api --> Db');
  if (hasFileFlow(bundle)) lines.push('  Api --> Storage');
  if (hasAsyncFlow(bundle)) lines.push('  Api --> Middleware');
  if (hasRuntimeAgent(bundle)) lines.push('  Agent --> Api');
  if (collectManualDependencyRows(bundle, language).length) lines.push('  Api --> External');
  lines.push('```');
};

const buildHardwareRequirementRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    ['CPU', '4 Core', '4-8 Core', '8 Core+'],
    ['RAM', '8 GB', '16 GB', '32 GB+'],
    ['Disk', '50 GB', '100 GB SSD', '200 GB SSD+'],
    [text.architectureResource, text.supportedArchitectures, text.supportedArchitectures, text.supportedArchitectures],
    [text.operatingSystemResource, text.linuxRequirement, text.linuxRequirement, text.linuxRequirement]
  ];
};

const buildSoftwareRequirementRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    ['Container Runtime', 'Docker 27+ / Podman', text.confirmDeliveryMode],
    ['Database', `PostgreSQL 16 or compatible managed database (${defaultInstallationDatabaseName})`, text.externalOrBundledDatabase],
    ['JDK', '21', text.requiredWhenJvmBackend],
    ['Node.js', '22+', text.requiredWhenNodeTools],
    ['Browser', 'Latest Chrome / Edge / Firefox', text.webConsoleAccess],
    ['NTP', text.enabled, text.requiredForDistributedDeployment]
  ];
};

const buildPortRequirementRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.userOrAdmin, text.webComponent, '443', 'HTTPS', text.webAccessPurpose],
    [text.adminHost, text.serverHost, '22', 'SSH', text.opsPurpose],
    [text.webComponent, text.backendComponent, '8080', 'HTTP/HTTPS', text.apiPurpose],
    [text.backendComponent, text.databaseComponent, '5432', 'TCP', text.databasePurpose],
    ...(hasFileFlow(bundle) ? [[text.backendComponent, text.storageComponent, '9000 / 443', 'S3/HTTPS', text.storagePurpose]] : []),
    ...(hasAsyncFlow(bundle) ? [[text.backendComponent, text.middlewareComponent, text.toBeFilled, 'TCP/HTTP', text.middlewarePurpose]] : []),
    ...(hasRuntimeAgent(bundle) ? [[text.agentComponent, text.backendComponent, '443', 'HTTPS', text.agentPurpose]] : []),
    ...collectManualDependencyRows(bundle, language)
      .slice(0, 6)
      .map((dependency) => [text.backendComponent, dependency.name, text.toBeFilled, 'HTTPS/TCP', dependency.verification])
  ];
};

const buildInstallationMediaRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    [`${productSlug(bundle.title)}-backend`, medolSoftwareVersion, 'SHA256:<...>', text.backendPackageDescription],
    ...(hasUiWorkflows(bundle) ? [[`${productSlug(bundle.title)}-web`, medolSoftwareVersion, 'SHA256:<...>', text.webPackageDescription]] : []),
    ...(hasRuntimeAgent(bundle) ? [[`${productSlug(bundle.title)}-runtime-agent`, medolSoftwareVersion, 'SHA256:<...>', text.agentPackageDescription]] : []),
    ['docker-compose.yml / k8s manifests', medolSoftwareVersion, 'SHA256:<...>', text.deploymentManifestDescription],
    ['.env.example / config/', medolSoftwareVersion, 'SHA256:<...>', text.configTemplateDescription],
    ['scripts/', medolSoftwareVersion, 'SHA256:<...>', text.scriptDescription],
    ['LICENSE / license.key', medolSoftwareVersion, 'SHA256:<...>', text.licenseDescription]
  ];
};

const buildPreInstallationRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.osReady, '`uname -a` / `hostnamectl`', text.osReadyExpected],
    [text.timeReady, '`timedatectl status`', text.timeReadyExpected],
    [text.containerReady, '`docker --version` / `docker compose version`', text.containerReadyExpected],
    [text.directoryReady, '`mkdir -p /opt/<product> /var/log/<product>`', text.directoryReadyExpected],
    [text.userReady, '`id <install_user>`', text.userReadyExpected],
    [text.databaseReady, `\`psql -h <db_host> -U <user> -d ${defaultInstallationDatabaseName}\``, text.databaseReadyExpected],
    [text.networkReady, '`nc -vz <host> <port>`', text.networkReadyExpected],
    ...(hasFileFlow(bundle) ? [[text.storageReady, '`aws s3 ls s3://<bucket>`', text.storageReadyExpected]] : []),
    [text.certificateReady, '`openssl x509 -in <cert.pem> -noout -dates`', text.certificateReadyExpected]
  ];
};

const buildSystemInstallationRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.installStepBase, text.installStepBasePurpose, '`./scripts/check-env.sh`', text.installStepBaseExpected, text.installStepBaseException],
    [text.installStepDatabase, text.installStepDatabasePurpose, '`./scripts/migrate.sh`', text.installStepDatabaseExpected, text.installStepDatabaseException],
    ...(hasAsyncFlow(bundle) ? [[text.installStepMiddleware, text.installStepMiddlewarePurpose, '`docker compose up -d redis mq`', text.installStepMiddlewareExpected, text.installStepMiddlewareException]] : []),
    [text.installStepBackend, text.installStepBackendPurpose, '`docker compose up -d backend`', text.installStepBackendExpected, text.installStepBackendException],
    ...(hasUiWorkflows(bundle) ? [[text.installStepFrontend, text.installStepFrontendPurpose, '`docker compose up -d web`', text.installStepFrontendExpected, text.installStepFrontendException]] : []),
    ...(hasRuntimeAgent(bundle) ? [[text.installStepAgent, text.installStepAgentPurpose, '`docker compose up -d runtime-agent`', text.installStepAgentExpected, text.installStepAgentException]] : []),
    [text.installStepStartAll, text.installStepStartAllPurpose, '`docker compose up -d`', text.installStepStartAllExpected, text.installStepStartAllException]
  ];
};

const buildInstallationConfigRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  return [
    ['DB_HOST', text.yes, '-', '10.0.0.20', text.dbHostDescription],
    ['DB_PORT', text.no, '5432', '5432', text.dbPortDescription],
    ['DB_NAME', text.yes, defaultInstallationDatabaseName, defaultInstallationDatabaseName, text.dbNameDescription],
    ['DB_USER', text.yes, '-', '<db_user>', text.dbUserDescription],
    ['DB_PASSWORD', text.yes, '-', '<database_password>', text.secretValueDescription],
    ['SERVER_PORT', text.no, '8080', '8080', text.serverPortDescription],
    ['PUBLIC_BASE_URL', text.yes, '-', 'https://example.com', text.publicBaseUrlDescription],
    ['JWT_SECRET', text.yes, '-', '<random_secret>', text.secretValueDescription],
    ['LOG_LEVEL', text.no, 'INFO', 'INFO', text.logLevelDescription],
    ...(hasFileFlow(bundle) ? [
      ['STORAGE_ENDPOINT', text.yes, '-', 'https://s3.example.com', text.storageEndpointDescription],
      ['STORAGE_BUCKET', text.yes, '-', `${productSlug(bundle.title)}-files`, text.storageBucketDescription]
    ] : []),
    ...(hasRuntimeAgent(bundle) ? [
      ['PLATFORM_API_URL', text.yes, '-', 'https://platform.example.com', text.platformApiUrlDescription],
      ['RUNTIME_AGENT_TOKEN', text.yes, '-', '<agent_token>', text.secretValueDescription]
    ] : [])
  ];
};

const buildSystemInitializationRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  const referenceData = bundle.contexts
    .filter((context) => /dictionary|catalog|reference/i.test(context.name))
    .map((context) => humanize(context.name))
    .join(', ') || text.baseReferenceData;
  return [
    [text.initDatabase, '`./scripts/init-db.sh`', text.initDatabaseExpected],
    [text.initAdmin, '`./scripts/create-admin.sh --user <admin>`', text.initAdminExpected],
    [text.initSystemParams, '`./scripts/init-config.sh`', text.initSystemParamsExpected],
    [text.initBaseData, `Import ${referenceData}`, text.initBaseDataExpected],
    [text.initLicense, 'Copy license file or configure license key', text.initLicenseExpected]
  ];
};

const buildServiceLifecycleRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.start, '`docker compose up -d` / `systemctl start <service>`', text.startDescription],
    [text.stop, '`docker compose down` / `systemctl stop <service>`', text.stopDescription],
    [text.restart, '`docker compose restart` / `systemctl restart <service>`', text.restartDescription],
    [text.status, '`docker compose ps` / `systemctl status <service>`', text.statusDescription]
  ];
};

const buildInstallationAcceptanceRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[][] => {
  const text = installationGuideText[language];
  const smokeCapabilities = selectInstallationSmokeWorkflows(bundle)
    .slice(0, 3)
    .map((workflow) => humanize(workflow.slice))
    .join(', ') || text.toBeFilled;
  return [
    [text.infrastructureVerification, '`docker compose ps` / service status', text.infrastructureVerificationExpected],
    [text.healthVerification, '`curl -fsS <base_url>/health`', text.healthVerificationExpected],
    [text.eventStoreVerification, `\`psql -h <db_host> -U <user> -d ${defaultInstallationDatabaseName} -c "select 1"\``, text.eventStoreVerificationExpected],
    [text.pageVerification, 'Open `<PUBLIC_BASE_URL>` in browser', text.pageVerificationExpected],
    [text.loginVerification, text.loginVerificationMethod, text.loginVerificationExpected],
    [text.businessSmokeVerification, `${text.businessSmokeVerificationPrefix}: ${smokeCapabilities}`, text.businessSmokeVerificationExpected]
  ];
};

const buildLogLocationRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.webComponent, '/var/log/nginx/ or container logs', '`docker compose logs -f web`'],
    [text.backendComponent, '/opt/<product>/logs/application.log', '`docker compose logs -f backend`'],
    [text.databaseComponent, text.databaseLogLocation, '`docker compose logs -f db`'],
    [text.agentComponent, '/opt/<product-agent>/logs/', '`docker compose logs -f runtime-agent`']
  ];
};

const buildTroubleshootingRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.problemPageUnavailable, text.causeWebStopped, '`docker compose ps web` / `systemctl status nginx`'],
    [text.problemBackendFailed, text.causeDbConnection, text.checkDatabaseConfig],
    [text.problemLoginFailed, text.causeInitializationMissing, 'Check administrator initialization and authentication config'],
    [text.problemDependencyUnavailable, text.causeNetworkOrCredential, '`nc -vz <host> <port>` and dependency logs'],
    [text.problemFileUploadFailed, text.causeStorageConfig, 'Check storage endpoint, bucket, credential, and size limit']
  ];
};

const buildUpgradeRollbackRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.phaseBackup, text.actionBackup, text.noteBackup],
    [text.phaseStop, text.actionStop, text.noteStop],
    [text.phaseUpgrade, text.actionUpgrade, text.noteUpgrade],
    [text.phaseMigration, text.actionMigration, text.noteMigration],
    [text.phaseVerify, text.actionVerify, text.noteVerify],
    [text.phaseRollback, text.actionRollback, text.noteRollback]
  ];
};

const buildUninstallRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    [text.uninstallProgram, '`docker compose down`', text.uninstallProgramDescription],
    [text.removeServiceFiles, '`rm -rf /opt/<product>`', text.removeServiceFilesDescription],
    [text.removeData, '`docker compose down -v`', text.removeDataDescription],
    [text.removeAccounts, '`userdel <install_user>`', text.removeAccountsDescription]
  ];
};

const buildDirectoryRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    ['/opt/<product>/', text.dirInstall, text.dirInstallNote],
    ['/opt/<product>/config/', text.dirConfig, text.dirConfigNote],
    ['/opt/<product>/scripts/', text.dirScripts, text.dirScriptsNote],
    ['/var/log/<product>/', text.dirLogs, text.dirLogsNote],
    ['/var/lib/<product>/', text.dirData, text.dirDataNote],
    ['/backup/<product>/', text.dirBackup, text.dirBackupNote]
  ];
};

const buildCommonCommandRows = (language: DocumentationLanguage): string[][] => {
  const text = installationGuideText[language];
  return [
    ...buildServiceLifecycleRows(language),
    [text.osReady, '`uname -a` / `hostnamectl`', text.osReadyExpected],
    [text.timeReady, '`timedatectl status`', text.timeReadyExpected],
    [text.containerReady, '`docker --version` / `docker compose version`', text.containerReadyExpected],
    [text.databaseReady, '`psql -h <db_host> -U <user> -d <db>`', text.databaseReadyExpected],
    [text.networkReady, '`nc -vz <host> <port>`', text.networkReadyExpected]
  ];
};

const buildEnvironmentPreparationRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): Array<{
  item: string;
  content: string;
  confirmation: string;
}> => {
  const text = installationManualText[language];
  const dependencyNames = collectManualDependencyRows(bundle, language)
    .slice(0, 5)
    .map((row) => row.name)
    .join(', ');
  const hasFileFlow = bundle.workflows.some((workflow) =>
    workflow.commands.some((command) =>
      command.fields.some((field) =>
        field.attributes.includes('uploadFile')
        || field.attributes.includes('file')
        || /file/i.test(field.name)
      )
    )
  );
  const hasAsyncFlow = bundle.workflows.some((workflow) => workflow.processors.length > 0)
    || bundle.integrations.length > 0
    || bundle.contexts.some((context) => context.externalSystems.length > 0);

  return [
    {
      item: text.runtimeEnvironment,
      content: text.runtimeEnvironmentContent,
      confirmation: text.runtimeEnvironmentConfirmation
    },
    {
      item: text.databaseEnvironment,
      content: text.databaseEnvironmentContent,
      confirmation: text.databaseEnvironmentConfirmation
    },
    {
      item: text.configSecretEnvironment,
      content: text.configSecretEnvironmentContent,
      confirmation: text.configSecretEnvironmentConfirmation
    },
    {
      item: text.networkTlsEnvironment,
      content: text.networkTlsEnvironmentContent(dependencyNames || text.noNamedDependencies),
      confirmation: text.networkTlsEnvironmentConfirmation
    },
    ...(hasFileFlow
      ? [{
          item: text.fileStorageEnvironment,
          content: text.fileStorageEnvironmentContent,
          confirmation: text.fileStorageEnvironmentConfirmation
        }]
      : []),
    ...(hasAsyncFlow
      ? [{
          item: text.asyncEnvironment,
          content: text.asyncEnvironmentContent,
          confirmation: text.asyncEnvironmentConfirmation
        }]
      : []),
    {
      item: text.observabilityEnvironment,
      content: text.observabilityEnvironmentContent,
      confirmation: text.observabilityEnvironmentConfirmation
    },
    {
      item: text.initialAccessEnvironment,
      content: text.initialAccessEnvironmentContent,
      confirmation: text.initialAccessEnvironmentConfirmation
    },
    {
      item: text.backupRollbackEnvironment,
      content: text.backupRollbackEnvironmentContent,
      confirmation: text.backupRollbackEnvironmentConfirmation
    }
  ];
};

const collectManualDependencyRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): Array<{
  name: string;
  context: string;
  configuration: string;
  verification: string;
}> => {
  const text = installationManualText[language];
  return [
    ...bundle.integrations.map((integration) => ({
      name: humanize(integration.name),
      context: humanize(integration.context),
      configuration: [integration.source, integration.target].filter(Boolean).map(humanize).join(' -> ') || text.endpointConfiguration,
      verification: text.integrationVerification
    })),
    ...bundle.contexts.flatMap((context) =>
      context.externalSystems.map((system) => ({
        name: humanize(system.name),
        context: humanize(context.name),
        configuration: [
          system.kind ? humanize(system.kind) : undefined,
          system.protocol,
          system.capabilities.map((capability) => `${capability.type}:${humanize(capability.name)}`).join(', ')
        ].filter(Boolean).join(' / ') || text.endpointConfiguration,
        verification: text.externalSystemVerification
      }))
    )
  ];
};

const formatInstallationCheck = (
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): string => {
  const text = installationManualText[language];
  const command = workflow.commands.map((item) => humanize(item.name)).join(', ');
  if (workflow.startsLifecycle) return `${text.runInitialCommand}: ${command || humanize(workflow.slice)}`;
  if (workflow.processors.length) return `${text.verifyAutomation}: ${workflow.processors.map(humanize).join(', ')}`;
  return `${text.runSmokeTest}: ${command || humanize(workflow.slice)}`;
};

const buildInstallationVerificationRows = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): Array<{
  item: string;
  method: string;
  successCriteria: string;
}> => {
  const text = installationManualText[language];
  const dependencies = collectManualDependencyRows(bundle, language)
    .slice(0, 5)
    .map((row) => row.name)
    .join(', ') || text.notModeled;
  const readmodels = bundle.readmodels
    .slice(0, 5)
    .map((readmodel) => humanize(readmodel.name))
    .join(', ') || text.notModeled;
  const smokeCapabilities = selectInstallationSmokeWorkflows(bundle)
    .map((workflow) => humanize(workflow.slice))
    .join(', ') || text.notModeled;

  return [
    {
      item: text.serviceStartup,
      method: text.serviceStartupMethod(bundle),
      successCriteria: text.serviceStartupSuccess
    },
    {
      item: text.configurationVerification,
      method: text.configurationVerificationMethod(dependencies),
      successCriteria: text.configurationVerificationSuccess
    },
    {
      item: text.dataVerification,
      method: text.dataVerificationMethod(readmodels),
      successCriteria: text.dataVerificationSuccess
    },
    {
      item: text.businessSmokeVerification,
      method: text.businessSmokeVerificationMethod(smokeCapabilities),
      successCriteria: text.businessSmokeVerificationSuccess
    },
    {
      item: text.observabilityVerification,
      method: text.observabilityVerificationMethod,
      successCriteria: text.observabilityVerificationSuccess
    },
    {
      item: text.rollbackVerification,
      method: text.rollbackVerificationMethod,
      successCriteria: text.rollbackVerificationSuccess
    }
  ];
};

const selectInstallationSmokeWorkflows = (
  bundle: DocumentationBundle
): DocumentationWorkflow[] => {
  const selected: DocumentationWorkflow[] = [];
  const add = (workflow: DocumentationWorkflow | undefined) => {
    if (!workflow || selected.some((item) => item.id === workflow.id)) return;
    selected.push(workflow);
  };
  add(bundle.workflows.find((workflow) => workflow.startsLifecycle));
  add(bundle.workflows.find((workflow) => workflow.actor));
  add(bundle.workflows.find((workflow) => workflow.processors.length));
  add(bundle.workflows.find((workflow) => workflow.readmodels.length));
  add(bundle.workflows.find((workflow) => workflow.specifications.length));
  for (const workflow of bundle.workflows) {
    if (selected.length >= 5) break;
    add(workflow);
  }
  return selected.slice(0, 5);
};

const formatReadModelAccess = (
  readmodel: DocumentationReadModel,
  language: DocumentationLanguage
): string => {
  const text = userManualText[language];
  return [
    readmodel.identifierFields.length
      ? `${text.identifier}: ${readmodel.identifierFields.join(', ')}`
      : undefined,
    readmodel.queryFields.length
      ? `${text.query}: ${readmodel.queryFields.join(', ')}`
      : undefined,
    readmodel.collection ? text.listView : text.detailView
  ].filter(Boolean).join('; ');
};

const collectJourneyActors = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage
): string[] =>
  [...new Set(bundle.workflows.map((workflow) => journeyActor(workflow, language)))];

const journeyActor = (
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): string => {
  if (workflow.actor) return humanize(workflow.actor);
  if (workflow.processors.length) return workflow.processors.map(humanize).join(', ');
  return userJourneyText[language].systemActor;
};

const formatJourneyTouchpoint = (workflow: DocumentationWorkflow): string =>
  workflow.ui?.name
    ? `${humanize(workflow.ui.name)}${workflow.ui.type ? ` (${workflow.ui.type})` : ''}`
    : '';

const formatJourneyEvidence = (
  workflow: DocumentationWorkflow,
  language: DocumentationLanguage
): string => {
  const text = userJourneyText[language];
  return [
    workflow.commands.length ? `${text.command}: ${workflow.commands.map((command) => humanize(command.name)).join(', ')}` : undefined,
    workflow.events.length ? `${text.event}: ${workflow.events.map((event) => humanize(event.name)).join(', ')}` : undefined,
    workflow.readmodels.length ? `${text.readModel}: ${workflow.readmodels.map(humanize).join(', ')}` : undefined
  ].filter(Boolean).join('; ') || text.notModeled;
};

const formatFieldRequirement = (
  field: DocumentationField,
  language: DocumentationLanguage
): string => {
  const zh = language === 'zh-CN';
  if (field.attributes.includes('optional')) return zh ? '可选' : 'Optional';
  if (field.attributes.includes('id')) return zh ? '必填标识' : 'Required identifier';
  return zh ? '必填/按业务规则' : 'Required / business rule';
};

const formatFieldUsage = (
  field: DocumentationField,
  language: DocumentationLanguage
): string => {
  const zh = language === 'zh-CN';
  return [
    field.example ? `${zh ? '示例' : 'Example'}: ${field.example}` : undefined,
    field.mapping ? formatMapping(field, zh) : undefined,
    field.attributes.filter((attribute) => attribute !== 'optional').join(', ') || undefined
  ].filter(Boolean).join('; ') || '-';
};

const installationGuideText = {
  en: {
    title: 'Installation And Deployment Guide',
    documentOverview: 'System Description',
    documentPurpose: (title: string) =>
      `This manual describes how to install ${title} from a clean environment to a running and verified system. It focuses on what to install, where to install it, required dependencies, configuration, startup, verification, and common failure handling.`,
    item: 'Item',
    content: 'Content',
    systemName: 'System name',
    softwareVersion: 'Software version',
    manualVersion: 'Guide version',
    releaseDate: 'Release date',
    deploymentMode: 'Applicable deployment mode',
    deploymentModeValue: 'Standalone, Docker Compose, or Kubernetes deployment; confirm the final delivery mode before release.',
    targetReaders: 'Target readers',
    targetReadersValue: 'System administrators, implementation engineers, and operations engineers.',
    prerequisites: 'Prerequisites',
    prerequisitesValue: 'Basic Linux, database, network, certificate, and container-runtime operation knowledge.',
    toBeFilled: 'TBD',
    deploymentArchitecture: 'Deployment Architecture',
    systemComponents: 'System Components',
    component: 'Component',
    installLocation: 'Install Location',
    description: 'Description',
    deploymentTopology: 'Deployment Topology',
    componentDependencies: 'Component Dependencies',
    sourceComponent: 'Source Component',
    targetComponent: 'Target Component',
    relationship: 'Relationship',
    webComponent: 'Web Frontend / Reverse Proxy',
    edgeOrWebNode: 'Web or edge node',
    webComponentDescription: 'Serves browser access, static assets, reverse proxy rules, and entry routing.',
    backendComponent: 'Backend API Service',
    applicationNode: 'Application node',
    backendComponentDescription: 'Provides APIs, command handling, validation, business orchestration, and integration calls.',
    databaseComponent: `Database / Event Store (${defaultInstallationDatabaseName})`,
    databaseNode: `${defaultInstallationDatabaseName} database node or managed database`,
    databaseComponentDescription: `Uses ${defaultInstallationDatabaseName} as the unified database for event storage, business state, configuration data, and query/read-model data.`,
    storageComponent: 'Object/File Storage',
    storageNode: 'Storage service or mounted volume',
    storageComponentDescription: 'Stores uploaded files, temporary staging files, and generated artifacts.',
    middlewareComponent: 'Middleware / Scheduler / Message Channel',
    middlewareNode: 'Middleware node or managed service',
    middlewareComponentDescription: 'Supports asynchronous jobs, scheduled tasks, retries, and integration channels.',
    agentComponent: 'Runtime Agent',
    runtimeNode: 'Runtime node',
    agentComponentDescription: 'Connects runtime nodes to the platform and reports runtime status or execution results.',
    externalComponent: 'External Systems',
    externalNetwork: 'External network or managed service',
    externalComponentDescription: 'External dependencies that must be reachable before installation verification.',
    webToBackend: 'Forwards API traffic and authentication/session requests.',
    backendToDatabase: 'Appends events and reads/writes persistent business data and query data.',
    backendToStorage: 'Reads and writes uploaded files or generated artifacts.',
    backendToMiddleware: 'Publishes jobs, consumes messages, and executes scheduled work.',
    agentToPlatform: 'Runtime agent initiates control-plane or status-reporting communication.',
    userBrowser: 'User Browser',
    reverseProxyPlaceholder: 'Web Entry / Reverse Proxy',
    environmentRequirements: 'Environment Requirements',
    hardwareRequirements: 'Hardware Requirements',
    resource: 'Resource',
    minimum: 'Minimum',
    testRecommended: 'Test Recommended',
    productionRecommended: 'Production Recommended',
    softwareRequirements: 'Software Dependencies',
    software: 'Software',
    supportedVersion: 'Supported Version',
    note: 'Note',
    architectureResource: 'Architecture',
    operatingSystemResource: 'OS',
    supportedArchitectures: 'x86_64 / ARM64',
    linuxRequirement: 'Linux, distribution/version to be confirmed by delivery package',
    confirmDeliveryMode: 'Use the runtime required by the delivered installation package.',
    externalOrBundledDatabase: 'Confirm whether the database is bundled or externally managed.',
    requiredWhenJvmBackend: 'Required when the backend package is JVM-based.',
    requiredWhenNodeTools: 'Required for Node-based install tools or frontend build-time tasks.',
    webConsoleAccess: 'Required for administrator and user console access.',
    enabled: 'Enabled',
    requiredForDistributedDeployment: 'Required for distributed deployments, audit, and token validation.',
    networkRequirements: 'Network And Ports',
    source: 'Source',
    destination: 'Destination',
    port: 'Port',
    protocol: 'Protocol',
    purpose: 'Purpose',
    userOrAdmin: 'User / Admin',
    adminHost: 'Admin workstation',
    serverHost: 'Server',
    webAccessPurpose: 'Web access',
    opsPurpose: 'Operations and installation',
    apiPurpose: 'API forwarding',
    databasePurpose: `${defaultInstallationDatabaseName} database and event-store access`,
    storagePurpose: 'File/object storage access',
    middlewarePurpose: 'Jobs, messages, scheduling, and retries',
    agentPurpose: 'Runtime control and status reporting',
    networkChecklist: () => [
      'Confirm DNS names and certificates before exposing the web entry.',
      'Confirm whether outbound internet access, HTTP proxy, or private registry access is required.',
      'Confirm firewall rules based on connection direction, especially for runtime agents.',
      'Enable NTP/time synchronization on every node.'
    ],
    installationMedia: 'Installation Media Check',
    mediaDescription: 'Confirm the delivery package, image tags, configuration templates, scripts, license files, and SHA256 checksums before installation.',
    mediaTree: (title: string) => [
      `${productSlug(title)}-${medolSoftwareVersion}/`,
      '|-- docker-compose.yml',
      '|-- .env.example',
      '|-- config/',
      '|-- scripts/',
      '|   |-- install.sh',
      '|   |-- start.sh',
      '|   |-- stop.sh',
      '|   |-- backup.sh',
      '|   `-- migrate.sh',
      '|-- images/',
      '|-- LICENSE',
      '`-- README.md'
    ],
    artifact: 'Artifact',
    version: 'Version',
    checksum: 'Checksum',
    backendPackageDescription: 'Backend service package or container image.',
    webPackageDescription: 'Web frontend package or container image.',
    agentPackageDescription: 'Runtime agent package or container image.',
    deploymentManifestDescription: 'Deployment descriptors for Docker Compose or Kubernetes.',
    configTemplateDescription: 'Configuration templates that must be copied and filled before startup.',
    scriptDescription: 'Installation, startup, backup, migration, and diagnostic scripts.',
    licenseDescription: 'License or entitlement file used by the installed product.',
    preInstallationPreparation: 'Pre-Installation Preparation',
    preparationChecklist: 'Preparation Checklist',
    preparationItem: 'Preparation Item',
    commandOrAction: 'Command / Action',
    expectedResult: 'Expected Result',
    osReady: 'Operating system ready',
    osReadyExpected: 'Hostname, OS version, architecture, and kernel are confirmed.',
    timeReady: 'Time synchronization ready',
    timeReadyExpected: 'NTP is enabled and system time is synchronized.',
    containerReady: 'Container runtime ready',
    containerReadyExpected: 'Docker/Podman and compose plugin return supported versions.',
    directoryReady: 'Installation directories ready',
    directoryReadyExpected: 'Install, config, log, data, and backup directories exist with correct permissions.',
    userReady: 'Installation user ready',
    userReadyExpected: 'The installation user exists and has required sudo or service permissions.',
    databaseReady: 'Database ready',
    databaseReadyExpected: `${defaultInstallationDatabaseName} connection succeeds with the migration or application account.`,
    networkReady: 'Network ready',
    networkReadyExpected: 'Required ports can be reached from the correct source nodes.',
    storageReady: 'Storage ready',
    storageReadyExpected: 'Storage bucket/path can be listed or written by the application credential.',
    certificateReady: 'Certificate ready',
    certificateReadyExpected: 'Certificate exists, is not expired, and matches the target domain.',
    systemInstallation: 'Installation Steps',
    step: 'Step',
    operationPurpose: 'Operation Purpose',
    command: 'Command',
    expectedOutput: 'Expected Output',
    exceptionHandling: 'Exception Handling',
    installStepBase: 'Install base environment',
    installStepBasePurpose: 'Verify OS, directories, user, runtime, and package integrity.',
    installStepBaseExpected: 'Environment check passes without blocking errors.',
    installStepBaseException: 'Fix missing runtime, permissions, directory, or checksum issues before continuing.',
    installStepDatabase: `Initialize ${defaultInstallationDatabaseName} schema and event store`,
    installStepDatabasePurpose: 'Create or migrate application tables, event-store tables, and read-side schema.',
    installStepDatabaseExpected: 'Migration completes and records the current schema and event-store version.',
    installStepDatabaseException: 'Check database connectivity, permissions, migration logs, and rollback plan.',
    installStepMiddleware: 'Deploy middleware',
    installStepMiddlewarePurpose: 'Start required message, cache, scheduler, or integration runtime services.',
    installStepMiddlewareExpected: 'Middleware containers or services are running and reachable.',
    installStepMiddlewareException: 'Inspect middleware logs, ports, credentials, and volume permissions.',
    installStepBackend: 'Deploy backend API',
    installStepBackendPurpose: 'Start the API service and connect it to database, storage, and dependencies.',
    installStepBackendExpected: 'Backend service is running and health endpoint is available.',
    installStepBackendException: 'Check application logs, configuration values, database connectivity, and dependency reachability.',
    installStepFrontend: 'Deploy frontend',
    installStepFrontendPurpose: 'Start web frontend or reverse proxy entry.',
    installStepFrontendExpected: 'Web entry responds over configured HTTP/HTTPS endpoint.',
    installStepFrontendException: 'Check reverse proxy config, TLS certificate, static assets, and API upstream.',
    installStepAgent: 'Deploy runtime agent',
    installStepAgentPurpose: 'Start the runtime-side agent and connect it to the platform.',
    installStepAgentExpected: 'Agent reports started or connected status.',
    installStepAgentException: 'Check agent token, platform URL, DNS, firewall, and runtime logs.',
    installStepStartAll: 'Start all services',
    installStepStartAllPurpose: 'Start the complete system in dependency order.',
    installStepStartAllExpected: 'All required containers or services are running.',
    installStepStartAllException: 'Run status and logs commands to locate the failing component.',
    systemConfiguration: 'Configuration',
    parameter: 'Parameter',
    required: 'Required',
    defaultValue: 'Default',
    example: 'Example',
    yes: 'Yes',
    no: 'No',
    dbHostDescription: 'Database host or service name.',
    dbPortDescription: 'Database listener port.',
    dbNameDescription: `Unified application database name; currently fixed to ${defaultInstallationDatabaseName}.`,
    dbUserDescription: 'Application database user.',
    secretValueDescription: 'Secret value; store in secret manager and never commit actual value.',
    serverPortDescription: 'Backend API listening port.',
    publicBaseUrlDescription: 'Public web entry URL.',
    logLevelDescription: 'Application log level.',
    storageEndpointDescription: 'Object/file storage endpoint.',
    storageBucketDescription: 'Object/file storage bucket or namespace.',
    platformApiUrlDescription: 'Platform API URL used by runtime agent.',
    systemInitialization: 'Initialization',
    initializationItem: 'Initialization Item',
    action: 'Action',
    initDatabase: `${defaultInstallationDatabaseName} initialization`,
    initDatabaseExpected: 'Schema, event-store tables, and migration metadata are initialized.',
    initAdmin: 'Administrator initialization',
    initAdminExpected: 'Initial administrator account is created and password policy is applied.',
    initSystemParams: 'Base parameter initialization',
    initSystemParamsExpected: 'Default system parameters are written and can be queried.',
    initBaseData: 'Base/reference data initialization',
    baseReferenceData: 'base reference data',
    initBaseDataExpected: 'Required dictionaries, reference data, or tenant bootstrap values are imported.',
    initLicense: 'License initialization',
    initLicenseExpected: 'License is accepted and product entitlement is valid.',
    serviceLifecycle: 'Startup And Shutdown',
    operation: 'Operation',
    start: 'Start',
    startDescription: 'Start services in dependency order.',
    stop: 'Stop',
    stopDescription: 'Stop application services before data services unless otherwise required.',
    restart: 'Restart',
    restartDescription: 'Restart service after configuration or package changes.',
    status: 'Status',
    statusDescription: 'Check process/container state and health.',
    lifecycleOrder: [
      `Recommended startup order: ${defaultInstallationDatabaseName} database / event store -> Middleware -> Backend API -> Web Frontend -> Runtime Agent.`,
      `Recommended shutdown order: Runtime Agent -> Web Frontend -> Backend API -> Middleware -> ${defaultInstallationDatabaseName} database / event store.`
    ],
    installationVerification: 'Installation Verification',
    verificationLevel: 'Verification Level',
    verificationMethod: 'Verification Method',
    successCriteria: 'Success Criteria',
    infrastructureVerification: 'Infrastructure verification',
    infrastructureVerificationExpected: 'All required services are running or healthy.',
    healthVerification: 'Application health verification',
    healthVerificationExpected: 'Health endpoint returns UP/healthy status.',
    eventStoreVerification: 'Event-store verification',
    eventStoreVerificationExpected: `${defaultInstallationDatabaseName} is reachable and can serve the application event store.`,
    pageVerification: 'Page access verification',
    pageVerificationExpected: 'Browser can open the login or console page over the configured URL.',
    loginVerification: 'Administrator login verification',
    loginVerificationMethod: 'Log in with initialized administrator account.',
    loginVerificationExpected: 'Login succeeds and administrator console is accessible.',
    businessSmokeVerification: 'Business smoke verification',
    businessSmokeVerificationPrefix: 'Execute representative smoke capabilities',
    businessSmokeVerificationExpected: 'Selected operation succeeds and related query/status view can be checked.',
    troubleshooting: 'Troubleshooting',
    logLocations: 'Log Locations',
    logLocation: 'Log Location',
    databaseLogLocation: `${defaultInstallationDatabaseName} database server logs`,
    checkCommand: 'Check Command',
    commonIssues: 'Common Issues',
    problem: 'Problem',
    possibleCause: 'Possible Cause',
    checkMethod: 'Check Method',
    problemPageUnavailable: 'Page cannot be opened',
    causeWebStopped: 'Web frontend, reverse proxy, DNS, TLS, or firewall issue',
    problemBackendFailed: 'Backend fails to start',
    causeDbConnection: `${defaultInstallationDatabaseName} database or event-store connection/configuration failure`,
    checkDatabaseConfig: `Check DB_HOST, DB_PORT, DB_NAME=${defaultInstallationDatabaseName}, DB_USER, DB_PASSWORD`,
    problemLoginFailed: 'Login fails',
    causeInitializationMissing: 'Administrator or authentication initialization is incomplete',
    problemDependencyUnavailable: 'External dependency unavailable',
    causeNetworkOrCredential: 'Network, DNS, credential, or allow-list issue',
    problemFileUploadFailed: 'File upload fails',
    causeStorageConfig: 'Storage endpoint, bucket, credential, size limit, or cleanup policy issue',
    upgradeRollback: 'Upgrade And Rollback',
    phase: 'Phase',
    phaseBackup: 'Backup',
    actionBackup: `Back up ${defaultInstallationDatabaseName}, uploaded files, configuration, and current package.`,
    noteBackup: 'Do not start upgrade without a verified backup.',
    phaseStop: 'Stop service',
    actionStop: 'Stop frontend, backend, workers, and agents in the documented order.',
    noteStop: 'Avoid consumers processing partial deployments.',
    phaseUpgrade: 'Upgrade package',
    actionUpgrade: 'Replace package/image/manifests with the target version.',
    noteUpgrade: 'Confirm version compatibility and release notes.',
    phaseMigration: 'Migration',
    actionMigration: `Run ${defaultInstallationDatabaseName} database and event-store migration or compatibility script.`,
    noteMigration: 'Confirm whether migration is automatic or manual.',
    phaseVerify: 'Verification',
    actionVerify: 'Start services and run installation verification.',
    noteVerify: 'Do not hand over before smoke checks pass.',
    phaseRollback: 'Rollback',
    actionRollback: `Restore previous package, configuration snapshot, and ${defaultInstallationDatabaseName} backup if required.`,
    noteRollback: 'Document data-loss risk and recovery point before rollback.',
    uninstall: 'System Uninstall',
    uninstallWarning: 'Distinguish program removal from business-data deletion. Never run destructive data deletion commands in production unless explicitly approved.',
    uninstallProgram: 'Remove program only',
    uninstallProgramDescription: 'Stops and removes running containers/services while preserving data volumes.',
    removeServiceFiles: 'Remove service files',
    removeServiceFilesDescription: 'Deletes installed binaries/scripts/config templates after backup.',
    removeData: 'Delete business data',
    removeDataDescription: 'Destructive operation; removes data volumes or persistent data.',
    removeAccounts: 'Remove OS accounts',
    removeAccountsDescription: 'Optional cleanup after confirming no other service uses the account.',
    appendices: 'Appendices',
    appendixPorts: 'Appendix A Port List',
    appendixConfig: 'Appendix B Configuration Parameters',
    appendixDirectories: 'Appendix C Directory List',
    directory: 'Directory',
    appendixCommands: 'Appendix D Common Commands',
    dirInstall: 'Installation directory',
    dirInstallNote: 'Stores package and runtime files.',
    dirConfig: 'Configuration directory',
    dirConfigNote: 'Stores environment and service configuration.',
    dirScripts: 'Script directory',
    dirScriptsNote: 'Stores install, start, stop, backup, and migration scripts.',
    dirLogs: 'Log directory',
    dirLogsNote: 'Stores application and operation logs.',
    dirData: 'Data directory',
    dirDataNote: 'Stores local data files if not using managed storage.',
    dirBackup: 'Backup directory',
    dirBackupNote: 'Stores installation and rollback backups.'
  },
  'zh-CN': {
    title: '安装部署手册',
    documentOverview: '系统说明',
    documentPurpose: (title: string) =>
      `本手册说明如何将 ${title} 从未安装状态部署到可正常运行并通过验证的状态。文档重点说明装什么、装在哪里、依赖什么、怎么配置、怎么启动、怎么验证以及失败时如何处理。`,
    item: '项目',
    content: '内容',
    systemName: '系统名称',
    softwareVersion: '软件版本',
    manualVersion: '手册版本',
    releaseDate: '发布日期',
    deploymentMode: '适用部署方式',
    deploymentModeValue: '单机、Docker Compose 或 Kubernetes 部署；正式发布前确认最终交付方式。',
    targetReaders: '目标读者',
    targetReadersValue: '系统管理员、实施工程师和运维人员。',
    prerequisites: '前置知识',
    prerequisitesValue: '具备基础 Linux、数据库、网络、证书和容器运行时操作知识。',
    toBeFilled: '待补充',
    deploymentArchitecture: '部署架构',
    systemComponents: '系统组件',
    component: '组件',
    installLocation: '安装位置',
    description: '说明',
    deploymentTopology: '部署拓扑',
    componentDependencies: '组件依赖',
    sourceComponent: '来源组件',
    targetComponent: '目标组件',
    relationship: '关系',
    webComponent: 'Web 前端 / 反向代理',
    edgeOrWebNode: 'Web 或边缘节点',
    webComponentDescription: '提供浏览器访问、静态资源、反向代理规则和入口路由。',
    backendComponent: '后端 API 服务',
    applicationNode: '应用节点',
    backendComponentDescription: '提供 API、命令处理、校验、业务编排和集成调用。',
    databaseComponent: `数据库 / 事件存储（${defaultInstallationDatabaseName}）`,
    databaseNode: `${defaultInstallationDatabaseName} 数据库节点或托管数据库`,
    databaseComponentDescription: `统一使用 ${defaultInstallationDatabaseName} 存储事件、业务状态、配置数据和 Read Model 查询数据。`,
    storageComponent: '对象/文件存储',
    storageNode: '存储服务或挂载卷',
    storageComponentDescription: '存储上传文件、临时暂存文件和生成制品。',
    middlewareComponent: '中间件 / 调度 / 消息通道',
    middlewareNode: '中间件节点或托管服务',
    middlewareComponentDescription: '支撑异步任务、定时任务、重试和集成通道。',
    agentComponent: 'Runtime Agent',
    runtimeNode: '运行时节点',
    agentComponentDescription: '连接运行节点与平台，报告运行状态或执行结果。',
    externalComponent: '外部系统',
    externalNetwork: '外部网络或托管服务',
    externalComponentDescription: '安装验证前必须确认可访问的外部依赖。',
    webToBackend: '转发 API 流量和认证/会话请求。',
    backendToDatabase: '写入事件存储，并读写持久化业务数据和查询数据。',
    backendToStorage: '读写上传文件或生成制品。',
    backendToMiddleware: '发布任务、消费消息并执行定时工作。',
    agentToPlatform: 'Runtime Agent 主动发起控制面或状态上报通信。',
    userBrowser: '用户浏览器',
    reverseProxyPlaceholder: 'Web 入口 / 反向代理',
    environmentRequirements: '环境要求',
    hardwareRequirements: '硬件要求',
    resource: '资源',
    minimum: '最低要求',
    testRecommended: '测试环境推荐',
    productionRecommended: '生产环境推荐',
    softwareRequirements: '软件依赖',
    software: '软件',
    supportedVersion: '支持版本',
    note: '说明',
    architectureResource: '架构',
    operatingSystemResource: '操作系统',
    supportedArchitectures: 'x86_64 / ARM64',
    linuxRequirement: 'Linux，发行版和版本以交付包要求为准',
    confirmDeliveryMode: '使用交付安装包要求的容器运行时。',
    externalOrBundledDatabase: '确认数据库是随包部署还是外置托管。',
    requiredWhenJvmBackend: '后端为 JVM 包时需要。',
    requiredWhenNodeTools: 'Node 安装工具或前端构建任务需要。',
    webConsoleAccess: '管理员和用户访问控制台需要。',
    enabled: '已启用',
    requiredForDistributedDeployment: '分布式部署、审计和令牌校验需要。',
    networkRequirements: '网络与端口',
    source: '来源',
    destination: '目标',
    port: '端口',
    protocol: '协议',
    purpose: '用途',
    userOrAdmin: '用户 / 管理员',
    adminHost: '管理员工作站',
    serverHost: '服务器',
    webAccessPurpose: 'Web 访问',
    opsPurpose: '运维和安装',
    apiPurpose: 'API 转发',
    databasePurpose: `${defaultInstallationDatabaseName} 数据库与事件存储访问`,
    storagePurpose: '文件/对象存储访问',
    middlewarePurpose: '任务、消息、调度和重试',
    agentPurpose: '运行时控制与状态上报',
    networkChecklist: () => [
      '对外开放 Web 入口前，确认 DNS 名称和 TLS 证书。',
      '确认是否需要公网出站、HTTP 代理或私有镜像仓库访问。',
      '按连接方向确认防火墙规则，尤其是 Runtime Agent 的主动连接方向。',
      '所有节点启用 NTP/时间同步。'
    ],
    installationMedia: '安装介质确认',
    mediaDescription: '安装前确认交付包、镜像标签、配置模板、脚本、许可证文件和 SHA256 校验值。',
    mediaTree: (title: string) => [
      `${productSlug(title)}-${medolSoftwareVersion}/`,
      '|-- docker-compose.yml',
      '|-- .env.example',
      '|-- config/',
      '|-- scripts/',
      '|   |-- install.sh',
      '|   |-- start.sh',
      '|   |-- stop.sh',
      '|   |-- backup.sh',
      '|   `-- migrate.sh',
      '|-- images/',
      '|-- LICENSE',
      '`-- README.md'
    ],
    artifact: '介质',
    version: '版本',
    checksum: '校验值',
    backendPackageDescription: '后端服务安装包或容器镜像。',
    webPackageDescription: 'Web 前端安装包或容器镜像。',
    agentPackageDescription: 'Runtime Agent 安装包或容器镜像。',
    deploymentManifestDescription: 'Docker Compose 或 Kubernetes 部署描述文件。',
    configTemplateDescription: '启动前需要复制并填写的配置模板。',
    scriptDescription: '安装、启停、备份、迁移和诊断脚本。',
    licenseDescription: '已安装产品使用的许可证或授权文件。',
    preInstallationPreparation: '安装前准备',
    preparationChecklist: '准备项检查',
    preparationItem: '准备项',
    commandOrAction: '命令 / 操作',
    expectedResult: '期望结果',
    osReady: '操作系统就绪',
    osReadyExpected: '主机名、OS 版本、架构和内核已确认。',
    timeReady: '时间同步就绪',
    timeReadyExpected: 'NTP 已启用，系统时间已同步。',
    containerReady: '容器运行时就绪',
    containerReadyExpected: 'Docker/Podman 和 compose 插件返回受支持版本。',
    directoryReady: '安装目录就绪',
    directoryReadyExpected: '安装、配置、日志、数据和备份目录存在且权限正确。',
    userReady: '安装用户就绪',
    userReadyExpected: '安装用户存在，并具备必要 sudo 或服务操作权限。',
    databaseReady: '数据库就绪',
    databaseReadyExpected: `迁移账号或应用账号可成功连接 ${defaultInstallationDatabaseName}。`,
    networkReady: '网络就绪',
    networkReadyExpected: '可从正确来源节点访问必要端口。',
    storageReady: '存储就绪',
    storageReadyExpected: '应用凭据可列出或写入存储桶/目录。',
    certificateReady: '证书就绪',
    certificateReadyExpected: '证书存在、未过期，并与目标域名匹配。',
    systemInstallation: '安装步骤',
    step: '步骤',
    operationPurpose: '操作目的',
    command: '命令',
    expectedOutput: '预期输出',
    exceptionHandling: '异常处理',
    installStepBase: '安装基础环境',
    installStepBasePurpose: '验证 OS、目录、用户、运行时和安装包完整性。',
    installStepBaseExpected: '环境检查通过，无阻断错误。',
    installStepBaseException: '先修复运行时、权限、目录或校验值问题，再继续安装。',
    installStepDatabase: `初始化 ${defaultInstallationDatabaseName} 与事件存储结构`,
    installStepDatabasePurpose: '创建或迁移应用表、事件存储表和读侧 schema。',
    installStepDatabaseExpected: '迁移完成，并记录当前 schema 与事件存储版本。',
    installStepDatabaseException: '检查数据库连通性、权限、迁移日志和回滚计划。',
    installStepMiddleware: '部署中间件',
    installStepMiddlewarePurpose: '启动消息、缓存、调度或集成运行时服务。',
    installStepMiddlewareExpected: '中间件容器或服务运行并可访问。',
    installStepMiddlewareException: '检查中间件日志、端口、凭据和卷权限。',
    installStepBackend: '部署后端 API',
    installStepBackendPurpose: '启动 API 服务，并连接数据库、存储和依赖项。',
    installStepBackendExpected: '后端服务运行，健康检查可访问。',
    installStepBackendException: '检查应用日志、配置值、数据库连接和依赖可达性。',
    installStepFrontend: '部署前端',
    installStepFrontendPurpose: '启动 Web 前端或反向代理入口。',
    installStepFrontendExpected: 'Web 入口可通过配置的 HTTP/HTTPS 地址访问。',
    installStepFrontendException: '检查反向代理配置、TLS 证书、静态资源和 API 上游。',
    installStepAgent: '部署 Runtime Agent',
    installStepAgentPurpose: '启动运行侧 Agent 并连接平台。',
    installStepAgentExpected: 'Agent 上报已启动或已连接状态。',
    installStepAgentException: '检查 Agent Token、平台地址、DNS、防火墙和运行日志。',
    installStepStartAll: '启动全部服务',
    installStepStartAllPurpose: '按依赖顺序启动完整系统。',
    installStepStartAllExpected: '所有必要容器或服务处于运行状态。',
    installStepStartAllException: '执行状态和日志命令定位失败组件。',
    systemConfiguration: '配置说明',
    parameter: '参数',
    required: '必填',
    defaultValue: '默认值',
    example: '示例',
    yes: '是',
    no: '否',
    dbHostDescription: '数据库主机或服务名。',
    dbPortDescription: '数据库监听端口。',
    dbNameDescription: `统一应用数据库名称，当前固定为 ${defaultInstallationDatabaseName}。`,
    dbUserDescription: '应用数据库用户。',
    secretValueDescription: '密钥值；存入密钥管理工具，不得提交真实值。',
    serverPortDescription: '后端 API 监听端口。',
    publicBaseUrlDescription: '对外 Web 入口 URL。',
    logLevelDescription: '应用日志级别。',
    storageEndpointDescription: '对象/文件存储端点。',
    storageBucketDescription: '对象/文件存储桶或命名空间。',
    platformApiUrlDescription: 'Runtime Agent 使用的平台 API 地址。',
    systemInitialization: '初始化',
    initializationItem: '初始化项',
    action: '操作',
    initDatabase: `${defaultInstallationDatabaseName} 初始化`,
    initDatabaseExpected: 'schema、事件存储表和迁移元数据已初始化。',
    initAdmin: '管理员初始化',
    initAdminExpected: '初始管理员账号创建完成，并应用密码策略。',
    initSystemParams: '基础参数初始化',
    initSystemParamsExpected: '默认系统参数已写入并可查询。',
    initBaseData: '基础/参考数据初始化',
    baseReferenceData: '基础参考数据',
    initBaseDataExpected: '必要字典、参考数据或租户初始化值已导入。',
    initLicense: '许可证初始化',
    initLicenseExpected: '许可证被接受，产品授权有效。',
    serviceLifecycle: '启动与停止',
    operation: '操作',
    start: '启动',
    startDescription: '按依赖顺序启动服务。',
    stop: '停止',
    stopDescription: '除特殊要求外，先停止应用服务，再停止数据服务。',
    restart: '重启',
    restartDescription: '配置或版本变更后重启服务。',
    status: '状态检查',
    statusDescription: '检查进程/容器状态和健康状态。',
    lifecycleOrder: [
      `推荐启动顺序：${defaultInstallationDatabaseName} 数据库 / 事件存储 -> 中间件 -> 后端 API -> Web 前端 -> Runtime Agent。`,
      `推荐停止顺序：Runtime Agent -> Web 前端 -> 后端 API -> 中间件 -> ${defaultInstallationDatabaseName} 数据库 / 事件存储。`
    ],
    installationVerification: '安装验证',
    verificationLevel: '验证层级',
    verificationMethod: '验证方式',
    successCriteria: '通过标准',
    infrastructureVerification: '基础设施验证',
    infrastructureVerificationExpected: '所有必要服务处于运行或 healthy 状态。',
    healthVerification: '应用健康检查',
    healthVerificationExpected: '健康检查接口返回 UP/healthy 状态。',
    eventStoreVerification: '事件存储验证',
    eventStoreVerificationExpected: `${defaultInstallationDatabaseName} 可连接，并可作为应用事件存储使用。`,
    pageVerification: '页面访问验证',
    pageVerificationExpected: '浏览器可通过配置 URL 打开登录页或控制台。',
    loginVerification: '管理员登录验证',
    loginVerificationMethod: '使用初始化管理员账号登录。',
    loginVerificationExpected: '登录成功，并可访问管理员控制台。',
    businessSmokeVerification: '业务冒烟验证',
    businessSmokeVerificationPrefix: '执行代表性冒烟能力',
    businessSmokeVerificationExpected: '选定操作成功，且可检查相关查询或状态视图。',
    troubleshooting: '故障排查',
    logLocations: '日志位置',
    logLocation: '日志位置',
    databaseLogLocation: `${defaultInstallationDatabaseName} 数据库服务日志`,
    checkCommand: '检查命令',
    commonIssues: '常见问题',
    problem: '问题',
    possibleCause: '可能原因',
    checkMethod: '检查方法',
    problemPageUnavailable: '页面打不开',
    causeWebStopped: 'Web 前端、反向代理、DNS、TLS 或防火墙问题',
    problemBackendFailed: '后端启动失败',
    causeDbConnection: `${defaultInstallationDatabaseName} 数据库或事件存储连接/配置失败`,
    checkDatabaseConfig: `检查 DB_HOST、DB_PORT、DB_NAME=${defaultInstallationDatabaseName}、DB_USER、DB_PASSWORD`,
    problemLoginFailed: '登录失败',
    causeInitializationMissing: '管理员或认证初始化未完成',
    problemDependencyUnavailable: '外部依赖不可用',
    causeNetworkOrCredential: '网络、DNS、凭据或白名单问题',
    problemFileUploadFailed: '文件上传失败',
    causeStorageConfig: '存储端点、桶、凭据、大小限制或清理策略问题',
    upgradeRollback: '升级与回滚',
    phase: '阶段',
    phaseBackup: '备份',
    actionBackup: `备份 ${defaultInstallationDatabaseName}、上传文件、配置和当前版本包。`,
    noteBackup: '未验证备份前不得开始升级。',
    phaseStop: '停止服务',
    actionStop: '按文档顺序停止前端、后端、Worker 和 Agent。',
    noteStop: '避免消费者处理半成品部署。',
    phaseUpgrade: '升级程序',
    actionUpgrade: '将程序包、镜像或部署描述文件替换为目标版本。',
    noteUpgrade: '确认版本兼容性和发行说明。',
    phaseMigration: '迁移',
    actionMigration: `执行 ${defaultInstallationDatabaseName} 数据库和事件存储迁移或兼容性脚本。`,
    noteMigration: '确认迁移是自动执行还是手工执行。',
    phaseVerify: '验证',
    actionVerify: '启动服务并执行安装验证。',
    noteVerify: '冒烟检查通过前不得交付。',
    phaseRollback: '回滚',
    actionRollback: `必要时恢复上一版本程序包、配置快照和 ${defaultInstallationDatabaseName} 备份。`,
    noteRollback: '回滚前记录数据丢失风险和恢复点。',
    uninstall: '系统卸载',
    uninstallWarning: '区分卸载程序和删除业务数据。生产环境不得执行破坏性数据删除命令，除非获得明确批准。',
    uninstallProgram: '仅卸载程序',
    uninstallProgramDescription: '停止并移除运行中的容器/服务，保留数据卷。',
    removeServiceFiles: '删除服务文件',
    removeServiceFilesDescription: '备份后删除已安装二进制、脚本和配置模板。',
    removeData: '删除业务数据',
    removeDataDescription: '破坏性操作；删除数据卷或持久化数据。',
    removeAccounts: '删除 OS 账号',
    removeAccountsDescription: '确认无其他服务使用该账号后可选清理。',
    appendices: '附录',
    appendixPorts: '附录A 端口清单',
    appendixConfig: '附录B 配置参数清单',
    appendixDirectories: '附录C 目录清单',
    directory: '目录',
    appendixCommands: '附录D 常用命令',
    dirInstall: '安装目录',
    dirInstallNote: '存放程序包和运行文件。',
    dirConfig: '配置目录',
    dirConfigNote: '存放环境和服务配置。',
    dirScripts: '脚本目录',
    dirScriptsNote: '存放安装、启停、备份和迁移脚本。',
    dirLogs: '日志目录',
    dirLogsNote: '存放应用和操作日志。',
    dirData: '数据目录',
    dirDataNote: '未使用托管存储时存放本地数据文件。',
    dirBackup: '备份目录',
    dirBackupNote: '存放安装和回滚备份。'
  }
};

const installationManualText = {
  en: {
    title: 'Installation And Deployment Guide',
    overview: 'Overview',
    overviewBody: (bundle: DocumentationBundle) =>
      `This manual describes installation preparation, deployment order, configuration checks, and smoke verification for ${bundle.title}. Complete it with environment-specific infrastructure values before release.`,
    scope: 'Installation Scope',
    deployableUnit: 'Deployable Unit',
    includedContexts: 'Included Contexts',
    primaryCapabilities: 'Primary Capabilities',
    dataViews: 'Data Views',
    defaultDeployment: 'Application runtime',
    environment: 'Environment Preparation',
    environmentIntro: 'Complete the following items before installation. Replace the placeholders with the values for the target environment.',
    preparationItem: 'Preparation Item',
    preparationContent: 'Preparation Content',
    confirmation: 'Confirmation',
    runtimeEnvironment: 'Runtime and deployment account',
    runtimeEnvironmentContent: 'Prepare the application runtime, deployment user, installation directory, startup command, health-check endpoint, and service port plan.',
    runtimeEnvironmentConfirmation: 'The deployment user can install, start, stop, and inspect the service on the target host or container platform.',
    databaseEnvironment: 'Database and migration account',
    databaseEnvironmentContent: 'Create database/schema, application account, migration account, read/write permissions, connection string, and migration execution path.',
    databaseEnvironmentConfirmation: 'A dry-run or staging migration can connect successfully and leaves an auditable migration record.',
    configSecretEnvironment: 'Configuration and secrets',
    configSecretEnvironmentContent: 'Prepare environment variables or configuration-center keys for database, service endpoints, tokens, signing keys, storage, feature flags, and timeout/retry values.',
    configSecretEnvironmentConfirmation: 'Secrets are stored in the approved secret manager and are not committed to source code or deployment packages.',
    networkTlsEnvironment: 'Network, DNS, and TLS',
    networkTlsEnvironmentContent: (dependencies: string) =>
      `Confirm inbound ports, outbound allow-lists, DNS names, TLS certificates, and access rules. Key dependencies: ${dependencies}.`,
    networkTlsEnvironmentConfirmation: 'Health checks and dependency connectivity can pass from the target runtime network segment.',
    noNamedDependencies: 'no named external dependencies',
    fileStorageEnvironment: 'File and object storage',
    fileStorageEnvironmentContent: 'Prepare upload bucket/path, temporary staging area, retention policy, size limits, content-type allow-list, and cleanup job permissions.',
    fileStorageEnvironmentConfirmation: 'A test file can be uploaded, read, marked consumed or expired, and cleaned up according to policy.',
    asyncEnvironment: 'Asynchronous jobs and integration channels',
    asyncEnvironmentContent: 'Prepare message topics, queues, consumer groups, scheduler switches, retry policy, dead-letter handling, and integration credentials.',
    asyncEnvironmentConfirmation: 'Consumers can be started after service readiness, and retry/dead-letter monitoring is visible.',
    observabilityEnvironment: 'Logs, metrics, tracing, and alerts',
    observabilityEnvironmentContent: 'Configure log collection, metric namespace, trace sampling, dashboard links, alert recipients, and on-call escalation path.',
    observabilityEnvironmentConfirmation: 'A startup event, error log, metric sample, and alert test can be observed by operations.',
    initialAccessEnvironment: 'Initial access and base data',
    initialAccessEnvironmentContent: 'Prepare administrator account, operation roles, initial dictionary/reference data, and any required tenant or organization bootstrap values.',
    initialAccessEnvironmentConfirmation: 'The administrator can sign in and perform the first smoke operation with expected permissions.',
    backupRollbackEnvironment: 'Backup and rollback artifacts',
    backupRollbackEnvironmentContent: 'Prepare database backup, configuration snapshot, previous package, rollback command, and operator permission.',
    backupRollbackEnvironmentConfirmation: 'Rollback artifacts are available before installation starts and can be restored in a controlled drill.',
    configuration: 'Configuration And External Dependencies',
    dependency: 'Dependency',
    ownerContext: 'Owner Context',
    configurationItem: 'Configuration Item',
    verification: 'Verification',
    endpointConfiguration: 'Endpoint, credential, timeout, retry, and allow-list configuration',
    integrationVerification: 'Run connectivity, authentication, and contract checks',
    externalSystemVerification: 'Run sandbox or production-readiness connectivity checks',
    noExternalDependencies: 'No explicit integrations or external systems are modeled. Record infrastructure dependencies before release.',
    installationSteps: 'Installation Steps',
    installationChecklist: [
      'Stop scheduled jobs or event consumers that could process partial deployments.',
      'Back up persistent stores and export the active configuration snapshot.',
      'Install or update application packages for each deployable unit.',
      'Apply database migrations and verify schema compatibility.',
      'Configure service endpoints, credentials, message topics, file storage, and feature flags.',
      'Start services in dependency order, then enable asynchronous consumers and scheduled jobs.',
      'Run smoke verification and record the installation result in the change log.'
    ],
    moduleInitialization: 'Module Deployment And Initialization',
    contextPurpose: 'Context purpose',
    capability: 'Capability',
    installationCheck: 'Installation Check',
    expectedResult: 'Expected Result',
    noCapabilities: 'No capabilities are explicitly modeled in this context.',
    acceptanceVerification: 'Installation Verification',
    acceptanceVerificationIntro: 'Run the following basic checks after deployment. Use representative smoke scenarios instead of executing every modeled business capability during installation acceptance.',
    verificationItem: 'Verification Item',
    verificationMethod: 'Verification Method',
    successCriteria: 'Success Criteria',
    serviceStartup: 'Service startup',
    serviceStartupMethod: (bundle: DocumentationBundle) =>
      `Confirm all deployed runtime units are running and expose health checks for ${bundle.contexts.length} modeled contexts.`,
    serviceStartupSuccess: 'All services report healthy status and no startup errors remain in logs.',
    configurationVerification: 'Configuration and dependency connectivity',
    configurationVerificationMethod: (dependencies: string) =>
      `Check required configuration values and connectivity for: ${dependencies}.`,
    configurationVerificationSuccess: 'Credentials, endpoints, message channels, storage, and external calls are reachable in the target environment.',
    dataVerification: 'Database and read-model readiness',
    dataVerificationMethod: (readmodels: string) =>
      `Run migration checks and verify representative read models: ${readmodels}.`,
    dataVerificationSuccess: 'Schema version is current, migrations are complete, and representative read models can be queried.',
    businessSmokeVerification: 'Representative business smoke test',
    businessSmokeVerificationMethod: (capabilities: string) =>
      `Execute a small set of representative capabilities: ${capabilities}.`,
    businessSmokeVerificationSuccess: 'The selected operations complete successfully and produce the expected event, state, or visible read-side result.',
    observabilityVerification: 'Logs, metrics, and alerts',
    observabilityVerificationMethod: 'Check application logs, metric collection, tracing, retry queues, scheduled jobs, and alert routing.',
    observabilityVerificationSuccess: 'Operational signals are visible and failed jobs or retry queues have no unexplained backlog.',
    rollbackVerification: 'Rollback readiness',
    rollbackVerificationMethod: 'Confirm previous package, configuration snapshot, data backup, and rollback operator access are available.',
    rollbackVerificationSuccess: 'Rollback can be executed without missing artifacts or permissions.',
    trigger: 'Trigger',
    input: 'Input',
    readSide: 'Read side',
    ruleVerification: 'Rule verification',
    reviewRequired: 'review required',
    system: 'System',
    runInitialCommand: 'Run initial creation command',
    verifyAutomation: 'Verify automation trigger',
    runSmokeTest: 'Run smoke test',
    rollbackAndOperations: 'Rollback And Operations Checks',
    operationsChecklist: (bundle: DocumentationBundle) => [
      `Record representative smoke coverage for ${Math.min(5, bundle.workflows.length)} selected capabilities and list any skipped high-risk scenarios for follow-up.`,
      'Check error logs, retry queues, dead-letter queues, and failed scheduled jobs.',
      'Verify read-model freshness after command execution and event replay.',
      'If rollback is required, stop consumers, restore the previous package and configuration, then validate schema compatibility.',
      'Record unresolved risks, manual fixes, and follow-up owners before handing over to operations.'
    ],
    notModeled: 'Not explicitly modeled'
  },
  'zh-CN': {
    title: '安装部署手册',
    overview: '概述',
    overviewBody: (bundle: DocumentationBundle) =>
      `本文档说明 ${bundle.title} 的安装准备、部署顺序、配置检查和安装验证。正式发布前需补充具体环境中的主机、账号、网络和存储参数。`,
    scope: '安装范围',
    deployableUnit: '部署单元',
    includedContexts: '包含上下文',
    primaryCapabilities: '主要能力',
    dataViews: '数据视图',
    defaultDeployment: '应用运行时',
    environment: '环境准备',
    environmentIntro: '安装前完成下列准备项，并将占位内容替换为目标环境的真实参数。',
    preparationItem: '准备项',
    preparationContent: '准备内容',
    confirmation: '确认方式',
    runtimeEnvironment: '运行环境与部署账号',
    runtimeEnvironmentContent: '准备应用运行时、部署账号、安装目录、启动命令、健康检查地址和服务端口规划。',
    runtimeEnvironmentConfirmation: '部署账号可在目标主机或容器平台完成安装、启动、停止和状态查看。',
    databaseEnvironment: '数据库与迁移账号',
    databaseEnvironmentContent: '创建数据库/schema、应用账号、迁移账号、读写权限、连接串和迁移执行路径。',
    databaseEnvironmentConfirmation: '可在预发或演练环境完成迁移连接验证，并留下可追踪的迁移记录。',
    configSecretEnvironment: '配置项与密钥',
    configSecretEnvironmentContent: '准备环境变量或配置中心键值，包括数据库、服务端点、令牌、签名密钥、存储、功能开关、超时和重试参数。',
    configSecretEnvironmentConfirmation: '密钥已进入合规密钥管理工具，未写入源码或部署包。',
    networkTlsEnvironment: '网络、DNS 与证书',
    networkTlsEnvironmentContent: (dependencies: string) =>
      `确认入站端口、出站白名单、DNS 名称、TLS 证书和访问策略。关键依赖：${dependencies}。`,
    networkTlsEnvironmentConfirmation: '目标运行网络内可通过健康检查和依赖连通性验证。',
    noNamedDependencies: '未明确命名外部依赖',
    fileStorageEnvironment: '文件与对象存储',
    fileStorageEnvironmentContent: '准备上传桶/目录、临时暂存区、保留策略、文件大小限制、文件类型白名单和清理任务权限。',
    fileStorageEnvironmentConfirmation: '测试文件可上传、读取、标记已消费或过期，并能按策略清理。',
    asyncEnvironment: '异步任务与集成通道',
    asyncEnvironmentContent: '准备消息主题、队列、消费者组、调度开关、重试策略、死信处理和集成凭据。',
    asyncEnvironmentConfirmation: '消费者可在服务就绪后启动，重试和死信监控可见。',
    observabilityEnvironment: '日志、指标、链路与告警',
    observabilityEnvironmentContent: '配置日志采集、指标命名空间、链路采样、仪表板地址、告警接收人和升级路径。',
    observabilityEnvironmentConfirmation: '运维人员可看到启动事件、错误日志、指标样本和告警测试结果。',
    initialAccessEnvironment: '初始账号与基础数据',
    initialAccessEnvironmentContent: '准备管理员账号、操作角色、初始字典/参考数据，以及必要的租户或机构初始化值。',
    initialAccessEnvironmentConfirmation: '管理员可登录，并具备执行首个冒烟操作的权限。',
    backupRollbackEnvironment: '备份与回退制品',
    backupRollbackEnvironmentContent: '准备数据库备份、配置快照、上一版本应用包、回退命令和操作人权限。',
    backupRollbackEnvironmentConfirmation: '安装开始前已具备可恢复的回退制品，并完成受控演练确认。',
    configuration: '配置项与外部依赖',
    dependency: '依赖项',
    ownerContext: '归属上下文',
    configurationItem: '配置内容',
    verification: '验证方式',
    endpointConfiguration: '端点、凭据、超时、重试和访问白名单配置',
    integrationVerification: '执行连通性、认证和契约检查',
    externalSystemVerification: '执行沙箱或生产就绪连通性检查',
    noExternalDependencies: '当前未明确建模集成或外部系统。发布前需补充基础设施依赖。',
    installationSteps: '安装步骤',
    installationChecklist: [
      '暂停可能处理半成品版本的定时任务或事件消费者。',
      '备份持久化数据，并导出当前生效配置快照。',
      '按部署单元安装或更新应用包。',
      '执行数据库迁移，并验证新旧 schema 兼容性。',
      '配置服务端点、凭据、消息主题、文件存储和功能开关。',
      '按依赖顺序启动服务，再启用异步消费者和定时任务。',
      '执行安装验证，并将安装结果记录到变更记录。'
    ],
    moduleInitialization: '模块部署与初始化',
    contextPurpose: '上下文用途',
    capability: '能力',
    installationCheck: '安装检查',
    expectedResult: '预期结果',
    noCapabilities: '该上下文尚未明确建模业务能力。',
    acceptanceVerification: '安装验证',
    acceptanceVerificationIntro: '部署完成后执行以下基础检查即可。安装验收阶段使用代表性冒烟场景，不需要逐条执行所有已建模业务能力。',
    verificationItem: '验证项',
    verificationMethod: '验证方式',
    successCriteria: '通过标准',
    serviceStartup: '服务启动',
    serviceStartupMethod: (bundle: DocumentationBundle) =>
      `确认所有部署单元已启动，并能为 ${bundle.contexts.length} 个已建模上下文提供健康检查。`,
    serviceStartupSuccess: '所有服务健康检查通过，启动日志中无未处理错误。',
    configurationVerification: '配置与依赖连通性',
    configurationVerificationMethod: (dependencies: string) =>
      `检查必要配置项，并验证以下依赖连通性：${dependencies}。`,
    configurationVerificationSuccess: '目标环境中的凭据、端点、消息通道、存储和外部调用均可访问。',
    dataVerification: '数据库与 Read Model 就绪',
    dataVerificationMethod: (readmodels: string) =>
      `执行迁移检查，并验证代表性 Read Model：${readmodels}。`,
    dataVerificationSuccess: 'schema 版本正确，迁移已完成，代表性 Read Model 可正常查询。',
    businessSmokeVerification: '代表性业务冒烟',
    businessSmokeVerificationMethod: (capabilities: string) =>
      `选择少量代表性能力执行验证：${capabilities}。`,
    businessSmokeVerificationSuccess: '选定操作可成功完成，并产生预期事件、状态或可见读侧结果。',
    observabilityVerification: '日志、指标与告警',
    observabilityVerificationMethod: '检查应用日志、指标采集、链路追踪、重试队列、定时任务和告警路由。',
    observabilityVerificationSuccess: '运维信号可见，失败任务或重试队列无无法解释的积压。',
    rollbackVerification: '回退就绪',
    rollbackVerificationMethod: '确认上一版本应用包、配置快照、数据备份和回退操作权限均可用。',
    rollbackVerificationSuccess: '不存在缺失制品或权限导致无法回退的情况。',
    trigger: '触发方式',
    input: '输入',
    readSide: '读侧结果',
    ruleVerification: '规则验证',
    reviewRequired: '需评审确认',
    system: '系统',
    runInitialCommand: '执行初始化创建命令',
    verifyAutomation: '验证自动化触发',
    runSmokeTest: '执行冒烟验证',
    rollbackAndOperations: '回退与运维检查',
    operationsChecklist: (bundle: DocumentationBundle) => [
      `记录 ${Math.min(5, bundle.workflows.length)} 个代表性能力的冒烟覆盖情况，并列出未执行的高风险场景作为后续跟进。`,
      '检查错误日志、重试队列、死信队列和失败定时任务。',
      '验证命令执行和事件回放后的 Read Model 新鲜度。',
      '如需回退，先停止消费者，恢复上一版本应用包和配置，再验证 schema 兼容性。',
      '交接运维前记录未解决风险、人工修复项和后续负责人。'
    ],
    notModeled: '尚未明确'
  }
};

const userJourneyText = {
  en: {
    title: 'User Journey Summary',
    overview: 'Journey Overview',
    overviewBody: (bundle: DocumentationBundle) =>
      `${bundle.title} user journeys summarize who uses each capability, where the interaction happens, what business result is expected, and what evidence confirms completion.`,
    actorJourneySummary: 'Actor Journey Summary',
    actor: 'Actor',
    goals: 'Goals / Capabilities',
    mainTouchpoints: 'Main Touchpoints',
    keyResults: 'Key Results',
    endToEndJourneyMap: 'End-To-End Journey Map',
    contextJourneys: 'Context Journeys',
    step: 'Step',
    actorOrTrigger: 'Actor / Trigger',
    userGoal: 'User Goal',
    touchpoint: 'Touchpoint',
    businessResult: 'Business Result',
    evidence: 'Evidence',
    momentsAndRules: 'Critical Moments And Rules',
    dataAndFeedback: 'Data Views And Feedback',
    readModel: 'Read Model',
    whereAppears: 'Where It Appears',
    updatedBy: 'Updated By',
    userValue: 'User Value',
    aiPrompt: 'AI-Assisted Business Clarification Prompt',
    aiPromptIntro: 'Use this fixed prompt only when model-assisted clarification is needed before business review.',
    promptLines: [
      'You are a senior business analyst. Based on the provided MEDOL model and generated user journey summary, refine the user journeys for business review.',
      'Keep the document faithful to the model. Do not invent roles, capabilities, states, pages, integrations, or rules that are not present in the model.',
      'For each actor, summarize goals, entry touchpoints, step sequence, expected business result, feedback/read model, and critical rule or exception.',
      'Highlight ambiguities as business questions instead of silently completing them.',
      'Return Markdown only, preserving heading structure and tables where possible.'
    ],
    noActors: 'No explicit actor-driven journeys are modeled.',
    noCapabilities: 'No capabilities are modeled in this context.',
    noRules: 'No critical rules, exceptions, or hotspots are explicitly modeled.',
    noReadmodels: 'No user-visible read models are modeled.',
    notModeled: 'Not modeled',
    systemActor: 'System',
    systemTouchpoint: 'System / background process',
    command: 'Command',
    event: 'Event'
  },
  'zh-CN': {
    title: '用户旅程总结',
    overview: '旅程概览',
    overviewBody: (bundle: DocumentationBundle) =>
      `${bundle.title}用户旅程总结用于梳理不同角色如何进入系统、完成业务目标、获得业务结果，并通过页面、数据视图或事件反馈确认处理完成。`,
    actorJourneySummary: '角色旅程摘要',
    actor: '角色',
    goals: '目标/能力',
    mainTouchpoints: '主要触点',
    keyResults: '关键结果',
    endToEndJourneyMap: '端到端旅程图',
    contextJourneys: '业务域旅程',
    step: '步骤',
    actorOrTrigger: '角色/触发方',
    userGoal: '用户目标',
    touchpoint: '触点',
    businessResult: '业务结果',
    evidence: '完成证据',
    momentsAndRules: '关键时刻与业务规则',
    dataAndFeedback: '数据视图与反馈',
    readModel: '数据视图',
    whereAppears: '出现位置',
    updatedBy: '更新来源',
    userValue: '用户价值',
    aiPrompt: 'AI 辅助业务梳理提示词',
    aiPromptIntro: '需要借助模型进一步梳理业务时，使用以下固定提示词。',
    promptLines: [
      '你是一名资深业务分析师。请基于提供的 MEDOL 模型和已生成的用户旅程总结，面向业务评审优化用户旅程。',
      '必须忠实于模型内容，不得编造模型中不存在的角色、能力、状态、页面、集成或业务规则。',
      '请按角色梳理目标、入口触点、步骤顺序、预期业务结果、反馈/数据视图、关键规则或异常。',
      '对于模型表达不清的地方，以业务待确认问题呈现，不要自行补全。',
      '仅返回 Markdown，并尽量保留原有标题结构和表格。'
    ],
    noActors: '当前未建模明确的角色旅程。',
    noCapabilities: '该业务域下尚未建模可梳理的能力。',
    noRules: '当前未建模明确的关键规则、异常或热点问题。',
    noReadmodels: '当前未建模用户可见的数据视图。',
    notModeled: '未建模',
    systemActor: '系统',
    systemTouchpoint: '系统/后台流程',
    command: '命令',
    event: '事件'
  }
};

const userManualText = {
  en: {
    title: 'User Manual',
    overview: 'Overview',
    overviewBody: (bundle: DocumentationBundle) =>
      `This manual explains how users operate ${bundle.title}, including roles, feature entry points, expected inputs, results, data views, and exception handling.`,
    rolesAndAccess: 'Roles And Access',
    role: 'Role',
    availableCapabilities: 'Available Capabilities',
    primaryEntry: 'Primary Entry',
    noActors: 'No explicit user roles are modeled. Confirm final permission roles before release.',
    quickStart: 'Quick Start',
    quickStartChecklist: (bundle: DocumentationBundle) => [
      `Sign in with a role authorized for the target business context.`,
      `Open the relevant feature entry from one of ${bundle.workflows.filter((workflow) => workflow.ui).length} modeled UI entry points, or follow the system-operation procedure for background workflows.`,
      'Prepare required identifiers and input data before submitting an operation.',
      'After submission, confirm the business result and check the related read model or status view.',
      'If validation fails, correct the input according to the rule or exception message and retry when appropriate.'
    ],
    featureGuide: 'Feature Guide',
    contextSummary: 'Context summary',
    noCapabilities: 'No capabilities are explicitly modeled in this context.',
    item: 'Item',
    description: 'Description',
    entry: 'Entry',
    actorOrTrigger: 'Actor / Trigger',
    businessObject: 'Business Object',
    successResult: 'Success Result',
    systemEntry: 'System flow / entry not explicitly modeled',
    system: 'System',
    workflowSteps: (workflow: DocumentationWorkflow) => [
      `Open ${workflow.ui?.name ? humanize(workflow.ui.name) : 'the configured system entry'}.`,
      `Submit ${workflow.commands.map((command) => humanize(command.name)).join(', ') || humanize(workflow.slice)} with valid business data.`,
      `Confirm ${workflow.events.map((event) => humanize(event.name)).join(', ') || 'the expected business result'}${workflow.resultingState ? ` and status ${humanize(workflow.resultingState)}` : ''}.`,
      workflow.readmodels.length
        ? `Review ${workflow.readmodels.map(humanize).join(', ')} for updated display data.`
        : 'Confirm the operation result in the relevant status or audit view.'
    ],
    notes: 'Notes',
    reviewQuestion: 'Review question',
    command: 'Command',
    field: 'Field',
    type: 'Type',
    requirement: 'Requirement',
    exampleOrRule: 'Example / Rule',
    noInputFields: 'No input fields are explicitly modeled for this capability.',
    dataViews: 'Data Views And Queries',
    readModel: 'Read Model',
    whereUsed: 'Where Used',
    searchAndKeys: 'Search / Keys',
    updatedBy: 'Updated By',
    identifier: 'identifier',
    query: 'query',
    listView: 'list view',
    detailView: 'detail view',
    noReadmodels: 'No read models are explicitly modeled.',
    rulesAndExceptions: 'Rules And Exceptions',
    noRules: 'No explicit rules or exception scenarios are modeled.',
    troubleshooting: 'Troubleshooting',
    troubleshootingChecklist: (bundle: DocumentationBundle) => [
      'If an operation cannot be submitted, check required fields, identifiers, and permission scope.',
      'If data is missing from a list or detail view, confirm the source event was produced and the read model has refreshed.',
      'If a business rule rejects the operation, use the rule description and acceptance scenario to correct the input.',
      bundle.integrations.length || bundle.contexts.some((context) => context.externalSystems.length)
        ? 'If external-system data is unavailable, verify integration connectivity and retry policy status.'
        : 'If external-system behavior is required, confirm it has been modeled and documented before release.',
      'Escalate unresolved issues with the feature name, submitted command, expected result, timestamp, and visible error message.'
    ],
    notModeled: 'Not explicitly modeled'
  },
  'zh-CN': {
    title: '使用手册',
    overview: '概述',
    overviewBody: (bundle: DocumentationBundle) =>
      `本文档说明 ${bundle.title} 的用户操作方式，包括角色权限、功能入口、输入要求、业务结果、数据视图和异常处理。正式交付前可在 Markdown 中继续补充截图和环境说明。`,
    rolesAndAccess: '角色与权限',
    role: '角色',
    availableCapabilities: '可用能力',
    primaryEntry: '主要入口',
    noActors: '当前未明确建模用户角色。发布前需确认最终权限角色。',
    quickStart: '快速开始',
    quickStartChecklist: (bundle: DocumentationBundle) => [
      '使用具备目标业务上下文权限的账号登录系统。',
      `从 ${bundle.workflows.filter((workflow) => workflow.ui).length} 个已建模页面入口中打开目标功能；如为后台流程，则按系统操作规程触发。`,
      '提交操作前准备必填标识和业务输入数据。',
      '提交后确认业务结果，并查看相关 Read Model 或状态视图。',
      '如校验失败，根据规则或异常提示修正输入，必要时重新提交。'
    ],
    featureGuide: '功能操作指南',
    contextSummary: '上下文说明',
    noCapabilities: '该上下文尚未明确建模业务能力。',
    item: '项目',
    description: '说明',
    entry: '入口',
    actorOrTrigger: '角色/触发条件',
    businessObject: '业务对象',
    successResult: '成功结果',
    systemEntry: '系统流程/入口未明确',
    system: '系统',
    workflowSteps: (workflow: DocumentationWorkflow) => [
      `打开${workflow.ui?.name ? humanize(workflow.ui.name) : '已配置的系统入口'}。`,
      `按有效业务数据提交 ${workflow.commands.map((command) => humanize(command.name)).join(', ') || humanize(workflow.slice)}。`,
      `确认${workflow.events.map((event) => humanize(event.name)).join(', ') || '预期业务结果'}${workflow.resultingState ? `，并确认状态变为 ${humanize(workflow.resultingState)}` : ''}。`,
      workflow.readmodels.length
        ? `查看 ${workflow.readmodels.map(humanize).join(', ')} 中的最新展示数据。`
        : '在相关状态或审计视图中确认操作结果。'
    ],
    notes: '注意事项',
    reviewQuestion: '待确认问题',
    command: '命令',
    field: '字段',
    type: '类型',
    requirement: '填写要求',
    exampleOrRule: '示例/规则',
    noInputFields: '该能力尚未明确建模输入字段。',
    dataViews: '数据视图与查询',
    readModel: 'Read Model',
    whereUsed: '使用位置',
    searchAndKeys: '查询/标识',
    updatedBy: '更新来源',
    identifier: '标识',
    query: '查询',
    listView: '列表视图',
    detailView: '详情视图',
    noReadmodels: '当前未明确 Read Model。',
    rulesAndExceptions: '规则与异常',
    noRules: '当前未明确业务规则或异常场景。',
    troubleshooting: '常见问题处理',
    troubleshootingChecklist: (bundle: DocumentationBundle) => [
      '如操作无法提交，先检查必填字段、业务标识和权限范围。',
      '如列表或详情缺少数据，确认来源事件已产生且 Read Model 已刷新。',
      '如业务规则拒绝操作，根据规则说明和验收场景修正输入。',
      bundle.integrations.length || bundle.contexts.some((context) => context.externalSystems.length)
        ? '如外部系统数据不可用，检查集成连通性和重试策略状态。'
        : '如需要外部系统行为，发布前应补充建模和文档说明。',
      '无法解决的问题需携带功能名称、提交命令、预期结果、发生时间和可见错误信息升级处理。'
    ],
    notModeled: '尚未明确'
  }
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
        : specification.error
          ? `error "${specification.error}"`
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

const collectGaps = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string[] => {
  const zh = language === 'zh-CN';
  return [
    ...bundle.workflows
      .filter((workflow) => workflow.commands.length > 0 && workflow.events.length === 0)
      .map((workflow) => zh
        ? `${humanize(workflow.slice)} 有输入操作，但尚未明确业务结果。`
        : `${humanize(workflow.slice)} has an input operation but no explicit business result.`),
    ...summarizeMissingSpecifications(bundle, language),
    ...bundle.readmodels
      .filter((readmodel) => readmodel.sourceEvents.length === 0)
      .map((readmodel) => zh
        ? `${humanize(readmodel.name)} 尚未明确数据更新来源。`
        : `${humanize(readmodel.name)} has no explicit data update source.`),
    ...bundle.readmodels
      .filter((readmodel) => readmodel.identifierFields.length === 0)
      .map((readmodel) => zh
        ? `${humanize(readmodel.name)} 尚未标记逻辑标识字段。`
        : `${humanize(readmodel.name)} has no field marked as a logical identifier.`)
  ];
};

const summarizeMissingSpecifications = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string[] => {
  const zh = language === 'zh-CN';
  const missingByContext = new Map<string, string[]>();
  for (const workflow of bundle.workflows) {
    if (workflow.commands.length === 0 || workflow.specifications.length > 0) continue;
    const names = missingByContext.get(workflow.context) ?? [];
    names.push(humanize(workflow.slice));
    missingByContext.set(workflow.context, names);
  }

  return [...missingByContext.entries()].map(([context, names]) => {
    const examples = names.slice(0, 4).join(', ');
    const remainder = names.length > 4
      ? zh ? `，另有 ${names.length - 4} 个` : ` and ${names.length - 4} more`
      : '';
    return zh
      ? `${humanize(context)} 有 ${names.length} 个业务操作尚未定义明确验收规则：${examples}${remainder}。`
      : `${humanize(context)} has ${names.length} business operations without explicit acceptance specifications: ${examples}${remainder}.`;
  });
};

const header = (
  bundle: DocumentationBundle,
  suffix: string,
  language: DocumentationLanguage = 'en'
): string[] => [
  `# ${bundle.title} ${suffix}`,
  '',
  ...documentFrontMatterLines(bundle.generatedAt, language)
];

const section = (lines: string[], title: string): void => {
  lines.push(`## ${title}`);
  lines.push('');
};

const appendDiagnostics = (
  lines: string[],
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): void => {
  if (!bundle.diagnostics.length) return;
  lines.push(`> ${softwareText[language].diagnosticsWarning}`);
  lines.push('');
  appendList(lines, bundle.diagnostics);
  lines.push('');
};

const appendLabeledList = (
  lines: string[],
  label: string,
  values: string[],
  emptyText?: string
): void => {
  lines.push(`**${label}**`);
  lines.push('');
  appendList(lines, values, emptyText ?? `No ${label.toLowerCase()} are explicitly modeled.`);
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
