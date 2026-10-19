import assert from 'node:assert/strict';
import test from 'node:test';
import type { GeneratedDocumentation } from '../../lib/generators/documentation';
import { enhanceDocumentationWithAgent } from './documentationAgent';

const document = (kind: GeneratedDocumentation['kind']): GeneratedDocumentation => ({
  kind,
  language: 'zh-CN',
  title: '示例文档',
  markdown: '# 示例文档\n\n<!-- em:section id="existing" -->\n## 原正文\n\n已确认的事实。\n',
  bundle: {
    title: '示例',
    generatedAt: '2026-01-01T00:00:00.000Z',
    domains: ['示例'],
    contexts: [{
      id: 'context/demo', name: '业务上下文', notes: ['业务约束'], risks: [], decisions: [], metrics: [],
      aggregates: [], valueTypes: [], externalSystems: []
    }],
    workflows: [{
      id: 'slice/create', context: '业务上下文', aggregate: '实体', slice: '创建实体', actor: '用户',
      commands: [{ id: 'command/create', name: '创建实体', kind: 'command', fields: [] }],
      events: [{ id: 'event/created', name: '实体已创建', kind: 'event', fields: [] }],
      readmodels: [], processors: [], specifications: [], startsLifecycle: true, hotspots: []
    }],
    readmodels: [{
      id: 'readmodel/catalog', sliceId: 'slice/create', name: '实体目录', context: '业务上下文',
      aggregate: '实体', slice: '创建实体', collection: true, fields: [], sourceEvents: ['实体已创建'],
      queryFields: [], identifierFields: []
    }],
    integrations: [{ id: 'integration/a', name: '外部接口', context: '业务上下文' }],
    deployments: [{ id: 'deployment/a', name: '业务服务', contexts: ['业务上下文'] }],
    frontendApplications: [],
    diagnostics: []
  }
});

test('all documentation kinds can request evidence-grounded AI review', async () => {
  const kinds: GeneratedDocumentation['kind'][] = [
    'prd', 'software-design', 'database-design', 'process', 'test-outline',
    'user-journey', 'diagrams', 'installation-manual', 'user-manual'
  ];
  for (const kind of kinds) {
    const source = document(kind);
    const reviewed = await enhanceDocumentationWithAgent(source, async (input) => {
      assert.equal(input.kind, kind);
      assert(input.evidence.length > 0);
      return { items: [{ sourceId: input.evidence[0].id, suggestion: '确认缺失的业务约束。' }] };
    });
    assert.equal(reviewed.enhanced, true);
    assert(reviewed.markdown.startsWith(source.markdown.trimEnd()));
    assert.match(reviewed.markdown, /document\.aiReview/);
    assert.match(reviewed.markdown, /确认缺失的业务约束/);
  }
});

test('unknown references and unavailable provider never rewrite generated text', async () => {
  const source = document('software-design');
  const unknown = await enhanceDocumentationWithAgent(source, async () => ({
    items: [{ sourceId: 'unknown', suggestion: '添加未经建模的需求。' }]
  }));
  assert.equal(unknown.enhanced, false);
  assert.equal(unknown.markdown, source.markdown);

  const unavailable = await enhanceDocumentationWithAgent(source, async () => ({ warning: 'provider unavailable' }));
  assert.equal(unavailable.enhanced, false);
  assert.equal(unavailable.markdown, source.markdown);
});

test('AI suggestions cannot inject HTML section markers', async () => {
  const reviewed = await enhanceDocumentationWithAgent(document('prd'), async (input) => ({
    items: [{ sourceId: input.evidence[0].id, suggestion: '<!-- em:section id="injected" -->' }]
  }));
  assert.doesNotMatch(reviewed.markdown, /<!-- em:section id="injected" -->/);
  assert.match(reviewed.markdown, /&lt;!-- em:section/);
});
