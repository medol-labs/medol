import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import {
  extractDocumentSourceRefs,
  findDocumentSourceLine,
  hashMedolSource,
  mergeGeneratedDocument,
  parseDocumentMarkdownSections
} from '../features/documentation/documentReferences';

const databasePath = `/private/tmp/medol-documents-${process.pid}.sqlite`;
const workspaceDatabasePath = `/private/tmp/medol-workspaces-${process.pid}.sqlite`;
process.env.MEDOL_DOCUMENT_DB_PATH = databasePath;
process.env.MEDOL_DB_PATH = workspaceDatabasePath;

const repository = await import('./modelingDocumentRepository');
const workspaceRepository = await import('./modelingWorkspaceRepository');
const { documentDatabase } = await import('./documentDatabase');

test.after(() => {
  for (const database of [databasePath, workspaceDatabasePath]) {
    for (const suffix of ['', '-shm', '-wal']) {
      const path = `${database}${suffix}`;
      if (existsSync(path)) unlinkSync(path);
    }
  }
});

test('creates, lists, updates, reads, and deletes modeling documents', () => {
  const created = repository.createModelingDocument({
    workspaceId: 'workspace-1',
    title: 'Orders PRD',
    kind: 'prd',
    language: 'en',
    sourceHash: 'fnv1a-orders',
    markdown: [
      '# Orders',
      '',
      '<!-- em:section id="prd.section.slice.CreateOrder" source="domain/Orders/context/Sales/aggregate/Order/slice/CreateOrder" -->',
      '## Create Order'
    ].join('\n')
  });

  const listed = repository.listModelingDocuments('workspace-1');
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0].sourceRefs, [
    'domain/Orders/context/Sales/aggregate/Order/slice/CreateOrder'
  ]);
  assert.equal(listed[0].sourceHash, 'fnv1a-orders');
  assert.equal(repository.listModelingDocuments('workspace-2').length, 0);
  assert.deepEqual(repository.readModelingDocument(created.id)?.sourceRefs, listed[0].sourceRefs);

  const updated = repository.updateModelingDocument(created.id, {
    title: 'Orders Product Requirements',
    markdown: '# Orders\n\nUpdated.'
  });
  assert.equal(updated?.title, 'Orders Product Requirements');
  assert.equal(updated?.markdown, '# Orders\n\nUpdated.');

  assert.equal(repository.removeModelingDocument(created.id), true);
  assert.equal(repository.readModelingDocument(created.id), undefined);
});

test('parses multi-source section markers and stable MEDOL hashes', () => {
  const markdown = [
    '# Database',
    '',
    '<!-- em:section id="database.readmodel.Orders" sources="readmodel/orders slice/orders" -->',
    '## Orders'
  ].join('\n');

  assert.deepEqual(extractDocumentSourceRefs(markdown), [
    'readmodel/orders',
    'slice/orders'
  ]);
  assert.equal(findDocumentSourceLine(markdown, 'slice/orders'), 3);
  assert.deepEqual(
    parseDocumentMarkdownSections(markdown).map(({ id, startLine, endLine }) => ({
      id,
      startLine,
      endLine
    })),
    [
      { id: 'document.preamble', startLine: 1, endLine: 2 },
      { id: 'database.readmodel.Orders', startLine: 3, endLine: 4 }
    ]
  );
  assert.equal(hashMedolSource('domain Orders {}'), hashMedolSource('domain Orders {}'));
  assert.notEqual(hashMedolSource('domain Orders {}'), hashMedolSource('domain Sales {}'));
});

test('incrementally updates generated sections while preserving manual edits', () => {
  const baseline = [
    '# Orders',
    '',
    '<!-- em:section id="orders.create" source="slice/create" -->',
    '## Create Order',
    '',
    'Generated v1.',
    '',
    '<!-- em:section id="orders.list" source="slice/list" -->',
    '## Orders',
    '',
    'List v1.'
  ].join('\n');
  const current = baseline.replace('Generated v1.', 'Manually edited acceptance notes.');
  const next = baseline
    .replace('Generated v1.', 'Generated v2.')
    .replace('List v1.', 'List v2.')
    .concat('\n\n<!-- em:section id="orders.cancel" source="slice/cancel" -->\n## Cancel Order');

  const merged = mergeGeneratedDocument(current, baseline, next);

  assert.match(merged.markdown, /Manually edited acceptance notes/);
  assert.match(merged.markdown, /List v2/);
  assert.match(merged.markdown, /Cancel Order/);
  assert.equal(merged.preserved, 1);
  assert.equal(merged.updated, 1);
  assert.equal(merged.added, 1);
});

