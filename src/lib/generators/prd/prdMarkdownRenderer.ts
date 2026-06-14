import { humanize } from '../../name';
import type { DocumentationLanguage } from '../documentation/documentationModel';
import type {
  PrdDocument,
  PrdField,
  PrdSlice,
  PrdSpecification
} from './prdModel';

export const renderPrdMarkdown = (
  document: PrdDocument,
  language: DocumentationLanguage = 'en'
): string => {
  const zh = language === 'zh-CN';
  const lines: string[] = [];

  lines.push(`# ${document.title} ${zh ? '产品需求与验收文档' : 'Product Requirements and Acceptance Document'}`);
  lines.push('');
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
  heading(lines, 2, zh ? '自动化、策略与集成' : 'Automation, Policies, and Integrations');
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
    lines.push(zh ? '当前未明确自动化、策略或集成。' : 'No automation, policies, or integrations are explicitly modeled.');
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

  appendFields(lines, zh ? '输入字段' : 'Input Fields', slice.command?.fields ?? [], language);
  if (slice.specifications.length) {
    appendRuleCoverage(lines, slice.specifications, language);
    lines.push(`**${zh ? '明确验收场景' : 'Explicit Acceptance Scenarios'}**`);
    lines.push('');
    appendSpecifications(lines, slice.specifications, language);
  } else if (slice.command) {
    lines.push(`> ${zh ? '该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。' : 'The MEDOL does not define a specification for this operation; the acceptance matrix is inferred only from command, event, and state semantics.'}`);
    lines.push('');
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
        : specification.then
          ? humanize(specification.then)
          : formatResult(slice, language),
      source: [
        `specification ${humanize(specification.name)}`,
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
      slice.command ? `command ${humanize(slice.command.name)}` : undefined,
      slice.event ? `event ${humanize(slice.event.name)}` : undefined,
      slice.resultingState ? `state ${humanize(slice.resultingState)}` : undefined,
      slice.readModelNames.length ? `readmodel ${slice.readModelNames.map(humanize).join(', ')}` : undefined
    ].filter(Boolean).join('; ') || (zh ? 'slice 语义' : 'slice semantics')
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
    slice.startsLifecycle ? `${zh ? '启动生命周期' : 'Starts lifecycle'} ${humanize(slice.aggregate)}` : undefined,
    slice.event ? `${zh ? '产生事件' : 'Produces'} ${humanize(slice.event.name)}` : undefined,
    slice.resultingState ? `${zh ? '状态变为' : 'State becomes'} ${humanize(slice.resultingState)}` : undefined,
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
  const specificationSummary = question.match(/^(.+) has (\d+) operations without explicit specifications: (.+)\.$/);
  if (specificationSummary) {
    const examples = specificationSummary[3].replace(/ and (\d+) more$/, '，另有 $1 个');
    return `${specificationSummary[1]} 有 ${specificationSummary[2]} 个操作尚未定义明确的 specification：${examples}。`;
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
