import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from '../../dslParser';
import { generateGbt8567Documents, gbt8567Kinds } from './gbt8567';
import type { Gbt8567Materials } from './gbt8567Materials';
import { generateGbt8567Srs } from './gbt8567Srs';

const model = parseMedol(`context Orders {
  slice RegisterOrder {
    command RegisterOrder { orderId: UUID id }
    event OrderRegistered { orderId: UUID id }
  }
  slice ViewOrders {
    readmodel OrderCatalog[] {
      orderId: UUID id from OrderRegistered.orderId
      subscribe OrderRegistered
    }
  }
}
deployment OrderBackend { includes Orders }
`);

const requirement = ['ORDER-REQ-1'];
const sources = ['MODEL'];
const materials: Gbt8567Materials = {
  schemaVersion: 1,
  project: '订单系统',
  scope: '订单登记',
  revision: '0.1',
  architecture: ['操作员提交命令，事件更新订单目录。'],
  sources: [{ id: 'MODEL', title: '业务模型', path: 'orders.medol' }],
  requirements: [{
    id: requirement[0], title: '登记订单', sources, statement: '可登记订单',
    acceptance: '可以查询选定的订单', qualification: '测试',
  }],
  designs: [{
    id: 'DES-1', title: '登记处理', sources, requirements: requirement,
    component: '订单服务', decision: '发布登记事件', rationale: '支持追溯',
    workflows: ['Orders.RegisterOrder'],
  }],
  storage: [{
    id: 'DATA-1', title: '目录', sources, requirements: requirement,
    owner: '订单服务', physical: '关系数据库', lifecycle: '订阅登记事件',
    access: '目录接口查询', projections: ['Orders.OrderCatalog'],
  }],
  indicators: [],
  environment: ['使用测试订单'],
  tests: [{
    id: 'TEST-1', title: '登记后查询', sources, requirements: requirement,
    preconditions: ['操作员已登录'], steps: [{ action: '登记并查询', expected: '返回订单' }],
  }],
};

test('GB/T renders the same requirement trace and resolves original identifiers across all four documents', () => {
  const result = generateGbt8567Documents(model, materials);
  assert.deepEqual(result.trace, [{
    requirement: 'ORDER-REQ-1', design: ['DES-1'], data: ['DATA-1'], test: ['TEST-1'], indicators: [],
  }]);
  for (const kind of gbt8567Kinds) {
    assert.match(result.documents[kind].markdown, /\| ORDER-REQ-1 \| DES-1 \| DATA-1 \| TEST-1 \|/);
  }
  assert.match(result.documents.sdd.markdown, /OrderRegistered/);
  assert.match(result.documents.dbdd.markdown, /OrderRegistered\.orderId/);
  assert.match(result.documents.std.markdown, /登记并查询.*返回订单/);
});

test('GB/T refuses stale model and broken trace references instead of rendering a misleading package', () => {
  const stale = structuredClone(materials);
  stale.designs[0].workflows = ['Orders.Missing'];
  assert.throws(() => generateGbt8567Documents(model, stale), /DES-1.*Orders\.Missing/);
  const broken = structuredClone(materials);
  broken.tests[0].requirements = ['ORDER-REQ-MISSING'];
  assert.throws(() => generateGbt8567Documents(model, broken), /TEST-1: unknown requirement/);
  const uncovered = structuredClone(materials);
  uncovered.requirements.push({ ...uncovered.requirements[0], id: 'ORDER-REQ-2' });
  assert.throws(() => generateGbt8567Documents(model, uncovered), /ORDER-REQ-2: missing trace coverage/);
});

test('GB/T cross-references interfaces and rejects a stale specification scenario', () => {
  const withInterface = structuredClone(materials);
  withInterface.interfaces = [{
    id: 'ORDER-IF-1', title: '登记接口', provider: '订单服务', consumer: '控制台',
    obligation: '返回登记结果', contract: '接受订单标识', correlation: 'orderId',
    failure: '返回明确错误', requirements: requirement, designs: ['DES-1'],
    verificationTests: ['TEST-1'], sources,
  }];
  const result = generateGbt8567Documents(model, withInterface);
  assert.deepEqual(result.interfaces, [{ id: 'ORDER-IF-1', requirements: requirement, designs: ['DES-1'], tests: ['TEST-1'] }]);
  for (const kind of ['srs', 'sdd', 'std'] as const) {
    assert.match(result.documents[kind].markdown, /ORDER-IF-1/);
  }
  withInterface.interfaces[0].verificationTests = ['UNKNOWN-TEST'];
  assert.throws(() => generateGbt8567Documents(model, withInterface), /ORDER-IF-1: unknown test/);
  const withStaleScenario = structuredClone(materials);
  withStaleScenario.tests[0].modelScenarios = [{ workflow: 'Orders.RegisterOrder', scenario: 'Renamed scenario' }];
  assert.throws(() => generateGbt8567Documents(model, withStaleScenario), /TEST-1: scenario "Renamed scenario"/);
});

