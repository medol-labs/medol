import { allContextSlices } from '../../dslParser';
import type { EmModel } from '../../model';
import { buildDocumentationBundle } from './documentationGenerator';
import { gbt8567MaterialsSchema } from './gbt8567Materials';

export const GBT8567_PROFILE = 'gbt-8567-2006';
export const gbt8567Kinds = ['srs', 'sdd', 'dbdd', 'std'] as const;
export type Gbt8567Kind = typeof gbt8567Kinds[number];

const definitions = {
  srs: ['软件需求规格说明', '7.11'],
  sdd: ['软件（结构）设计说明', '7.13'],
  dbdd: ['数据库（顶层）设计说明', '7.14'],
  std: ['软件测试说明', '7.15'],
} as const;

export function generateGbt8567Documents(model: EmModel, input: unknown) {
  if (model.diagnostics.length) {
    throw new Error(`Resolve model diagnostics before generating the GB/T package:\n${model.diagnostics.join('\n')}`);
  }
  const materials = gbt8567MaterialsSchema.parse(input);
  const bundle = buildDocumentationBundle(model);
  const interfaces = materials.interfaces ?? [];
  const components = materials.components ?? [];
  const slices = new Map(model.contexts.flatMap(context => allContextSlices(context).map(slice => [slice.id, slice] as const)));

  const workflowCandidates = new Map<string, typeof bundle.workflows>();
  for (const workflow of bundle.workflows) {
    const reference = `${workflow.context}.${workflow.slice}`;
    workflowCandidates.set(reference, [...(workflowCandidates.get(reference) ?? []), workflow]);
    const qualified = `${workflow.context}.${workflow.aggregate}.${workflow.slice}`;
    if (workflow.aggregate !== 'Context') {
      workflowCandidates.set(qualified, [...(workflowCandidates.get(qualified) ?? []), workflow]);
    }
  }
  const projectionCandidates = new Map<string, typeof bundle.readmodels>();
  for (const projection of bundle.readmodels) {
    for (const reference of [
      `${projection.context}.${projection.name}`,
      `${projection.context}.${projection.slice}.${projection.name}`,
    ]) {
      projectionCandidates.set(reference, [...(projectionCandidates.get(reference) ?? []), projection]);
    }
  }
  const eligibility = new Map(model.contexts.flatMap(context => allContextSlices(context).flatMap(slice =>
    slice.elements.filter(element => element.eligibility?.length).map(element => [element.id, element.eligibility!] as const)
  )));

  function resolve<T>(index: Map<string, T[]>, reference: string, entry: string): T {
    const matches = index.get(reference) ?? [];
    if (matches.length !== 1) throw new Error(`${entry}: model reference ${reference} must match exactly one element (found ${matches.length})`);
    return matches[0];
  }

  const ids = new Set<string>();
  const groups = [materials.sources, materials.requirements, materials.designs, materials.storage, materials.tests, materials.indicators, interfaces, components];
  for (const group of groups) {
    for (const entry of group) {
      if (ids.has(entry.id)) throw new Error(`Duplicate document identifier: ${entry.id}`);
      ids.add(entry.id);
    }
  }
  const sourceIds = new Set(materials.sources.map(source => source.id));
  const requirementIds = new Set(materials.requirements.map(requirement => requirement.id));
  for (const group of groups.slice(1)) {
    for (const entry of group) {
      if ('sources' in entry) checkRefs(entry.id, entry.sources, sourceIds, 'source');
      if ('requirements' in entry) checkRefs(entry.id, entry.requirements, requirementIds, 'requirement');
    }
  }
  const testsById = new Map(materials.tests.map(test => [test.id, test]));
  for (const entry of [...materials.indicators, ...interfaces]) {
    checkRefs(entry.id, entry.verificationTests, new Set(testsById.keys()), 'test');
    const checkedRequirements = new Set(entry.verificationTests.flatMap(id => testsById.get(id)!.requirements));
    checkRefs(entry.id, entry.requirements, checkedRequirements, 'requirement covered by its verification tests');
  }
  const designsById = new Map(materials.designs.map(design => [design.id, design]));
  const modelUnits = [...bundle.deployments, ...bundle.frontendApplications];
  const componentUnits = new Map(components.flatMap(component => {
    checkRefs(component.id, component.designs, new Set(designsById.keys()), 'design');
    if (!component.modelUnit) return [];
    const matches = modelUnits.filter(unit => unit.name === component.modelUnit);
    if (matches.length !== 1) throw new Error(`${component.id}: model unit ${component.modelUnit} must match exactly one deployment or frontend`);
    return [[component.id, matches[0]] as const];
  }));
  for (const boundary of interfaces) {
    checkRefs(boundary.id, boundary.designs, new Set(designsById.keys()), 'design');
    const implementedRequirements = new Set(boundary.designs.flatMap(id => designsById.get(id)!.requirements));
    checkRefs(boundary.id, boundary.requirements, implementedRequirements, 'requirement covered by its designs');
  }

  const designs = materials.designs.map(entry => ({
    ...entry,
    model: entry.workflows.map(reference => ({ reference, workflow: resolve(workflowCandidates, reference, entry.id) })),
  }));
  const storage = materials.storage.map(entry => ({
    ...entry,
    model: entry.projections.map(reference => ({ reference, projection: resolve(projectionCandidates, reference, entry.id) })),
  }));
  const projections = new Map<string, {
    reference: string;
    projection: typeof bundle.readmodels[number];
    dataEntries: string[];
  }>();
  for (const entry of storage) {
    for (const binding of entry.model) {
      const existing = projections.get(binding.projection.id);
      if (existing) {
        if (!existing.dataEntries.includes(entry.id)) existing.dataEntries.push(entry.id);
      } else {
        projections.set(binding.projection.id, { ...binding, dataEntries: [entry.id] });
      }
    }
  }
  const tests = materials.tests.map(entry => ({
    ...entry,
    scenarios: (entry.modelScenarios ?? []).map(({ workflow: reference, scenario }) => {
      const workflow = resolve(workflowCandidates, reference, entry.id);
      const matches = workflow.specifications.filter(specification => specification.name === scenario);
      if (matches.length !== 1) throw new Error(`${entry.id}: scenario "${scenario}" must match exactly one declaration in ${reference}`);
      return { reference, workflowId: workflow.id, scenario: matches[0] };
    }),
  }));
  const linked = (entries: Array<{ id: string; requirements: string[] }>, id: string) =>
    entries.filter(entry => entry.requirements.includes(id)).map(entry => entry.id);

  const trace = materials.requirements.map(requirement => {
    const row = {
      requirement: requirement.id,
      design: linked(designs, requirement.id),
      data: linked(storage, requirement.id),
      test: linked(materials.tests, requirement.id),
      indicators: linked(materials.indicators, requirement.id),
    };
    const missing = (['design', 'data', 'test'] as const).filter(key => !row[key].length);
    if (missing.length) throw new Error(`${requirement.id}: missing trace coverage for ${missing.join(', ')}`);
    return row;
  });

  const traceTable = table(
    ['需求（SRS）', '设计（SDD）', '数据（DBDD）', '用例（STD）', '指标'],
    trace.map(row => [row.requirement, refs(row.design), refs(row.data), refs(row.test), refs(row.indicators)]),
  );
  const sourceTable = table(['编号', '依据', '项目文件'], materials.sources.map(source => [source.id, source.title, source.path]));

  const documents: Record<Gbt8567Kind, string> = {
    srs: [
      '## 3 软件需求',
      ...materials.requirements.flatMap(entry => [
        heading(entry), label('需求', entry.statement), label('验收条件', entry.acceptance), sourceLine(entry.sources),
      ]),
      ...section('### 外部与跨组件接口需求', interfaces.map(entry => [
        `${entry.id} ${entry.title}`, entry.consumer, entry.provider, entry.obligation, refs(entry.requirements),
      ]), ['接口', '发起方', '提供方', '要求与边界', '需求编号']),
      '## 4 合格性规定',
      table(['需求编号', '验证方法', '验收条件'], materials.requirements.map(entry => [entry.id, entry.qualification, entry.acceptance])),
      '## 5 需求可追踪性', traceTable,
    ].join('\n\n'),
    sdd: [
      '## 3 软件设计决策',
      ...designs.flatMap(entry => [heading(entry), label('设计', entry.decision), label('设计依据与权衡', entry.rationale), sourceLine(entry.sources)]),
      '## 4 软件体系结构设计',
      '### 4.1 组件协作与主流程',
      materials.architecture.map((step, index) => `${index + 1}. ${escapeText(step)}`).join('\n'),
      '### 4.2 组件职责',
      ...(components.length ? [table(
        ['组件', '职责', '边界', '模型部署或前端', '详细设计', '依据'],
        components.map(component => [`${component.id} ${component.title}`, component.role, component.boundary,
          component.modelUnit ?? '—', refs(component.designs), refs(component.sources)]),
      ), ...section('**模型部署与上下文分配**', components.flatMap(component => {
        const unit = componentUnits.get(component.id);
        if (!unit) return [];
        const contexts = 'contexts' in unit
          ? unit.contexts
          : unit.includes.map(item => [item.context, item.slice, item.backend].filter(Boolean).join(' / '));
        return [[component.id, unit.name, refs(contexts)]];
      }), ['组件编号', '模型部署或前端', '上下文及后端分配'])] : [table(['组件', '职责对应设计', '关联需求'], [...new Set(designs.map(entry => entry.component))].map(component => {
        const entries = designs.filter(entry => entry.component === component);
        return [component, refs(entries.map(entry => entry.id)), refs([...new Set(entries.flatMap(entry => entry.requirements))])];
      }))]),
      ...section('### 4.3 接口设计', interfaces.map(entry => [
        `${entry.id} ${entry.title}`, entry.contract, entry.correlation, entry.failure, refs(entry.designs), refs(entry.verificationTests), refs(entry.sources),
      ]), ['接口', '交互及载荷', '关联键', '失败处理', '设计编号', '用例编号', '依据']),
      '## 5 软件详细设计',
      ...designs.flatMap(entry => [
        heading(entry), label('组件', entry.component), label('关联需求', refs(entry.requirements)),
        ...(entry.details ?? []).flatMap(detail => [label('设计要点', detail.title), bullets(detail.points)]),
        ...section('**模型行为与生命周期**', entry.model.map(({ reference, workflow }) => [
          reference,
          refs(slices.get(workflow.id)?.reactions?.map(reaction => reaction.event) ?? []),
          refs(workflow.commands.map(command => command.name)),
          refs(workflow.events.map(event => event.name)),
          refs(workflow.automations?.map(rule => [rule.on, rule.condition, rule.emits].filter(Boolean).join(' → ')) ?? []),
          workflow.resultingState ?? '—',
        ]), ['模型切片', '关联的前序事件', '命令', '可能产生的事件', '自动化', '名义结果状态']),
      ]),
      ...(materials.indicators.length ? [
        '### 设计评价指标',
        '评价基准、测量方法与判据用于验证设计取舍。实际结果在相应版本的测试报告中记录。',
        table(['编号', '关联需求', '比较基准', '测量方法', '判据', '依据状态', '来源'],
          materials.indicators.map(entry => [`${entry.id} ${entry.title}`, refs(entry.requirements), entry.baseline, entry.measure, entry.criterion, entry.basis, refs(entry.sources)])),
        table(['指标编号', '验证用例'], materials.indicators.map(entry => [entry.id, refs(entry.verificationTests)])),
      ] : []),
      '## 6 需求可追踪性', traceTable,
    ].join('\n\n'),
    dbdd: [
      '## 3 数据库级设计决策',
      table(['数据编号', '数据或存储单元', '归属', '生命周期'], storage.map(entry => [entry.id, entry.title, entry.owner, entry.lifecycle])),
      '## 4 数据库详细设计',
      ...storage.flatMap(entry => [
        heading(entry), label('物理存储与部署边界', entry.physical), label('关联需求', refs(entry.requirements)), sourceLine(entry.sources),
        ...(entry.integrity ? ['**标识、约束与一致性**', bullets(entry.integrity)] : []),
        ...(entry.recovery ? [label('留存与恢复核验', entry.recovery)] : []),
        ...(entry.model.length ? [label('关联逻辑投影', refs(entry.projections))] : []),
      ]),
      '## 5 数据库访问单元',
      table(['数据编号', '访问方式及责任方', '模型投影'], storage.map(entry => [
        entry.id, entry.access,
        refs(entry.projections),
      ])),
      '## 6 需求可追踪性', traceTable,
      ...(projections.size ? [
        '## 附录 A 逻辑投影数据字典',
        ...[...projections.values()].flatMap(({ reference, projection, dataEntries }) => [
          `### ${escapeText(reference)}`, label('关联数据设计', refs(dataEntries)),
          label('事件来源', refs(projection.sourceEvents)), label('标识字段', refs(projection.identifierFields)),
          table(['字段', '模型类型', '基数', '来源'], projection.fields.map(field =>
            [field.name, field.type, field.cardinality, refs(field.mapping?.sources ?? [])])),
          ...(eligibility.get(projection.id) ?? []).map(rule => label(
            `可用条件（${rule.profile ?? '默认'}）`,
            rule.conditions.map(condition => `${condition.left} ${condition.operator} ${condition.rightReference ?? JSON.stringify(condition.right)}`).join(' && '),
          )),
        ]),
      ] : []),
    ].join('\n\n'),
    std: [
      '## 3 测试准备',
      materials.environment.map(item => `- ${escapeText(item)}`).join('\n'),
      '本文规定测试过程与预期结果。执行结果、证据及结论由软件测试报告记录。',
      '## 4 测试说明',
      ...tests.flatMap(entry => [
        heading(entry), label('关联需求', refs(entry.requirements)), sourceLine(entry.sources),
        label('关联评价指标', refs(materials.indicators.filter(indicator => indicator.verificationTests.includes(entry.id)).map(indicator => indicator.id))),
        ...(interfaces.length ? [label('关联接口', refs(interfaces.filter(boundary => boundary.verificationTests.includes(entry.id)).map(boundary => boundary.id)))] : []),
        '**前置条件**\n\n' + entry.preconditions.map(item => `- ${escapeText(item)}`).join('\n'),
        ...section('**模型规格场景**', entry.scenarios.map(({ reference, scenario }) => [
          reference, scenario.name, refs(scenario.given), scenario.when ?? '—',
          scenario.then ?? (scenario.reject ? `拒绝：${scenario.reject}` : '—'),
        ]), ['模型切片', '场景', '前序事件', '触发命令', '结果']),
        table(['序号', '操作与输入', '预期结果及判定'], entry.steps.map((step, index) => [String(index + 1), step.action, step.expected])),
        ...(entry.evidence ? ['**需留存的证据**', bullets(entry.evidence)] : []),
        ...(entry.cleanup ? [label('还原与清理', entry.cleanup)] : []),
      ]),
      '## 5 需求可追踪性', traceTable,
    ].join('\n\n'),
  };

  const published = Object.fromEntries(gbt8567Kinds.map(kind => {
    const [name, clause] = definitions[kind];
    const title = `${materials.project} ${name}`;
    const markdown = [
      `# ${escapeText(title)}`,
      `编制依据：GB/T 8567—2006 §${clause}  ｜  文档修订：${escapeText(materials.revision)}`,
      '## 1 引言', '### 1.1 标识', label('文档类型', kind.toUpperCase()),
      '### 1.2 软件与范围', escapeText(materials.scope),
      '## 2 引用文件', sourceTable, documents[kind],
    ].join('\n\n') + '\n';
    return [kind, { kind, clause, title, markdown }];
  })) as Record<Gbt8567Kind, { kind: Gbt8567Kind; clause: string; title: string; markdown: string }>;

  return {
    profile: GBT8567_PROFILE,
    documents: published,
    trace,
    indicatorTests: materials.indicators.map(entry => ({ id: entry.id, tests: entry.verificationTests })),
    interfaces: interfaces.map(entry => ({ id: entry.id, requirements: entry.requirements, designs: entry.designs, tests: entry.verificationTests })),
    modelBindings: {
      components: components.map(entry => ({ id: entry.id, designs: entry.designs,
        modelUnit: componentUnits.get(entry.id)?.name, modelId: componentUnits.get(entry.id)?.id })),
      designs: designs.map(entry => ({ id: entry.id, workflows: entry.model.map(({ reference, workflow }) => ({ reference, id: workflow.id })) })),
      data: storage.map(entry => ({ id: entry.id, projections: entry.model.map(({ reference, projection }) => ({ reference, id: projection.id })) })),
      tests: tests.filter(entry => entry.scenarios.length).map(entry => ({
        id: entry.id,
        scenarios: entry.scenarios.map(({ reference, workflowId, scenario }) => ({ reference, workflowId, name: scenario.name })),
      })),
    },
    sources: materials.sources,
  };
}

function checkRefs(entry: string, references: string[], valid: Set<string>, type: string) {
  for (const reference of references) {
    if (!valid.has(reference)) throw new Error(`${entry}: unknown ${type} ${reference}`);
  }
  if (new Set(references).size !== references.length) throw new Error(`${entry}: duplicate ${type} reference`);
}

const escapeText = (value: string) => value.replace(/[\\`*_<>\[\]|]/g, character => `\\${character}`);
const refs = (values: string[]) => values.join('、') || '—';
const heading = (entry: { id: string; title: string }) => `### ${entry.id} ${escapeText(entry.title)}`;
const label = (name: string, value: string) => `**${name}**　${escapeText(value)}`;
const sourceLine = (sources: string[]) => label('依据', refs(sources));
const table = (headers: string[], rows: string[][]) =>
  [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(escapeText).join(' | ')} |`).join('\n');
const section = (title: string, rows: string[][], headers: string[]) => rows.length ? [title, table(headers, rows)] : [];
const bullets = (values: string[]) => values.map(value => `- ${escapeText(value)}`).join('\n');
