import { z } from 'zod';
import { allContextSlices } from '../../dslParser';
import type { EmModel } from '../../model';
import { buildDocumentationBundle } from './documentationGenerator';

const line = z.string().trim().min(1).regex(/^[^\r\n]+$/);
const id = z.string().regex(/^[A-Z][A-Z0-9-]*$/);
const sections = {
  '3.1': '所需的状态和方式',
  '3.2': '需求概述',
  '3.2.1': '目标',
  '3.2.2': '运行环境',
  '3.2.3': '用户的特点',
  '3.2.4': '关键点',
  '3.2.5': '约束条件',
  '3.3': '需求规格',
  '3.3.1': '软件系统总体功能/对象结构',
  '3.3.2': '软件子系统功能/对象结构',
  '3.3.3': '描述约定',
  '3.4': 'CSCI 能力需求',
  '3.5': 'CSCI 外部接口需求',
  '3.5.1': '接口标识和接口图',
  '3.6': 'CSCI 内部接口需求',
  '3.7': 'CSCI 内部数据需求',
  '3.8': '适应性需求',
  '3.9': '保密性需求',
  '3.10': '保密性和私密性需求',
  '3.11': 'CSCI 环境需求',
  '3.12': '计算机资源需求',
  '3.12.1': '计算机硬件需求',
  '3.12.2': '计算机硬件资源利用需求',
  '3.12.3': '计算机软件需求',
  '3.12.4': '计算机通信需求',
  '3.13': '软件质量因素',
  '3.14': '设计和实现的约束',
  '3.15': '数据',
  '3.16': '操作',
  '3.17': '故障处理',
  '3.18': '算法说明',
  '3.19': '有关人员需求',
  '3.20': '有关培训需求',
  '3.21': '有关后勤需求',
  '3.22': '其他需求',
  '3.23': '包装需求',
  '3.24': '需求的优先次序和关键程度',
} as const;
type Section = keyof typeof sections;
const sectionOrder = Object.keys(sections) as Section[];
const sectionNumber = z.custom<Section>(value => typeof value === 'string' && Object.hasOwn(sections, value), 'Unknown SRS section');
const summaryOnlySections: readonly Section[] = [
  '3.2', '3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.5',
  '3.3', '3.3.1', '3.3.2', '3.3.3', '3.5.1', '3.12', '3.24',
];

const specificationSchema = z.strictObject({
  documentKind: z.literal('srs'),
  schemaVersion: z.literal(1),
  project: line,
  revision: line,
  softwareId: id,
  softwareVersion: line,
  release: line,
  purpose: line,
  scope: line,
  baseline: line,
  documentHandling: line,
  upstreamTrace: line,
  sectionNotes: z.partialRecord(sectionNumber, z.array(line).min(1)),
  terms: z.array(z.strictObject({ name: line, definition: line })).min(1),
  interfaceMap: z.array(z.strictObject({ requirement: id, sender: line, receiver: line, exchange: line })),
  actors: z.array(z.strictObject({ name: line, responsibility: line })).min(1),
  sources: z.array(z.strictObject({ id, title: line, path: line, revision: line.optional(), date: line.optional(), kind: z.enum(['model', 'approved-cases', 'reference']) })).min(1),
  requirements: z.array(z.strictObject({
    id, title: line, section: sectionNumber.refine(section => !summaryOnlySections.includes(section)), capability: line,
    inputs: line.optional(), outputs: line.optional(),
    condition: line, statement: line, acceptance: line,
    method: z.enum(['测试', '演示', '审查', '分析']),
    model: z.array(z.strictObject({ slice: line, scenario: line.optional() })).default([]),
    references: z.array(z.strictObject({ source: id, location: line })).default([]),
    approvedCases: z.array(z.strictObject({ source: id, caseId: line, coverage: line })).optional(),
  })).min(1),
  openItems: z.array(z.strictObject({ topic: line, needed: line })),
});