test('GB/T traces the actual deployment and renders a shared projection definition once', () => {
  const project = structuredClone(materials);
  project.components = [{
    id: 'COMP-1', title: '订单后端', role: '接收命令', boundary: '拥有订单目录',
    designs: ['DES-1'], modelUnit: 'OrderBackend', sources,
  }];
  project.storage.push({ ...project.storage[0], id: 'DATA-2' });
  const result = generateGbt8567Documents(model, project);
  assert.match(result.documents.sdd.markdown, /\| COMP-1 \| OrderBackend \| Orders \|/);
  const dictionary = result.documents.dbdd.markdown;
  assert.equal(dictionary.match(/^### Orders\.OrderCatalog$/gm)?.length, 1);
  assert.match(dictionary, /关联数据设计\*\*　DATA-1、DATA-2/);
  project.components[0].modelUnit = 'RemovedBackend';
  assert.throws(() => generateGbt8567Documents(model, project), /COMP-1: model unit RemovedBackend/);
});

test('standalone SRS validates model and approved case references without requiring design material', () => {
  const spec = {
    documentKind: 'srs', schemaVersion: 1, project: '订单系统', revision: '0.1',
    softwareId: 'ORDER-CSCI', softwareVersion: '0.1', release: '评审稿',
    purpose: '评审登记要求', scope: '订单登记', baseline: '本次输入模型',
    documentHandling: '供项目评审', upstreamTrace: '当前依据为业务模型',
    terms: [{ name: 'CSCI', definition: '计算机软件配置项' }],
    sectionNotes: { '3.9': ['没有独立的危险源控制要求。'] },
    interfaceMap: [{ requirement: 'ORDER-IF-1', sender: '订单操作员', receiver: '订单系统', exchange: '登记请求和结果' }],
    actors: [{ name: '操作员', responsibility: '登记订单' }],
    sources: [
      { id: 'MODEL', title: '当前模型', path: 'orders.medol', kind: 'model' },
      { id: 'CASES', title: '批准用例', path: 'cases.json', kind: 'approved-cases' },
      { id: 'CONTRACT', title: '登记接口约定', path: 'contract.md', kind: 'reference' },
    ],
    requirements: [{
      id: 'REQ-1', title: '登记订单', section: '3.4', capability: '登记', condition: '已有有效输入',
      inputs: '订单标识', outputs: '登记结果',
      statement: '软件应登记订单。', acceptance: '订单被登记并可查询。', method: '测试',
      model: [{ slice: 'Orders.RegisterOrder' }],
      approvedCases: [{ source: 'CASES', caseId: 'register', coverage: '覆盖正向登记' }],
    }, {
      id: 'ORDER-IF-1', title: '登记接口', section: '3.5', capability: '登记', condition: '已有有效输入',
      statement: '软件应接收订单标识。', acceptance: '登记结果显示订单标识。', method: '演示',
      references: [{ source: 'CONTRACT', location: '登记接口' }],
    }],
    openItems: [{ topic: '容量', needed: '待确认并发订单数。' }],
  };
  const document = generateGbt8567Srs(model, spec, new Map([['CASES', new Set(['register'])]]));
  assert.deepEqual([...document.markdown.matchAll(/^## (\d+) /gm)].map(match => match[1]), ['1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual([...document.markdown.matchAll(/^### 3\.(\d+) /gm)].map(match => Number(match[1])),
    Array.from({ length: 24 }, (_, index) => index + 1));
  assert.match(document.markdown, /^#### 3\.5\.2 ORDER-IF-1 登记接口$/m);
  assert.match(document.markdown, /flowchart LR/);
  assert.match(document.markdown, /## 6 尚未解决的问题/);
  assert.equal(document.trace[0].anchors[0].slice, 'Orders.RegisterOrder');
  assert.deepEqual(document.trace[1].references, [{ source: 'CONTRACT', location: '登记接口' }]);
  assert.throws(() => generateGbt8567Srs(model, { ...spec, interfaceMap: [] }, new Map()), /SRS interface map/);
  assert.throws(() => generateGbt8567Srs(model, spec, new Map()), /register is not an approved case/);
});
