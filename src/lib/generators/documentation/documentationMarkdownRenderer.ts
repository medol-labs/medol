import { humanize } from '../../name';
import type {
  DocumentationBundle,
  DocumentationField,
  DocumentationLanguage,
  DocumentationWorkflow
} from './documentationModel';

export const renderSoftwareDesignMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = softwareText[language];
  const lines = header(bundle, text.title);

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
      'Validate happy paths, business rejection paths, state transitions, data-view updates, and operational automation.',
      'Provide a QA planning baseline that can be expanded into manual cases, API tests, integration tests, and regression suites.'
    ],
    testStrategy: 'Test Strategy',
    strategy: [
      'Use scenario-based functional tests for user-facing capabilities and system-triggered workflows.',
      'Use API or service-level tests for operations without a UI entry point.',
      'Use integration tests for external systems, automation triggers, and cross-context handoffs.',
      'Use read-model assertions to verify projection freshness, key selection, filtering, sorting, and idempotent updates.',
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
      '验证正常路径、业务拒绝路径、状态流转、数据视图更新和运维自动化。',
      '形成测试计划基线，后续可展开为手工用例、API 测试、集成测试和回归测试套件。'
    ],
    testStrategy: '测试策略',
    strategy: [
      '面向用户功能和系统触发流程采用场景化功能测试。',
      '没有页面入口的操作采用 API 或服务层测试。',
      '外部系统、自动化触发和跨上下文协作采用集成测试。',
      'Read Model 通过投影新鲜度、主键、过滤、排序和幂等更新断言进行验证。',
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

export const renderTestOutlineMarkdown = (
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = testOutlineText[language];
  const lines = header(bundle, text.title);

  section(lines, text.objectivesAndScope);
  appendList(lines, text.objectives(bundle));
  lines.push('');
  appendDiagnostics(lines, bundle, language);

  section(lines, text.testStrategy);
  appendList(lines, text.strategy);
  lines.push('');

  section(lines, text.environmentAndData);
  appendList(lines, text.environmentChecklist);
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

const header = (bundle: DocumentationBundle, suffix: string): string[] => [
  `# ${bundle.title} ${suffix}`,
  ''
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