const escape = (value: string) => value.replace(/[\\`*_<>\[\]|]/g, character => `\\${character}`);
const row = (cells: string[]) => `| ${cells.map(escape).join(' | ')} |`;
const table = (header: string[], rows: string[][]) => [
  row(header), row(header.map(() => '---')), ...rows.map(row),
].join('\n');
const note = (title: string, value: string) => `**${title}**　${escape(value)}`;

function renderInterfaceMap(interfaces: z.infer<typeof specificationSchema>['interfaceMap']) {
  if (!interfaces.length) return ['本条未列明独立的外部接口需求。'];
  const nodes = [...new Set(interfaces.flatMap(entry => [entry.sender, entry.receiver]))];
  const nodeId = (name: string) => `E${nodes.indexOf(name) + 1}`;
  return [
    ['```mermaid', 'flowchart LR',
      ...nodes.map(name => `  ${nodeId(name)}["${name.replace(/["&#<>`]/g, character => `#${character.charCodeAt(0)};`)}"]`),
      ...interfaces.map(entry => `  ${nodeId(entry.sender)} ---|${entry.requirement}| ${nodeId(entry.receiver)}`),
      '```',
    ].join('\n'),
    table(['接口标识', '发送方', '接收方', '信息流'], interfaces.map(entry => [
      entry.requirement, entry.sender, entry.receiver, entry.exchange,
    ])),
  ];
}