test('regeneration updates the existing document instead of creating a duplicate', () => {
  const first = repository.createModelingDocument({
    workspaceId: 'incremental-workspace',
    title: 'Orders PRD',
    kind: 'prd',
    language: 'en',
    sourceHash: 'v1',
    markdown: '# Orders\n\n<!-- em:section id="orders" source="slice/orders" -->\n## Orders\n\nVersion one.'
  });
  repository.updateModelingDocument(first.id, {
    markdown: first.markdown.replace('Version one.', 'Manual notes.')
  });
  const regenerated = repository.createModelingDocument({
    workspaceId: 'incremental-workspace',
    title: 'Orders PRD',
    kind: 'prd',
    language: 'en',
    sourceHash: 'v2',
    markdown: '# Orders\n\n<!-- em:section id="orders" source="slice/orders" -->\n## Orders\n\nVersion two.'
  });

  assert.equal(regenerated.id, first.id);
  assert.equal(repository.listModelingDocuments('incremental-workspace').length, 1);
  assert.match(regenerated.markdown, /Manual notes/);
  assert.equal(regenerated.sourceHash, 'v2');
  assert.equal(regenerated.mergeSummary?.preserved, 1);
});

test('adds an incremental document version history page for workspace DSL versions', () => {
  const initialDsl = `
domain Versioned {
  context Sales {
    aggregate Order {
      slice CreateOrder {
        command CreateOrder
        event OrderCreated
      }
    }
  }
}`;
  const nextDsl = initialDsl.replace(
    'event OrderCreated',
    'event OrderCreated\n        readmodel OrderList'
  );
  const workspace = workspaceRepository.createModelingWorkspace({
    name: 'Versioned documents',
    dsl: initialDsl
  });
  const first = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Versioned PRD',
    kind: 'prd',
    language: 'zh-CN',
    sourceHash: hashMedolSource(initialDsl),
    markdown: [
      '# Versioned PRD',
      '',
      '<!-- em:section id="prd.section.slice.CreateOrder" source="slice/create" -->',
      '## Create Order',
      '',
      'Version one.'
    ].join('\n')
  });

  assert.match(first.markdown, /## 版本变更记录/);
  assert.match(first.markdown, /## 目录/);
  assert.match(first.markdown, /\| 文档版本 \| 生成时间 \| 变更说明 \|/);
  assert.match(first.markdown, /\| v1\.0\.0 \| .+ \| Initial version \|/);
  assert.doesNotMatch(first.markdown, /DSL 版本|源模型哈希|fnv1a-/);
  assert.match(first.markdown, /<!-- em:section id="document\.version-history" -->\n# Versioned PRD\n\n## 版本变更记录/);
  assert.match(first.markdown, /## 版本变更记录[\s\S]+<!-- medol:pagebreak -->[\s\S]+<!-- em:section id="document\.toc" -->\n## 目录\n\n- \[一、Create Order\/V-PRD-CO\]\(#v-prd-co\)[\s\S]+<!-- medol:pagebreak -->[\s\S]+<!-- em:section id="document\.body" -->\n<!-- em:section id="prd\.section\.slice\.CreateOrder" source="slice\/create" -->\n## 一、Create Order\/V-PRD-CO/);
  assert.doesNotMatch(first.markdown, /\[TOC\]/);
  assert.doesNotMatch(first.markdown, /page-break-before/);
  assert.equal((first.markdown.match(/^# Versioned PRD$/gm) ?? []).length, 1);
  assert.equal((first.markdown.match(/^# /gm) ?? []).length, 1);

  const secondVersion = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    message: 'Add order list read model',
    dsl: nextDsl
  })?.version;
  assert.ok(secondVersion);
  const regenerated = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Versioned PRD',
    kind: 'prd',
    language: 'zh-CN',
    sourceHash: hashMedolSource(nextDsl),
    markdown: [
      '# Versioned PRD',
      '',
      '<!-- em:section id="prd.section.slice.CreateOrder" source="slice/create" -->',
      '## Create Order',
      '',
      'Version two.'
    ].join('\n')
  });

  assert.equal(regenerated.id, first.id);
  assert.equal(repository.listModelingDocuments(workspace.id).length, 1);
  assert.match(regenerated.markdown, /\| v1\.0\.0 \| .+ \| Initial version \|/);
  assert.match(regenerated.markdown, /\| v2\.0\.0 \| .+ \| Add order list read model \|/);
  assert.match(regenerated.markdown, /Add order list read model/);
  assert.equal((regenerated.markdown.match(/## 版本变更记录/g) ?? []).length, 1);
  assert.equal((regenerated.markdown.match(/## 目录/g) ?? []).length, 1);
  assert.equal((regenerated.markdown.match(/document\.toc/g) ?? []).length, 1);
  assert.doesNotMatch(regenerated.markdown, /DSL 版本|源模型哈希|fnv1a-/);
  assert.match(regenerated.markdown, /<!-- em:section id="document\.version-history" -->\n# Versioned PRD\n\n## 版本变更记录/);
  assert.equal((regenerated.markdown.match(/^# Versioned PRD$/gm) ?? []).length, 1);
  assert.equal((regenerated.markdown.match(/^# /gm) ?? []).length, 1);

  const sameVersion = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Versioned PRD',
    kind: 'prd',
    language: 'zh-CN',
    sourceHash: hashMedolSource(nextDsl),
    markdown: regenerated.markdown
  });
  assert.equal((sameVersion.markdown.match(/\| v2\.0\.0 \| .+ \| Add order list read model \|/g) ?? []).length, 1);
});

test('backfills source references for previously generated documents', () => {
  const workspace = workspaceRepository.createModelingWorkspace({
    name: 'Legacy documents',
    dsl: `
domain Orders {
  context Sales {
    slice CreateOrder {
      command CreateOrder
      event OrderCreated
    }
    concept Order {
      slice CreateOrder
    }
  }
}`
  });
  const created = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Orders Software Design',
    kind: 'software-design',
    language: 'en',
    markdown: '# Orders Software Design\n\n## Aggregate Design\n\n### Order\n\nCapabilities.'
  });

  assert.deepEqual(repository.readModelingDocument(created.id)?.sourceRefs, [
    'domain/Orders/context/Sales/concept/Order'
  ]);
  assert.match(
    repository.readModelingDocument(created.id)?.markdown ?? '',
    /em:section id="software\.aggregate\.Order"/
  );
});

test('backfills version history for existing generated documents', () => {
  const dsl = `
domain Orders {
  context Sales {
    slice CreateOrder {
      command CreateOrder
      event OrderCreated
    }
  }
}`;
  const workspace = workspaceRepository.createModelingWorkspace({
    name: 'Legacy version history',
    dsl
  });
  const legacyMarkdown = [
    '# Orders PRD',
    '',
    '<!-- em:section id="prd.section.slice.CreateOrder" source="domain/Orders/context/Sales/slice/CreateOrder" -->',
    '## Create Order',
    '',
    'Legacy content.'
  ].join('\n');
  const created = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Orders PRD',
    kind: 'prd',
    language: 'zh-CN',
    sourceHash: hashMedolSource(dsl),
    markdown: legacyMarkdown
  });

  documentDatabase.prepare('DELETE FROM modeling_document_versions WHERE document_id = ?')
    .run(created.id);
  documentDatabase.prepare(`
    UPDATE modeling_documents
    SET markdown = ?, generated_markdown = ?
    WHERE id = ?
  `).run(legacyMarkdown, legacyMarkdown, created.id);

  const backfilled = repository.readModelingDocument(created.id);
  assert.ok(backfilled);
  assert.match(backfilled.markdown, /## 版本变更记录/);
  assert.match(backfilled.markdown, /## 目录/);
  assert.match(backfilled.markdown, /\| v1\.0\.0 \| .+ \| Initial version \|/);
  assert.match(backfilled.markdown, /Initial version/);
  assert.doesNotMatch(backfilled.markdown, /DSL 版本|源模型哈希|fnv1a-/);
  assert.match(backfilled.markdown, /<!-- em:section id="document\.version-history" -->\n# Orders PRD\n\n## 版本变更记录/);
  assert.equal((backfilled.markdown.match(/^# Orders PRD$/gm) ?? []).length, 1);
  assert.equal((backfilled.markdown.match(/^# /gm) ?? []).length, 1);

  const versionRows = documentDatabase.prepare(`
    SELECT document_id
    FROM modeling_document_versions
    WHERE document_id = ?
  `).all(created.id);
  assert.equal(versionRows.length, 1);
});

test('does not add document version history to model translation catalogs', () => {
  const created = repository.createModelingDocument({
    workspaceId: 'translation-workspace',
    title: 'Model translations',
    kind: 'model-translations',
    language: 'zh-CN',
    sourceHash: 'fnv1a-translations',
    markdown: [
      '# 模型翻译',
      '',
      '<!-- em:section id="model-translations.section.catalog" source="translation/RegisterAccount" -->',
      '## 翻译表'
    ].join('\n')
  });

  assert.doesNotMatch(created.markdown, /document\.version-history|版本变更记录/);
  assert.equal(
    documentDatabase.prepare(`
      SELECT COUNT(*) AS count
      FROM modeling_document_versions
      WHERE document_id = ?
    `).get(created.id).count,
    0
  );
});
