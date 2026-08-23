import { humanize } from '../../name';
import { documentFrontMatterLines } from '../documentation/documentFrontMatter';
import type { DocumentationLanguage } from '../documentation/documentationModel';
import type {
  PrdDocument,
  PrdField,
  PrdAggregate,
  PrdSlice,
  PrdSpecification
} from './prdModel';

export const renderPrdMarkdown = (
  document: PrdDocument,
  language: DocumentationLanguage = 'en'
): string => {
  const zh = language === 'zh-CN';
  const text = prdText[language];
  const lines: string[] = [];
  const aggregateSources = document.aggregates.map((aggregate) => aggregate.id);
  const actorSources = document.actors.flatMap((actor) => actor.sourceRefs);
  const sliceSources = document.slices.flatMap((slice) => slice.sourceRefs);
  const dataSources = document.dataDictionary.map((field) => field.sourceRef);
  const automationSources = document.automations.flatMap((automation) => automation.sourceRefs);
  const documentSources = unique([
    ...aggregateSources,
    ...actorSources,
    ...sliceSources,
    ...dataSources,
    ...automationSources
  ]);

  lines.push(`# ${document.title} ${text.titleSuffix}`);
  lines.push('');
  lines.push(...documentFrontMatterLines(document.generatedAt, language));
  lines.push(sectionMarker('prd.section.overview', documentSources));
  heading(lines, 2, text.backgroundAndGoals);
  lines.push(formatOverview(document, language));
  lines.push('');
  lines.push(text.goalLead);
  lines.push('');
  appendList(lines, text.goals);
  lines.push('');
  if (document.notes.length) {
    heading(lines, 3, text.businessBackground);
    appendList(lines, document.notes);
    lines.push('');
  }

  lines.push(sectionMarker('prd.section.scope', [...aggregateSources, ...actorSources]));
  heading(lines, 2, text.scopeAndBoundary);
  lines.push(`**${text.businessScope}:** ${document.context.split(', ').map(humanize).join(', ')}`);
  lines.push('');
  lines.push(`**${text.coreObjects}:** ${document.aggregates.map((aggregate) => humanize(aggregate.name)).join(', ') || text.notModeled}`);
  lines.push('');
  lines.push(`**${text.roles}:** ${document.actors.map((actor) => humanize(actor.name)).join(', ') || text.notModeled}`);
  lines.push('');
  lines.push(text.scopeBoundaryNote);
  lines.push('');

  appendRolePermissionMatrix(lines, document, language);

  if (document.aggregates.length) {
    lines.push(sectionMarker('prd.section.businessObjects', aggregateSources));
    heading(lines, 2, text.businessObjectOverview);
    lines.push(`| ${text.objectName} | ${text.ownerContext} | ${text.lifecycle} | ${text.relatedFeatures} |`);
    lines.push('| --- | --- | --- | --- |');
    for (const object of document.aggregates) {
      const slices = document.slices.filter((slice) => slice.aggregate === object.name);
      lines.push(`| ${cell(humanize(object.name))} | ${cell(object.context ? humanize(object.context) : '-')} | ${cell(formatLifecycle(object, language))} | ${cell(slices.map((slice) => humanize(slice.name)).join(', ') || text.notModeled)} |`);
    }
    lines.push('');
  }

  lines.push(sectionMarker('prd.section.featureInventory', sliceSources));
  heading(lines, 2, text.featureOverview);
  for (const [context, slices] of groupBy(document.slices, (slice) => slice.context)) {
    lines.push(sectionMarker(`prd.section.featureInventory.${context}`, slices.flatMap((slice) => slice.sourceRefs)));
    lines.push(`### ${humanize(context)}`);
    lines.push('');
    lines.push(text.featureOverviewIntro(slices.length));
    lines.push('');
    lines.push(zh
      ? '| 功能 | 业务对象 | 类型 | 页面/入口 | 用户角色 | 用户价值/业务结果 |'
      : '| Feature | Business Object | Type | UI / Entry | Role | User Value / Business Result |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const slice of slices) {
      lines.push(`| ${cell(humanize(slice.name))} | ${cell(humanize(slice.aggregate))} | ${cell(operationLabel(slice.operation, language))} | ${cell(formatUi(slice, language))} | ${cell(slice.actor ? humanize(slice.actor) : text.systemOrUnspecified)} | ${cell(formatResult(slice, language))} |`);
    }
    lines.push('');
  }

  lines.push(sectionMarker('prd.section.functionalRequirements', sliceSources));
  heading(lines, 2, text.functionalRequirements);
  const groupedObjects = document.aggregates.filter((object) =>
    document.slices.some((slice) => slice.aggregate === object.name)
  );
  if (groupedObjects.length) {
    for (const object of groupedObjects) {
      lines.push(`<!-- em:section id="prd.section.aggregate.${object.name}" source="${object.id}" -->`);
      heading(lines, 3, humanize(object.name));
      lines.push(`**${text.ownerContext}:** ${object.context ? humanize(object.context) : text.notModeled}`);
      lines.push('');
      lines.push(`**${text.lifecycle}:** ${formatLifecycle(object, language)}`);
      lines.push('');
      const slices = document.slices.filter((slice) => slice.aggregate === object.name);
      for (const slice of slices) appendFeatureRequirement(lines, slice, language);
    }
  } else {
    appendList(lines, document.slices.map((slice) => `${humanize(slice.name)}: ${formatResult(slice, language)}.`));
    lines.push('');
  }

  lines.push(sectionMarker('prd.section.userExperience', sliceSources));
  heading(lines, 2, text.userExperience);
  lines.push(zh
    ? '| 页面/入口 | 所属功能 | 交互类型 | 主要输入 | 输出/展示 |'
    : '| UI / Entry | Feature | Interaction | Primary Input | Output / Display |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const slice of document.slices) {
    lines.push(`| ${cell(formatUi(slice, language))} | ${cell(humanize(slice.name))} | ${cell(operationLabel(slice.operation, language))} | ${cell(slice.command?.fields.map((field) => field.name).join(', ') || text.notApplicable)} | ${cell(slice.readModelNames.map(humanize).join(', ') || formatResult(slice, language))} |`);
  }
  lines.push('');

  lines.push(sectionMarker('prd.section.acceptanceMatrix', sliceSources));
  heading(lines, 2, text.acceptanceMatrix);
  lines.push(zh
    ? '| 编号 | 功能 | 场景/前置条件 | 用户操作 | 预期结果 | 验收依据 |'
    : '| ID | Feature | Scenario / Preconditions | User Action | Expected Result | Acceptance Basis |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  let acceptanceIndex = 1;
  for (const slice of document.slices) {
    const scenarios = buildAcceptanceScenarios(slice, language);
    for (const scenario of scenarios) {
      lines.push(`| AC-${String(acceptanceIndex).padStart(3, '0')} | ${cell(humanize(slice.name))} | ${cell(scenario.given)} | ${cell(scenario.when)} | ${cell(scenario.then)} | ${cell(scenario.source)} |`);
      acceptanceIndex += 1;
    }
  }
  lines.push('');

  lines.push(sectionMarker('prd.section.dataDictionary', dataSources));
  heading(lines, 2, text.dataAndRules);
  const keyFields = document.dataDictionary.filter((field) =>
    field.attributes.some((attribute) => ['id', 'query', 'optional'].includes(attribute))
    || Boolean(field.example)
    || Boolean(field.mapping)
  );
  if (keyFields.length) {
    lines.push(zh
      ? '| 所属元素 | 字段 | 类型 | 数量 | 属性 | 示例 | 来源/计算规则 |'
      : '| Owner | Field | Type | Cardinality | Attributes | Example | Source / Rule |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const field of keyFields) {
      lines.push(`| ${cell(humanize(field.owner))} | ${cell(field.name)} | ${cell(field.type)} | ${cell(field.cardinality)} | ${cell(field.attributes.join(', ') || '-')} | ${cell(field.example ?? '-')} | ${cell(field.mapping ?? '-')} |`);
    }
  } else {
    lines.push(text.noKeyFields);
  }
  lines.push('');

  lines.push(sectionMarker('prd.section.automations', automationSources));
  heading(lines, 2, text.operationsAndIntegrations);
  if (document.automations.length) {
    lines.push(zh ? '| 名称 | 类型 | 触发与规则 |' : '| Name | Type | Trigger and Rules |');
    lines.push('| --- | --- | --- |');
    for (const automation of document.automations) {
      const metadata = Object.entries(automation.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      lines.push(`| ${cell(humanize(automation.name))} | ${cell(humanize(automation.kind))} | ${cell(metadata || '-')} |`);
    }
  } else {
    lines.push(text.noAutomation);
  }
  lines.push('');

  lines.push(sectionMarker('prd.section.nonFunctional', documentSources));
  heading(lines, 2, text.nonFunctionalRequirements);
  appendList(lines, text.nonFunctionalChecklist);
  if (document.metrics.length) {
    lines.push('');
    lines.push(`**${text.modelMetrics}**`);
    lines.push('');
    appendList(lines, document.metrics.map(humanize));
  }
  lines.push('');

  lines.push(sectionMarker('prd.section.deliveryAcceptance', sliceSources));
  heading(lines, 2, text.deliveryAcceptance);
  appendList(lines, text.deliveryChecklist);
  lines.push('');

  lines.push(sectionMarker('prd.section.openQuestions', sliceSources));
  heading(lines, 2, text.openQuestions);
  appendList(
    lines,
    document.openQuestions.map((question) => zh ? localizeOpenQuestion(question) : question),
    text.noOpenQuestions
  );
  lines.push('');

  return lines.join('\n');
};

const renderLegacyPrdMarkdown = (
  document: PrdDocument,
  language: DocumentationLanguage = 'en'
): string => {
  const zh = language === 'zh-CN';
  const lines: string[] = [];

  lines.push(`# ${document.title} ${zh ? '产品需求与验收文档' : 'Product Requirements and Acceptance Document'}`);
  lines.push('');
  lines.push(...documentFrontMatterLines(document.generatedAt, language));
  lines.push('<!-- em:section id="prd.section.overview" -->');
  heading(lines, 2, zh ? '文档目的' : 'Document Purpose');
  lines.push(zh
    ? '本文档整理产品功能、CRUD 操作、页面入口、业务结果和验收依据，用于产品评审、研发对齐、测试用例设计和交付验收。'
    : 'This document derives product functions, CRUD operations, UI entry points, business outcomes, and acceptance evidence from MEDOL for product review, implementation alignment, test design, and delivery acceptance.');
  lines.push('');
  lines.push(`**${zh ? '建模范围' : 'Modeled scope'}:** ${document.context.split(', ').map(humanize).join(', ')}`);
  lines.push('');
  if (document.notes.length) {
    heading(lines, 3, zh ? '业务说明' : 'Business Notes');
    appendList(lines, document.notes);
    lines.push('');
  }

  lines.push('<!-- em:section id="prd.section.scope" -->');
  heading(lines, 2, zh ? '产品范围与角色' : 'Product Scope and Roles');
  lines.push(`**${zh ? '核心业务对象' : 'Core business objects'}:** ${document.aggregates.map((aggregate) => humanize(aggregate.name)).join(', ') || '-'}`);
  lines.push('');
  lines.push(`**${zh ? '参与角色' : 'Actors'}:** ${document.actors.map((actor) => humanize(actor.name)).join(', ') || (zh ? '尚未明确' : 'Not explicitly modeled')}`);
  lines.push('');

  lines.push('<!-- em:section id="prd.section.featureInventory" -->');
  heading(lines, 2, zh ? '功能与 CRUD 清单' : 'Feature and CRUD Inventory');
  lines.push(zh
    ? '| 业务域 | 业务对象 | 功能 | 操作类型 | 页面/入口 | 执行角色 | 业务结果 |'
    : '| Context | Business Object | Feature | Operation | UI / Entry | Actor | Business Result |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const slice of document.slices) {
    lines.push(`| ${cell(humanize(slice.context))} | ${cell(humanize(slice.aggregate))} | ${cell(humanize(slice.name))} | ${cell(operationLabel(slice.operation, language))} | ${cell(formatUi(slice, language))} | ${cell(slice.actor ? humanize(slice.actor) : zh ? '系统/未明确' : 'System / unspecified')} | ${cell(formatResult(slice, language))} |`);
  }
  lines.push('');

  lines.push('<!-- em:section id="prd.section.modules" -->');
  heading(lines, 2, zh ? '模块需求与验收' : 'Module Requirements and Acceptance');
  for (const aggregate of document.aggregates) {
    lines.push(`<!-- em:section id="prd.section.aggregate.${aggregate.name}" source="${aggregate.id}" -->`);
    heading(lines, 3, humanize(aggregate.name));
    lines.push(`**${zh ? '生命周期' : 'Lifecycle'}:** ${aggregate.states.length ? aggregate.states.map(humanize).join(' -> ') : zh ? '尚未明确' : 'Not explicitly modeled'}`);
    lines.push('');
    const slices = document.slices.filter((slice) => slice.aggregate === aggregate.name);
    for (const slice of slices) appendSlice(lines, slice, language);
  }

  lines.push('<!-- em:section id="prd.section.acceptanceMatrix" -->');
  heading(lines, 2, zh ? '验收矩阵' : 'Acceptance Matrix');
  lines.push(zh
    ? '| 编号 | 功能 | 前置条件 | 操作 | 预期结果 | 验收来源 |'
    : '| ID | Feature | Preconditions | Action | Expected Result | Evidence Source |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  let acceptanceIndex = 1;
  for (const slice of document.slices) {
    const scenarios = buildAcceptanceScenarios(slice, language);
    for (const scenario of scenarios) {
      lines.push(`| AC-${String(acceptanceIndex).padStart(3, '0')} | ${cell(humanize(slice.name))} | ${cell(scenario.given)} | ${cell(scenario.when)} | ${cell(scenario.then)} | ${cell(scenario.source)} |`);
      acceptanceIndex += 1;
    }
  }
  lines.push('');

  lines.push('<!-- em:section id="prd.section.dataDictionary" -->');
  heading(lines, 2, zh ? '关键数据规则' : 'Key Data Rules');
  const keyFields = document.dataDictionary.filter((field) =>
    field.attributes.some((attribute) => ['id', 'query', 'optional'].includes(attribute))
    || Boolean(field.example)
    || Boolean(field.mapping)
  );
  if (keyFields.length) {
    lines.push(zh
      ? '| 所属元素 | 字段 | 类型 | 数量 | 属性 | 示例 | 来源/计算规则 |'
      : '| Owner | Field | Type | Cardinality | Attributes | Example | Source / Rule |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const field of keyFields) {
      lines.push(`| ${cell(humanize(field.owner))} | ${cell(field.name)} | ${cell(field.type)} | ${cell(field.cardinality)} | ${cell(field.attributes.join(', ') || '-')} | ${cell(field.example ?? '-')} | ${cell(field.mapping ?? '-')} |`);
    }
  } else {
    lines.push(zh ? '当前未定义需要单独说明的标识、查询、示例或映射字段。' : 'No identifier, query, example, or mapping fields require separate documentation.');
  }
  lines.push('');

  lines.push('<!-- em:section id="prd.section.automations" -->');
  heading(lines, 2, zh ? '自动化与集成' : 'Automation and Integrations');
  if (document.automations.length) {
    lines.push(zh ? '| 名称 | 类型 | 触发与规则 |' : '| Name | Type | Trigger and Rules |');
    lines.push('| --- | --- | --- |');
    for (const automation of document.automations) {
      const metadata = Object.entries(automation.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      lines.push(`| ${cell(humanize(automation.name))} | ${cell(humanize(automation.kind))} | ${cell(metadata || '-')} |`);
    }
  } else {
    lines.push(zh ? '当前未明确自动化或集成。' : 'No automation or integrations are explicitly modeled.');
  }
  lines.push('');

  lines.push('<!-- em:section id="prd.section.deliveryAcceptance" -->');
  heading(lines, 2, zh ? '交付验收检查表' : 'Delivery Acceptance Checklist');
  appendList(lines, zh
    ? [
        '功能清单中的页面、查询和操作均可访问，实际权限范围需由业务方确认。',
        '命令输入字段的必填、可选、标识和示例约束与领域模型一致。',
        '操作成功后产生约定事件，并进入领域模型指定的业务状态。',
        'Read Model 能根据订阅事件更新，并满足列表或详情查询需要。',
        'derived 字段按 rule 计算，from 字段能追踪到来源字段。',
        '错误提示、重复提交、并发冲突、权限拒绝和操作幂等策略需在开发前确认。',
        '性能、容量、安全、审计、数据保留和可用性指标需由项目另行定义。'
      ]
    : [
        'Every page, query, and operation in the feature inventory is accessible; final authorization scope requires business confirmation.',
        'Required, optional, identifier, and example constraints match command input fields in the MEDOL.',
        'Successful operations produce the modeled event and transition to the modeled business state.',
        'Read models update from subscribed events and support the required list or detail access.',
        'Derived fields follow their rule and directly mapped fields remain traceable to their source.',
        'Error messages, duplicate submission, concurrency conflicts, permission denial, and idempotency policies require confirmation before implementation.',
        'Performance, capacity, security, audit, retention, and availability targets must be specified separately.'
      ]);
  lines.push('');

  lines.push('<!-- em:section id="prd.section.openQuestions" -->');
  heading(lines, 2, zh ? '待确认事项' : 'Open Questions');
  appendList(
    lines,
    document.openQuestions.map((question) => zh ? localizeOpenQuestion(question) : question),
    zh ? '暂无待确认事项。' : 'No open questions were generated.'
  );
  lines.push('');

  return lines.join('\n');
};

const formatOverview = (
  document: PrdDocument,
  language: DocumentationLanguage
): string => {
  const text = prdText[language];
  const contexts = document.context.split(', ').map(humanize).filter(Boolean);
  const contextText = contexts.join(language === 'zh-CN' ? '、' : ', ')
    || text.modeledContext;
  const domainText = document.domain ? humanize(document.domain) : document.title;
  if (language === 'zh-CN') {
    return `${domainText}覆盖${contextText}，定义实施所需的产品能力、操作角色、数据视图、业务规则和交付验收范围。`;
  }
  if (document.domain) {
    return `${domainText} covers ${contextText} and defines the product capabilities, operating roles, data views, business rules, and delivery acceptance scope required for implementation.`;
  }
  return `${contextText} defines the product capabilities, operating roles, data views, business rules, and delivery acceptance scope required for implementation.`;
};

const appendRolePermissionMatrix = (
  lines: string[],
  document: PrdDocument,
  language: DocumentationLanguage
): void => {
  const text = prdText[language];
  const roleEntries = buildRolePermissionEntries(document.slices, language);
  lines.push('<!-- em:section id="prd.section.rolePermissionMatrix" -->');
  heading(lines, 2, text.rolePermissionMatrix);
  if (!roleEntries.length) {
    lines.push(text.noRolePermissionMatrix);
    lines.push('');
    return;
  }
  lines.push(`| ${text.roleColumn} | ${text.responsibilityColumn} | ${text.accessibleModulesColumn} | ${text.keyPermissionsColumn} | ${text.dataScopeColumn} |`);
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entry of roleEntries) {
    lines.push(`| ${cell(entry.role)} | ${cell(entry.responsibility)} | ${cell(entry.modules)} | ${cell(entry.permissions)} | ${cell(entry.dataScope)} |`);
  }
  lines.push('');
};

interface RolePermissionEntry {
  role: string;
  responsibility: string;
  modules: string;
  permissions: string;
  dataScope: string;
}

const buildRolePermissionEntries = (
  slices: PrdSlice[],
  language: DocumentationLanguage
): RolePermissionEntry[] => {
  const text = prdText[language];
  const actorSlices = slices.filter((slice) => slice.actor);
  const groups = groupBy(actorSlices, (slice) => slice.actor ?? '');
  return groups.map(([actor, roleSlices]) => {
    const modules = unique(roleSlices.map((slice) => humanize(slice.context))).join(', ');
    const operations = unique(roleSlices.map((slice) =>
      `${operationVerb(slice.operation, language)} ${humanize(slice.name)}`
    ));
    const aggregates = unique(roleSlices.map((slice) => humanize(slice.aggregate)));
    return {
      role: humanize(actor),
      responsibility: roleResponsibility(actor, roleSlices, language),
      modules,
      permissions: operations.slice(0, 8).join('; ')
        + (operations.length > 8 ? `; ${text.andMore(operations.length - 8)}` : ''),
      dataScope: inferActorDataScope(actor, roleSlices, aggregates, language)
    };
  });
};

const appendFeaturePermissionRequirement = (
  lines: string[],
  slice: PrdSlice,
  language: DocumentationLanguage
): void => {
  const text = prdText[language];
  const actor = slice.actor ? humanize(slice.actor) : text.systemOrUnspecified;
  const scope = inferActorDataScope(slice.actor, [slice], [humanize(slice.aggregate)], language);
  lines.push(`**${text.permissionRequirements}**`);
  lines.push('');
  appendList(lines, [
    text.permissionRoleRequirement(actor),
    text.permissionScopeRequirement(scope),
    text.permissionOperationRequirement(actor, operationVerb(slice.operation, language), humanize(slice.name)),
    ...permissionRuleRequirements(slice, language)
  ]);
  lines.push('');
  lines.push(`**${text.permissionDeniedHandling}**`);
  lines.push('');
  appendList(lines, [
    text.denySubmit,
    text.denyMessage,
    slice.event
      ? text.denyNoEvent(humanize(slice.event.name))
      : text.denyNoStateChange,
    text.denyAudit
  ]);
  lines.push('');
};

const permissionRuleRequirements = (
  slice: PrdSlice,
  language: DocumentationLanguage
): string[] => {
  const zh = language === 'zh-CN';
  const rules = slice.specifications
    .filter((specification) =>
      specification.rule
      && /(permission|authorize|authorization|access|role|scope|tenant|organization|federation|权限|授权|访问|角色|范围|租户|组织|联邦)/i.test(specification.rule)
    )
    .map((specification) => specification.rule?.replace(/\s+/g, ' ').trim())
    .filter((rule): rule is string => Boolean(rule));
  if (rules.length) {
    return rules.map((rule) => zh ? `需满足权限规则：${rule}` : `Must satisfy permission rule: ${rule}`);
  }
  return [
    zh
      ? '授权条件、拒绝原因和处理方式应与业务权限规则保持一致。'
      : 'Authorization conditions, denial reasons, and handling behavior must remain consistent with the business permission rules.'
  ];
};

const roleResponsibility = (
  actor: string,
  slices: PrdSlice[],
  language: DocumentationLanguage
): string => {
  const zh = language === 'zh-CN';
  const actorText = humanize(actor);
  const operations = unique(slices.map((slice) => operationLabel(slice.operation, language))).join(zh ? '、' : ', ');
  const modules = unique(slices.map((slice) => humanize(slice.context))).slice(0, 3).join(zh ? '、' : ', ');
  return zh
    ? `负责${modules || '相关模块'}中的${operations || '业务操作'}。`
    : `Responsible for ${operations || 'business operations'} in ${modules || 'the modeled modules'}.`;
};

const inferActorDataScope = (
  actor: string | undefined,
  slices: PrdSlice[],
  aggregates: string[],
  language: DocumentationLanguage
): string => {
  const zh = language === 'zh-CN';
  if (!actor) return zh ? '系统处理范围，需在实现前确认。' : 'System processing scope; confirm before implementation.';
  if (/platform|superadmin|systemadmin/i.test(actor)) return zh ? '全平台或被授权平台范围。' : 'Full platform or authorized platform scope.';
  if (/federation/i.test(actor)) return zh ? '所属联邦及其成员数据范围。' : 'Assigned federation and member data scope.';
  if (/organization|data steward|data owner/i.test(actor)) return zh ? '所属组织或机构数据范围。' : 'Assigned organization data scope.';
  if (/runtime|node|agent/i.test(actor)) return zh ? '绑定运行时、节点或代理实例范围。' : 'Bound runtime, node, or agent instance scope.';
  if (/compliance|governance|security|review|audit/i.test(actor)) return zh ? '授权审计、治理或监管范围。' : 'Authorized audit, governance, or compliance scope.';
  const modules = unique(slices.map((slice) => humanize(slice.context))).join(zh ? '、' : ', ');
  const objects = aggregates.join(zh ? '、' : ', ');
  return zh
    ? `${modules || '相关模块'}内与${objects || '相关业务对象'}关联的授权数据范围。`
    : `Authorized data scope for ${objects || 'related business objects'} in ${modules || 'the related modules'}.`;
};

const operationVerb = (
  operation: PrdSlice['operation'],
  language: DocumentationLanguage
): string => {
  if (language === 'zh-CN') {
    return {
      create: '创建/登记',
      read: '查看',
      update: '修改/状态处理',
      delete: '删除/撤销',
      action: '执行',
      automation: '触发'
    }[operation];
  }
  return {
    create: 'create',
    read: 'view',
    update: 'update',
    delete: 'delete',
    action: 'execute',
    automation: 'trigger'
  }[operation];
};

const appendFeatureRequirement = (
  lines: string[],
  slice: PrdSlice,
  language: DocumentationLanguage
): void => {
  const text = prdText[language];
  lines.push(`<!-- em:section id="prd.section.slice.${slice.name}" source="${slice.id}" -->`);
  heading(lines, 4, `${humanize(slice.name)} · ${operationLabel(slice.operation, language)}`);
  lines.push(`**${text.userStory}**`);
  lines.push('');
  lines.push(featureStory(slice, language));
  lines.push('');
  lines.push(`**${text.requirementDescription}**`);
  lines.push('');
  appendList(lines, [
    `${text.entry}: ${formatUi(slice, language)}.`,
    `${text.role}: ${slice.actor ? humanize(slice.actor) : text.systemOrUnspecified}.`,
    `${text.businessObject}: ${humanize(slice.aggregate)}.`,
    `${text.successResult}: ${formatResult(slice, language)}.`,
    ...(slice.readModelNames.length
      ? [`${text.displayResult}: ${slice.readModelNames.map(humanize).join(', ')}.`]
      : [])
  ]);
  lines.push('');

  appendFeaturePermissionRequirement(lines, slice, language);

  appendFields(lines, text.inputFields, slice.command?.fields ?? [], language);
  if (slice.specifications.length) {
    appendRuleCoverage(lines, slice.specifications, language);
    lines.push(`**${text.acceptanceScenarios}**`);
    lines.push('');
    appendSpecifications(lines, slice.specifications, language);
  }
  if (slice.hotspots.length) {
    lines.push(`**${text.productQuestions}**`);
    lines.push('');
    appendList(lines, slice.hotspots);
    lines.push('');
  }
};

const appendSlice = (
  lines: string[],
  slice: PrdSlice,
  language: DocumentationLanguage
): void => {
  const zh = language === 'zh-CN';
  lines.push(`<!-- em:section id="prd.section.slice.${slice.name}" source="${slice.id}" -->`);
  heading(lines, 4, `${humanize(slice.name)} · ${operationLabel(slice.operation, language)}`);
  lines.push(`- **${zh ? '入口' : 'Entry'}:** ${formatUi(slice, language)}`);
  lines.push(`- **${zh ? '角色' : 'Actor'}:** ${slice.actor ? humanize(slice.actor) : zh ? '系统/未明确' : 'System / unspecified'}`);
  lines.push(`- **${zh ? '业务对象' : 'Business object'}:** ${humanize(slice.aggregate)}`);
  if (slice.command) lines.push(`- **${zh ? '提交操作' : 'Command'}:** ${humanize(slice.command.name)}`);
  if (slice.event) lines.push(`- **${zh ? '成功结果' : 'Success result'}:** ${humanize(slice.event.name)}`);
  if (slice.resultingState) lines.push(`- **${zh ? '结果状态' : 'Resulting state'}:** ${humanize(slice.resultingState)}`);
  if (slice.readModelNames.length) {
    lines.push(`- **${zh ? '查询结果' : 'Read Model'}:** ${slice.readModelNames.map(humanize).join(', ')}`);
  }
  lines.push('');

  appendFeaturePermissionRequirement(lines, slice, language);

  appendFields(lines, zh ? '输入字段' : 'Input Fields', slice.command?.fields ?? [], language);
  if (slice.specifications.length) {
    appendRuleCoverage(lines, slice.specifications, language);
    lines.push(`**${zh ? '明确验收场景' : 'Explicit Acceptance Scenarios'}**`);
    lines.push('');
    appendSpecifications(lines, slice.specifications, language);
  }
  if (slice.hotspots.length) {
    lines.push(`**${zh ? '建模热点/疑问' : 'Modeling Hotspots'}**`);
    lines.push('');
    appendList(lines, slice.hotspots);
    lines.push('');
  }
};

const appendSpecifications = (
  lines: string[],
  specifications: PrdSpecification[],
  language: DocumentationLanguage
): void => {
  const zh = language === 'zh-CN';
  for (const specification of specifications) {
    const title = specification.specification
      ? `${humanize(specification.specification)} / ${humanize(specification.name)}`
      : humanize(specification.name);
    lines.push(`- **${title}**`);
    if (specification.rule) lines.push(`  - ${zh ? '规则' : 'Rule'}: ${specification.rule.replace(/\n/g, ' ')}`);
    if (specification.expressions.length) lines.push(`  - ${zh ? '表达式' : 'Expressions'}: ${specification.expressions.join('; ')}`);
    if (specification.validates.length) lines.push(`  - ${zh ? '验证规则' : 'Validates'}: ${specification.validates.join('; ')}`);
    lines.push(`  - ${zh ? '假设' : 'Given'}: ${specification.given.map(humanize).join(', ') || (zh ? '未明确' : 'Unspecified')}`);
    lines.push(`  - ${zh ? '当' : 'When'}: ${specification.when ? humanize(specification.when) : zh ? '未明确' : 'Unspecified'}`);
    lines.push(`  - ${zh ? '则' : 'Then'}: ${specification.reject ? `${zh ? '拒绝' : 'Reject'}: ${specification.reject}` : specification.then ? humanize(specification.then) : zh ? '未明确' : 'Unspecified'}`);
    if (Object.keys(specification.examples).length) {
      lines.push(`  - ${zh ? '示例' : 'Examples'}: ${Object.entries(specification.examples).map(([key, value]) => `${key}=${value}`).join(', ')}`);
    }
  }
  lines.push('');
};

const appendRuleCoverage = (
  lines: string[],
  specifications: PrdSpecification[],
  language: DocumentationLanguage
): void => {
  const zh = language === 'zh-CN';
  const expressions = [...new Set(specifications.flatMap((specification) => specification.expressions))];
  if (!expressions.length) return;

  lines.push(`**${zh ? '业务规则闭环' : 'Business Rule Coverage'}**`);
  lines.push('');
  lines.push(zh
    ? '| 规则表达式 | 拒绝场景 | 拒绝结果 |'
    : '| Rule Expression | Reject Scenario | Rejection |');
  lines.push('| --- | --- | --- |');
  for (const expression of expressions) {
    const scenarios = specifications.filter((specification) =>
      specification.reject && specification.validates.includes(expression)
    );
    lines.push(`| ${cell(expression)} | ${cell(scenarios.map((scenario) => humanize(scenario.name)).join(', ') || (zh ? '未覆盖' : 'Not covered'))} | ${cell(scenarios.map((scenario) => scenario.reject ?? '').filter(Boolean).join('; ') || '-')} |`);
  }
  lines.push('');
};

interface AcceptanceScenario {
  given: string;
  when: string;
  then: string;
  source: string;
}

const buildAcceptanceScenarios = (
  slice: PrdSlice,
  language: DocumentationLanguage
): AcceptanceScenario[] => {
  const zh = language === 'zh-CN';
  if (slice.specifications.length) {
    return slice.specifications.map((specification) => ({
      given: specification.given.map(humanize).join(', ') || (zh ? '未明确' : 'Unspecified'),
      when: specification.when ? humanize(specification.when) : slice.command ? humanize(slice.command.name) : humanize(slice.name),
      then: specification.reject
        ? `${zh ? '拒绝' : 'Reject'}: ${specification.reject}`
        : specification.error
          ? `${zh ? '错误' : 'Error'}: ${specification.error}`
        : specification.then
          ? humanize(specification.then)
          : formatResult(slice, language),
      source: [
        `${zh ? '验收规则' : 'acceptance rule'} ${humanize(specification.name)}`,
        specification.validates.length
          ? `${zh ? '验证' : 'validates'} ${specification.validates.join('; ')}`
          : undefined
      ].filter(Boolean).join('; ')
    }));
  }

  return [{
    given: slice.resultingState
      ? `${humanize(slice.aggregate)} ${zh ? '满足执行该操作的状态条件' : 'is in an eligible state'}`
      : zh ? '满足业务前置条件，具体规则待确认' : 'Business preconditions are met; detailed rules require confirmation',
    when: slice.command
      ? `${slice.actor ? humanize(slice.actor) : zh ? '系统/用户' : 'System / user'} ${zh ? '提交' : 'submits'} ${humanize(slice.command.name)}`
      : `${zh ? '用户访问' : 'User opens'} ${formatUi(slice, language)}`,
    then: formatResult(slice, language),
    source: [
      slice.command ? `${zh ? '功能操作' : 'product action'} ${humanize(slice.command.name)}` : undefined,
      slice.event ? `${zh ? '业务结果' : 'business result'} ${humanize(slice.event.name)}` : undefined,
      slice.resultingState ? `${zh ? '状态' : 'state'} ${humanize(slice.resultingState)}` : undefined,
      slice.readModelNames.length ? `${zh ? '展示视图' : 'display view'} ${slice.readModelNames.map(humanize).join(', ')}` : undefined
    ].filter(Boolean).join('; ') || (zh ? '功能定义' : 'feature definition')
  }];
};

const formatUi = (slice: PrdSlice, language: DocumentationLanguage): string => {
  const zh = language === 'zh-CN';
  if (!slice.ui) {
    if (slice.operation === 'read' && slice.readModelNames.length) {
      return `${humanize(slice.readModelNames[0])} ${zh ? '查询入口' : 'query entry'}`;
    }
    return zh ? '系统流程/入口未明确' : 'System flow / entry unspecified';
  }
  return `${humanize(slice.ui)}${slice.uiType ? ` (${uiTypeLabel(slice.uiType, language)})` : ''}`;
};

const formatResult = (slice: PrdSlice, language: DocumentationLanguage): string => {
  const zh = language === 'zh-CN';
  const results = [
    slice.startsLifecycle ? `${zh ? '创建或启用' : 'Creates or opens'} ${humanize(slice.aggregate)}` : undefined,
    slice.event ? `${zh ? '完成业务结果' : 'Completes business result'} ${humanize(slice.event.name)}` : undefined,
    slice.resultingState ? `${zh ? '业务状态更新为' : 'Business status becomes'} ${humanize(slice.resultingState)}` : undefined,
    slice.readModelNames.length ? `${zh ? '展示' : 'Displays'} ${slice.readModelNames.map(humanize).join(', ')}` : undefined
  ].filter(Boolean);
  return results.join('; ') || (zh ? '结果待业务确认' : 'Result requires business confirmation');
};

const operationLabel = (
  operation: PrdSlice['operation'],
  language: DocumentationLanguage
): string => {
  if (language === 'en') return humanize(operation);
  return {
    create: '新增',
    read: '查询',
    update: '修改/状态操作',
    delete: '删除/撤销',
    action: '业务操作',
    automation: '自动化'
  }[operation];
};

const uiTypeLabel = (type: string, language: DocumentationLanguage): string => {
  if (language === 'en') return type;
  return {
    list: '列表',
    detail: '详情',
    form: '表单',
    dialog: '弹窗',
    drawer: '抽屉',
    confirm: '确认操作',
    wizard: '分步向导',
    inline: '行内编辑',
    background: '后台执行'
  }[type] ?? type;
};

const appendFields = (
  lines: string[],
  title: string,
  fields: PrdField[],
  language: DocumentationLanguage
): void => {
  if (!fields.length) return;
  const zh = language === 'zh-CN';
  lines.push(`**${title}**`);
  lines.push('');
  lines.push(zh
    ? '| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |'
    : '| Field | Type | Cardinality | Constraints | Example | Source / Rule |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const field of fields) {
    lines.push(`| ${cell(field.name)} | ${cell(field.type)} | ${cell(field.cardinality)} | ${cell(field.attributes.join(', ') || '-')} | ${cell(field.example ?? '-')} | ${cell(field.mapping ?? '-')} |`);
  }
  lines.push('');
};

const localizeOpenQuestion = (question: string): string => {
  if (question.startsWith('Resolve MEDOL diagnostic:')) return question.replace('Resolve MEDOL diagnostic:', '修复 MEDOL 诊断：');
  if (question.startsWith('Clarify the product behavior for')) return question.replace('Clarify the product behavior for', '明确以下功能的产品行为：');
  if (question.startsWith('Confirm the expected result event or read model for')) return question.replace('Confirm the expected result event or read model for', '确认以下功能的结果事件或 Read Model：');
  if (question.startsWith('Add acceptance criteria for')) return question.replace('Add acceptance criteria for', '补充以下功能的验收标准：');
  const acceptanceSummary = question.match(/^(.+) has (\d+) operations without explicit (?:specifications|acceptance criteria): (.+)\.$/);
  if (acceptanceSummary) {
    const examples = acceptanceSummary[3].replace(/ and (\d+) more$/, '，另有 $1 个');
    return `${acceptanceSummary[1]} 有 ${acceptanceSummary[2]} 个操作尚未定义明确的验收标准：${examples}。`;
  }
  return question;
};

const heading = (lines: string[], level: number, title: string): void => {
  lines.push(`${'#'.repeat(level)} ${title}`);
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

const sectionMarker = (id: string, sourceRefs: string[] = []): string => {
  const sources = unique(sourceRefs);
  if (sources.length === 0) return `<!-- em:section id="${escapeAttribute(id)}" -->`;
  if (sources.length === 1) return `<!-- em:section id="${escapeAttribute(id)}" source="${escapeAttribute(sources[0])}" -->`;
  return `<!-- em:section id="${escapeAttribute(id)}" sources="${escapeAttribute(sources.join(' '))}" -->`;
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const formatLifecycle = (
  object: PrdAggregate,
  language: DocumentationLanguage
): string => {
  if (object.states.length) return object.states.map(humanize).join(' -> ');
  return prdText[language].notModeled;
};

const featureStory = (
  slice: PrdSlice,
  language: DocumentationLanguage
): string => {
  const text = prdText[language];
  const actor = slice.actor ? humanize(slice.actor) : text.targetUser;
  if (language === 'zh-CN') {
    return `作为${actor}，我希望通过${formatUi(slice, language)}完成${humanize(slice.name)}，以便${formatResult(slice, language)}。`;
  }
  return `As ${actor}, I want to complete ${humanize(slice.name)} through ${formatUi(slice, language)} so that ${formatResult(slice, language)}.`;
};

const groupBy = <T>(
  items: T[],
  keyOf: (item: T) => string
): Array<[string, T[]]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
};

const unique = (values: string[]): string[] =>
  [...new Set(values.filter(Boolean))];

const prdText = {
  en: {
    titleSuffix: 'Product Requirements Document',
    backgroundAndGoals: 'Background And Goals',
    goalLead: 'This PRD is intended to align product scope, user value, delivery boundaries, and acceptance expectations before implementation begins.',
    goals: [
      'Clarify what business capabilities are included in the product scope and how users complete them.',
      'Define the expected user entries, data inputs, business results, and display outputs for each capability.',
      'Provide acceptance criteria that product, engineering, testing, and delivery stakeholders can review together.'
    ],
    businessBackground: 'Business Background',
    scopeAndBoundary: 'Scope And Boundary',
    businessScope: 'Business scope',
    coreObjects: 'Core business objects',
    roles: 'User roles',
    scopeBoundaryNote: 'Items not represented as a capability, page, data view, rule, integration, or open question in this document should be treated as out of scope until they are explicitly confirmed.',
    rolePermissionMatrix: 'Role And Permission Matrix',
    noRolePermissionMatrix: 'No user-facing actor is explicitly modeled. Permission scope requires product confirmation.',
    roleColumn: 'Role',
    responsibilityColumn: 'Responsibility',
    accessibleModulesColumn: 'Accessible Modules',
    keyPermissionsColumn: 'Key Permissions',
    dataScopeColumn: 'Data Scope',
    andMore: (count: number) => `${count} more`,
    businessObjectOverview: 'Business Object Overview',
    objectName: 'Business Object',
    ownerContext: 'Owner Context',
    lifecycle: 'Lifecycle',
    relatedFeatures: 'Related Features',
    featureOverview: 'Feature Overview',
    featureOverviewIntro: (count: number) => `This module contains ${count} product capabilities. The table summarizes user-facing entries, operating roles, and expected business value.`,
    functionalRequirements: 'Functional Requirements',
    userExperience: 'User Experience And Entry Points',
    acceptanceMatrix: 'Acceptance Matrix',
    dataAndRules: 'Data And Business Rules',
    operationsAndIntegrations: 'Operations And Integrations',
    nonFunctionalRequirements: 'Non-Functional Requirements',
    nonFunctionalChecklist: [
      'Permission, tenant, and role boundaries must be confirmed for each user-facing operation.',
      'Duplicate submission, retry, and idempotency behavior must be consistent for business operations that change state.',
      'List and detail pages must provide stable loading, empty, error, and refresh behavior.',
      'Audit, traceability, sensitive-data handling, and retention rules must be confirmed before production release.',
      'Performance, capacity, and availability targets must be agreed with business and operations stakeholders.'
    ],
    modelMetrics: 'Modeled Product Metrics',
    deliveryAcceptance: 'Delivery Acceptance Checklist',
    deliveryChecklist: [
      'Every feature listed in the scope has an accessible entry point or a confirmed system trigger.',
      'Input fields, required constraints, optional fields, examples, and derived values match the approved requirement.',
      'Successful operations produce the expected business result and visible status or data changes.',
      'Display views support the required list, detail, filtering, and refresh behavior.',
      'Business rejection messages, permission denial, concurrent changes, and retry outcomes are reviewed by product and QA.',
      'Manual product edits to this PRD are reviewed before regenerating or releasing the document.'
    ],
    openQuestions: 'Open Questions',
    noOpenQuestions: 'No open questions were generated.',
    noKeyFields: 'No identifier, query, example, or mapping fields require separate documentation.',
    noAutomation: 'No automation or integrations are explicitly modeled.',
    notModeled: 'Not explicitly modeled',
    modeledContext: 'the modeled context',
    notApplicable: '-',
    systemOrUnspecified: 'System / unspecified',
    targetUser: 'the target user',
    userStory: 'User Story',
    requirementDescription: 'Requirement Description',
    permissionRequirements: 'Permission Requirements',
    permissionDeniedHandling: 'Permission Denied Handling',
    permissionRoleRequirement: (actor: string) => `The operation is available only to ${actor} or an equivalent authorized role.`,
    permissionScopeRequirement: (scope: string) => `The actor data scope must match ${scope}`,
    permissionOperationRequirement: (actor: string, operation: string, feature: string) => `${actor} must be authorized to ${operation} ${feature}.`,
    denySubmit: 'Block submission or execution before changing business state.',
    denyMessage: 'Show a clear permission denial reason to the user or caller.',
    denyNoEvent: (event: string) => `Do not produce ${event}.`,
    denyNoStateChange: 'Do not change business state or visible read models.',
    denyAudit: 'Record the denied attempt when audit or compliance requirements apply.',
    entry: 'Entry',
    role: 'Role',
    businessObject: 'Business object',
    successResult: 'Success result',
    displayResult: 'Display result',
    inputFields: 'Input Fields',
    acceptanceScenarios: 'Acceptance Scenarios',
    productQuestions: 'Product Questions'
  },
  'zh-CN': {
    titleSuffix: '产品需求文档',
    backgroundAndGoals: '产品背景与目标',
    goalLead: '本文档用于在研发启动前统一产品范围、用户价值、交付边界与验收口径。',
    goals: [
      '明确本期产品包含哪些业务能力，以及用户通过哪些入口完成这些能力。',
      '定义每个能力的主要输入、业务结果、页面展示和数据约束。',
      '形成产品、研发、测试、交付可以共同评审的验收依据。'
    ],
    businessBackground: '业务背景',
    scopeAndBoundary: '范围与边界',
    businessScope: '业务范围',
    coreObjects: '核心业务对象',
    roles: '参与角色',
    scopeBoundaryNote: '本文档未体现为功能、页面、数据视图、业务规则、集成或待确认事项的内容，默认不纳入本期范围，除非后续评审明确补充。',
    rolePermissionMatrix: '角色与权限矩阵',
    noRolePermissionMatrix: '当前未显式建模面向用户的 actor，权限范围需由产品评审确认。',
    roleColumn: '角色',
    responsibilityColumn: '职责',
    accessibleModulesColumn: '可访问模块',
    keyPermissionsColumn: '关键权限',
    dataScopeColumn: '数据范围',
    andMore: (count: number) => `另有 ${count} 项`,
    businessObjectOverview: '业务对象概览',
    objectName: '业务对象',
    ownerContext: '归属模块',
    lifecycle: '生命周期',
    relatedFeatures: '关联功能',
    featureOverview: '功能总览',
    featureOverviewIntro: (count: number) => `本模块包含 ${count} 个产品能力。下表概括用户入口、使用角色和预期业务价值。`,
    functionalRequirements: '功能需求',
    userExperience: '用户体验与入口',
    acceptanceMatrix: '验收矩阵',
    dataAndRules: '数据与业务规则',
    operationsAndIntegrations: '自动化与集成',
    nonFunctionalRequirements: '非功能需求',
    nonFunctionalChecklist: [
      '每个面向用户的操作需要确认权限、租户和角色边界。',
      '会改变业务状态的操作需要统一重复提交、重试和幂等策略。',
      '列表和详情页面需要具备稳定的加载、空态、错误态和刷新行为。',
      '审计追踪、敏感数据处理、数据留存与可追溯要求需要在上线前确认。',
      '性能、容量和可用性目标需要由业务、研发和运维共同确认。'
    ],
    modelMetrics: '已建模产品指标',
    deliveryAcceptance: '交付验收检查表',
    deliveryChecklist: [
      '范围内每个功能均有可访问的页面入口或已确认的系统触发方式。',
      '输入字段、必填约束、可选字段、示例值和派生值与评审后的需求一致。',
      '操作成功后能够产生预期业务结果，并体现为可见的状态或数据变化。',
      '展示视图满足列表、详情、筛选、刷新等基础访问需求。',
      '业务拒绝、权限拒绝、并发修改和重试结果需要经产品与测试确认。',
      '人工修订过的 PRD 内容在重新生成或发布前需要完成差异评审。'
    ],
    openQuestions: '待确认事项',
    noOpenQuestions: '暂无待确认事项。',
    noKeyFields: '当前未定义需要单独说明的标识、查询、示例或映射字段。',
    noAutomation: '当前未明确自动化或集成。',
    notModeled: '尚未明确',
    modeledContext: '已建模上下文',
    notApplicable: '-',
    systemOrUnspecified: '系统/未明确',
    targetUser: '目标用户',
    userStory: '用户故事',
    requirementDescription: '需求说明',
    permissionRequirements: '权限要求',
    permissionDeniedHandling: '无权限处理',
    permissionRoleRequirement: (actor: string) => `仅 ${actor} 或具备等效授权的角色可使用该功能。`,
    permissionScopeRequirement: (scope: string) => `用户的数据范围必须覆盖：${scope}`,
    permissionOperationRequirement: (actor: string, operation: string, feature: string) => `${actor} 必须具备${operation} ${feature}的授权。`,
    denySubmit: '在业务状态变化前阻止提交或执行。',
    denyMessage: '向用户或调用方展示明确的无权限原因。',
    denyNoEvent: (event: string) => `不得产生 ${event}。`,
    denyNoStateChange: '不得改变业务状态或可见 Read Model。',
    denyAudit: '如涉及审计或合规要求，应记录被拒绝的操作尝试。',
    entry: '入口',
    role: '角色',
    businessObject: '业务对象',
    successResult: '成功结果',
    displayResult: '展示结果',
    inputFields: '输入字段',
    acceptanceScenarios: '验收场景',
    productQuestions: '产品疑问'
  }
} satisfies Record<DocumentationLanguage, {
  titleSuffix: string;
  backgroundAndGoals: string;
  goalLead: string;
  goals: string[];
  businessBackground: string;
  scopeAndBoundary: string;
  businessScope: string;
  coreObjects: string;
  roles: string;
  scopeBoundaryNote: string;
  rolePermissionMatrix: string;
  noRolePermissionMatrix: string;
  roleColumn: string;
  responsibilityColumn: string;
  accessibleModulesColumn: string;
  keyPermissionsColumn: string;
  dataScopeColumn: string;
  andMore: (count: number) => string;
  businessObjectOverview: string;
  objectName: string;
  ownerContext: string;
  lifecycle: string;
  relatedFeatures: string;
  featureOverview: string;
  featureOverviewIntro: (count: number) => string;
  functionalRequirements: string;
  userExperience: string;
  acceptanceMatrix: string;
  dataAndRules: string;
  operationsAndIntegrations: string;
  nonFunctionalRequirements: string;
  nonFunctionalChecklist: string[];
  modelMetrics: string;
  deliveryAcceptance: string;
  deliveryChecklist: string[];
  openQuestions: string;
  noOpenQuestions: string;
  noKeyFields: string;
  noAutomation: string;
  notModeled: string;
  notApplicable: string;
  systemOrUnspecified: string;
  targetUser: string;
  userStory: string;
  requirementDescription: string;
  permissionRequirements: string;
  permissionDeniedHandling: string;
  permissionRoleRequirement: (actor: string) => string;
  permissionScopeRequirement: (scope: string) => string;
  permissionOperationRequirement: (actor: string, operation: string, feature: string) => string;
  denySubmit: string;
  denyMessage: string;
  denyNoEvent: (event: string) => string;
  denyNoStateChange: string;
  denyAudit: string;
  entry: string;
  role: string;
  businessObject: string;
  successResult: string;
  displayResult: string;
  inputFields: string;
  acceptanceScenarios: string;
  productQuestions: string;
}>;