export function generateGbt8567Srs(
  model: EmModel,
  input: unknown,
  approvedCases: ReadonlyMap<string, ReadonlySet<string>>,
) {
  if (model.diagnostics.length) throw new Error(`Resolve model diagnostics before generating SRS:\n${model.diagnostics.join('\n')}`);
  const spec = specificationSchema.parse(input);
  const bundle = buildDocumentationBundle(model);
  const locations = new Map(model.contexts.flatMap(context =>
    allContextSlices(context).map(slice => [slice.id, slice.sourceRange?.start.line] as const)
  ));
  const modelSources = spec.sources.filter(source => source.kind === 'model');
  if (modelSources.length !== 1) throw new Error('SRS must identify exactly one primary model source');
  const sourceById = new Map(spec.sources.map(source => [source.id, source]));
  if (sourceById.size !== spec.sources.length) throw new Error('Duplicate SRS source identifier');
  if (new Set(spec.requirements.map(entry => entry.id)).size !== spec.requirements.length) throw new Error('Duplicate SRS requirement identifier');
  const interfaceIds = new Set(spec.requirements.filter(entry => entry.section === '3.5').map(entry => entry.id));
  const mappedInterfaceIds = new Set(spec.interfaceMap.map(entry => entry.requirement));
  if (mappedInterfaceIds.size !== spec.interfaceMap.length || mappedInterfaceIds.size !== interfaceIds.size
      || [...mappedInterfaceIds].some(id => !interfaceIds.has(id))) {
    throw new Error('SRS interface map must identify each external interface requirement exactly once');
  }
  const trace = spec.requirements.map(entry => {
    if (!entry.model.length && !entry.references.length) throw new Error(`${entry.id}: missing requirement source`);
    if (entry.section === '3.4' && (!entry.inputs || !entry.outputs)) {
      throw new Error(`${entry.id}: CSCI capability must describe input and output`);
    }
    for (const reference of entry.references) {
      if (sourceById.get(reference.source)?.kind !== 'reference') {
        throw new Error(`${entry.id}: unknown reference source ${reference.source}`);
      }
    }
    const anchors = entry.model.map(reference => {
      const candidates = bundle.workflows.filter(workflow =>
        `${workflow.context}.${workflow.slice}` === reference.slice
        || `${workflow.context}.${workflow.aggregate}.${workflow.slice}` === reference.slice);
      if (candidates.length !== 1) throw new Error(`${entry.id}: unresolved or ambiguous model slice ${reference.slice}`);
      const [workflow] = candidates;
      if (reference.scenario && workflow.specifications.filter(scenario => scenario.name === reference.scenario).length !== 1) {
        throw new Error(`${entry.id}: unresolved or ambiguous scenario "${reference.scenario}" in ${reference.slice}`);
      }
      return { ...reference, modelId: workflow.id, line: locations.get(workflow.id) };
    });
    const cases = entry.approvedCases ?? [];
    for (const evidence of cases) {
      if (sourceById.get(evidence.source)?.kind !== 'approved-cases' || !approvedCases.get(evidence.source)?.has(evidence.caseId)) {
        throw new Error(`${entry.id}: ${evidence.source}/${evidence.caseId} is not an approved case`);
      }
    }
    return { requirement: entry.id, section: entry.section, anchors, references: entry.references, cases };
  });
  const title = `${spec.project} 软件需求规格说明`;
  const renderRequirement = (entry: typeof spec.requirements[number], heading: string) => [
    heading, note('适用条件', entry.condition),
    ...(entry.inputs ? [note('输入', entry.inputs)] : []),
    note('要求', entry.statement),
    ...(entry.outputs ? [note('输出', entry.outputs)] : []),
    note('合格判据', entry.acceptance),
  ];
  const externalInterfaces = spec.requirements.filter(entry => entry.section === '3.5');
  const markdown = [
    `# ${escape(title)}`,
    `编制依据为 GB/T 8567—2006 第 7.11 节。文档修订 ${escape(spec.revision)}，评审稿。`,
    '## 1 范围',
    '### 1.1 标识',
    table(['软件配置项（CSCI）', '名称', '软件版本', '发行标识'], [[spec.softwareId, spec.project, spec.softwareVersion, spec.release]]),
    '### 1.2 系统概述', escape(spec.scope),
    table(['角色', '业务职责'], spec.actors.map(actor => [actor.name, actor.responsibility])),
    '### 1.3 文档概述', escape(spec.purpose), escape(spec.documentHandling),
    '### 1.4 基线', escape(spec.baseline),
    '## 2 引用文件',
    table(['编号', '文件', '版本或修订', '日期', '来源'], [
      ['GB/T 8567—2006', '计算机软件文档编制规范', '2006 版', '2006-03-14', '国家标准正文第 7.11 节'],
      ...spec.sources.map(source => [
        source.id, source.title, source.revision ?? '随输入快照', source.date ?? '未单列', source.path,
      ]),
    ]),
    '## 3 需求',
    ...sectionOrder.flatMap(section => {
      const level = section.split('.').length + 1;
      const entries = spec.requirements.filter(entry => entry.section === section);
      const notes = spec.sectionNotes[section]?.map(escape) ?? [];
      const heading = `${'#'.repeat(level)} ${section} ${sections[section]}`;
      if (section === '3.4') {
        const groups = [...new Set(entries.map(entry => entry.capability))];
        if (!groups.length) return [heading, ...notes, '本条未列明独立的 CSCI 能力需求。'];
        return [heading, ...notes, ...groups.flatMap((group, index) => [
          `#### 3.4.${index + 1} ${escape(group)}`,
          ...entries.filter(entry => entry.capability === group).flatMap(entry =>
            renderRequirement(entry, `##### ${entry.id} ${escape(entry.title)}`)),
        ])];
      }
      if (section === '3.5') return [heading, ...notes];
      if (section === '3.5.1') return [heading, ...notes,
        ...renderInterfaceMap(spec.interfaceMap),
        ...externalInterfaces.flatMap((entry, index) =>
          renderRequirement(entry, `#### 3.5.${index + 2} ${entry.id} ${escape(entry.title)}`)),
      ];
      return [heading, ...notes, ...entries.flatMap(entry =>
        renderRequirement(entry, `${'#'.repeat(level + 1)} ${entry.id} ${escape(entry.title)}`)),
        ...(!notes.length && !entries.length && section !== '3.12' && section !== '3.2' && section !== '3.3'
          ? ['本条未列明独立需求。'] : []),
      ];
    }),
    '## 4 合格性规定',
    '测试用于对照预期采集运行结果，演示用于观察可直接操作的行为，分析用于核对计算或测量结果，审查用于检查文件、配置或代码。用例登记表示已有验证安排，执行结果由测试报告记录。',
    table(['需求', '验证方法', '已批准的项目用例及覆盖范围'], spec.requirements.map((entry, index) => [
      entry.id, entry.method,
      trace[index].cases.map(item => `${item.caseId}（${item.source}）：${item.coverage}`).join('；') || '待编制或映射验证用例',
    ])),
    '## 5 需求可追踪性',
    escape(spec.upstreamTrace),
    table(['需求', '模型依据及场景', '其他依据'], trace.map(entry => [
      entry.requirement,
      entry.anchors.map(anchor => `${modelSources[0].id} / ${anchor.slice}${anchor.line ? `（第 ${anchor.line} 行）` : ''}${anchor.scenario ? ` / ${anchor.scenario}` : ''}`).join('；') || '—',
      entry.references.map(reference => `${reference.source} / ${reference.location}`).join('；') || '—',
    ])),
    '## 6 尚未解决的问题',
    spec.openItems.length ? table(['事项', '需确认内容'], spec.openItems.map(item => [item.topic, item.needed])) : '本次评审未登记待确认事项。',
    '## 7 注解',
    table(['术语或缩写', '释义'], [...spec.terms].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .map(entry => [entry.name, entry.definition])),
  ].join('\n\n') + '\n';
  return { kind: 'srs', clause: '7.11', title, markdown, trace };
}

export { specificationSchema as gbt8567SrsSchema };
