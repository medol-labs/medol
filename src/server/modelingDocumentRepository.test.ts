import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import Database from 'better-sqlite3';
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

const legacyDatabase = new Database(databasePath);
legacyDatabase.exec(`
  CREATE TABLE modeling_document_versions (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
    title TEXT NOT NULL, kind TEXT NOT NULL, language TEXT NOT NULL,
    source_hash TEXT, workspace_version_id TEXT, workspace_version_no INTEGER,
    workspace_version_message TEXT, markdown TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO modeling_document_versions
    (id, document_id, workspace_id, title, kind, language, markdown, created_at)
  VALUES
    ('legacy-z', 'migration-document', 'migration-workspace', 'Legacy', 'prd', 'en', '# Legacy\n\nFirst.', '2026-10-21 00:00:00'),
    ('legacy-a', 'migration-document', 'migration-workspace', 'Legacy', 'prd', 'en', '# Legacy\n\nSecond.', '2026-10-21 00:00:00');
`);
legacyDatabase.close();

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

test('migrates legacy history in stable order and preserves previously unrecorded manual content', () => {
  const rows = documentDatabase.prepare(`
    SELECT id, revision_no, origin FROM modeling_document_versions
    WHERE document_id = 'migration-document' ORDER BY revision_no
  `).all();
  assert.deepEqual(rows, [
    { id: 'legacy-z', revision_no: 1, origin: 'legacy' },
    { id: 'legacy-a', revision_no: 2, origin: 'legacy' }
  ]);
  documentDatabase.prepare(`
    INSERT INTO modeling_documents (id, workspace_id, title, kind, language, markdown, generated_markdown)
    VALUES ('migration-document', 'migration-workspace', 'Legacy', 'prd', 'en', ?, ?)
  `).run('# Legacy\n\nManual before upgrade.', '# Legacy\n\nSecond.');
  const restored = repository.readModelingDocument('migration-document');
  assert.equal(restored?.revisionNo, 3);
  assert.equal(restored?.revisions?.[2].origin, 'legacy');
  assert.match(restored?.revisions?.[2].markdown ?? '', /Manual before upgrade/);
  assert.equal(repository.readModelingDocument('migration-document')?.revisionNo, 3);
  repository.removeModelingDocument('migration-document');
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

test('recovers orphan documents when workspace database was restored separately', () => {
  documentDatabase.prepare(`
    INSERT INTO modeling_documents (
      id, workspace_id, title, kind, language, markdown, generated_markdown, source_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'orphan-document-1',
    'old-workspace-id',
    'Recovered PRD',
    'prd',
    'en',
    '# Recovered PRD',
    '# Recovered PRD',
    'fnv1a-recovered'
  );
  documentDatabase.prepare(`
    INSERT INTO modeling_document_versions (
      id, document_id, workspace_id, title, kind, language, source_hash, markdown
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'orphan-document-version-1',
    'orphan-document-1',
    'old-workspace-id',
    'Recovered PRD',
    'prd',
    'en',
    'fnv1a-recovered',
    '# Recovered PRD'
  );

  const workspace = workspaceRepository.createModelingWorkspace({
    name: 'Restored workspace',
    dsl: 'domain Restored {}'
  });

  const listed = repository.listModelingDocuments(workspace.id);

  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, 'orphan-document-1');
  assert.equal(listed[0].workspaceId, workspace.id);
  assert.equal(
    documentDatabase.prepare<[string], { workspace_id: string }>('SELECT workspace_id FROM modeling_document_versions WHERE id = ?')
      .get('orphan-document-version-1')?.workspace_id,
    workspace.id
  );
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

test('tracks document versions without wrapping editable Markdown', () => {
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

  assert.match(first.markdown, /^# Versioned PRD$/m);
  assert.match(first.markdown, /<!-- em:section id="prd\.section\.slice\.CreateOrder" source="slice\/create" -->\n## 一、Create Order\/V-PRD-CO/);
  assert.doesNotMatch(first.markdown, /document\.version-history|document\.toc|document\.body|版本变更记录|<!-- medol:pagebreak -->|\[TOC\]|page-break-before|v1\.0\.0|DSL 版本|源模型哈希|fnv1a-/);
  assert.equal((first.markdown.match(/^# Versioned PRD$/gm) ?? []).length, 1);
  assert.equal((first.markdown.match(/^# /gm) ?? []).length, 1);
  const initialRows = documentDatabase.prepare(`
    SELECT workspace_version_message
    FROM modeling_document_versions
    WHERE document_id = ?
  `).all(first.id);
  assert.equal(initialRows.length, 1);

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
  assert.match(regenerated.markdown, /^# Versioned PRD$/m);
  assert.match(regenerated.markdown, /Version two\./);
  assert.doesNotMatch(regenerated.markdown, /document\.version-history|document\.toc|document\.body|版本变更记录|<!-- medol:pagebreak -->|v1\.0\.0|v2\.0\.0|Add order list read model|DSL 版本|源模型哈希|fnv1a-/);
  assert.equal((regenerated.markdown.match(/^# Versioned PRD$/gm) ?? []).length, 1);
  assert.equal((regenerated.markdown.match(/^# /gm) ?? []).length, 1);
  const regeneratedRows = documentDatabase.prepare(`
    SELECT workspace_version_message
    FROM modeling_document_versions
    WHERE document_id = ?
    ORDER BY created_at ASC
  `).all(first.id) as Array<{ workspace_version_message: string | null }>;
  assert.equal(regeneratedRows.length, 2);
  assert.deepEqual(
    regeneratedRows.map((row) => row.workspace_version_message),
    ['Initial version', 'Add order list read model']
  );

  const sameVersion = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Versioned PRD',
    kind: 'prd',
    language: 'zh-CN',
    sourceHash: hashMedolSource(nextDsl),
    markdown: regenerated.markdown
  });
  assert.equal(sameVersion.markdown, regenerated.markdown);
  const sameVersionRows = documentDatabase.prepare(`
    SELECT COUNT(*) AS count
    FROM modeling_document_versions
    WHERE document_id = ?
  `).get(first.id) as { count: number };
  assert.equal(sameVersionRows.count, 2);
});

test('does not invent source references for documents without a source fingerprint', () => {
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

  assert.deepEqual(repository.readModelingDocument(created.id)?.sourceRefs, []);
  assert.equal(repository.readModelingDocument(created.id)?.sourceHash, undefined);
  assert.equal(repository.readModelingDocument(created.id)?.workspaceVersionId, undefined);
});

test('backfills document version rows without wrapping editable Markdown', () => {
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
  assert.match(backfilled.markdown, /^# Orders PRD$/m);
  assert.match(backfilled.markdown, /<!-- em:section id="prd\.section\.slice\.CreateOrder" source="domain\/Orders\/context\/Sales\/slice\/CreateOrder" -->/);
  assert.match(backfilled.markdown, /## 一、Create Order\/O-PRD-CO/);
  assert.doesNotMatch(backfilled.markdown, /document\.version-history|document\.toc|document\.body|版本变更记录|<!-- medol:pagebreak -->|v1\.0\.0|Initial version|DSL 版本|源模型哈希|fnv1a-/);
  assert.equal((backfilled.markdown.match(/^# Orders PRD$/gm) ?? []).length, 1);
  assert.equal((backfilled.markdown.match(/^# /gm) ?? []).length, 1);

  const versionRows = documentDatabase.prepare(`
    SELECT document_id, workspace_version_message
    FROM modeling_document_versions
    WHERE document_id = ?
  `).all(created.id) as Array<{ document_id: string; workspace_version_message: string | null }>;
  assert.equal(versionRows.length, 1);
  assert.equal(versionRows[0].workspace_version_message, null);
  assert.equal(backfilled.sourceHash, hashMedolSource(dsl));
  assert.equal(backfilled.workspaceVersionId, undefined);
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
    documentDatabase.prepare<[string], { count: number }>(`
      SELECT COUNT(*) AS count
      FROM modeling_document_versions
      WHERE document_id = ?
    `).get(created.id)?.count,
    0
  );
});

test('keeps legacy provenance unknown through reads and edits until explicit regeneration', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Unknown legacy', dsl: 'domain Legacy {}' });
  const release = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v3.0.0'
  })?.version;
  assert.ok(release);
  const insert = documentDatabase.prepare(`INSERT INTO modeling_documents
    (id, workspace_id, title, kind, language, markdown) VALUES (?, ?, 'Legacy', ?, 'en', ?)`);
  insert.run('unknown-without-markers', workspace.id, 'prd', '# Legacy\n\nOld content.');
  insert.run('unknown-with-markers', workspace.id, 'software-design',
    '# Legacy\n\n<!-- em:section id="legacy" source="slice/legacy" -->\n## Old content');
  insert.run('unknown-catalog', workspace.id, 'model-translations', '# Legacy\n\nOld translations.');
  for (const summary of repository.listModelingDocuments(workspace.id)) {
    for (let index = 0; index < 2; index += 1) {
      const document = repository.readModelingDocument(summary.id);
      assert.equal(document?.sourceHash, undefined);
      assert.equal(document?.workspaceVersionId, undefined);
      assert.equal(document?.workspaceReleaseLabel, undefined);
      assert.ok(document?.revisions?.every((revision) => !revision.sourceHash
        && !revision.workspaceVersionId && !revision.workspaceReleaseLabel) ?? true);
    }
    const edited = repository.updateModelingDocument(summary.id, { title: 'Edited legacy' });
    assert.equal(edited?.workspaceVersionId, undefined);
    const row = documentDatabase.prepare('SELECT source_hash, source_association FROM modeling_documents WHERE id = ?')
      .get(summary.id);
    assert.deepEqual(row, { source_hash: null, source_association: null });
  }
  const regenerated = repository.createModelingDocument({ workspaceId: workspace.id,
    title: 'Legacy', kind: 'prd', language: 'en', sourceHash: hashMedolSource(workspace.dsl),
    markdown: '# Legacy\n\nExplicitly generated.' });
  assert.equal(regenerated.workspaceVersionId, release.id);
  assert.equal(regenerated.workspaceReleaseLabel, 'v3.0.0');
});

test('catalog generation persists exact source identity without revision history or read-time rebinding', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Catalog snapshots', dsl: 'domain Catalog {}' });
  const firstRelease = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v4.0.0'
  })!.version;
  const input = { workspaceId: workspace.id, title: 'Translations', kind: 'model-translations' as const,
    language: 'zh-CN' as const, sourceHash: hashMedolSource(workspace.dsl), markdown: '# Translations\n\nCatalog.' };
  const created = repository.createModelingDocument(input);
  assert.equal(created.workspaceVersionId, firstRelease.id);
  assert.equal(created.workspaceVersionNo, firstRelease.versionNo);
  assert.equal(created.workspaceReleaseLabel, 'v4.0.0');
  assert.equal(created.revisionNo, undefined);
  assert.equal(created.revisions, undefined);
  const nextRelease = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v4.0.1'
  })!.version;
  assert.equal(repository.readModelingDocument(created.id)?.workspaceVersionId, firstRelease.id);
  assert.equal(repository.listModelingDocuments(workspace.id)[0].workspaceVersionId, firstRelease.id);
  assert.equal(repository.updateModelingDocument(created.id, { title: 'Manual catalog' })?.workspaceVersionId, firstRelease.id);
  const regenerated = repository.createModelingDocument(input);
  assert.equal(regenerated.workspaceVersionId, nextRelease.id);
  workspaceRepository.restoreModelingWorkspaceVersion(workspace.id, firstRelease.id);
  assert.equal(repository.createModelingDocument(input).workspaceVersionId, firstRelease.id);
  assert.equal(documentDatabase.prepare<[string], { count: number }>('SELECT COUNT(*) AS count FROM modeling_document_versions WHERE document_id = ?')
    .get(created.id)?.count, 0);
});

test('records independent revisions for manual edits, regeneration, renames, and reverts on one source', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Revision source', dsl: 'domain Revision {}' });
  const input = {
    workspaceId: workspace.id,
    title: 'Revision PRD',
    kind: 'prd' as const,
    language: 'en' as const,
    sourceHash: hashMedolSource(workspace.dsl),
    markdown: '# Revision PRD\n\n<!-- em:section id="revision" source="slice/revision" -->\n## Scope\n\nFirst.'
  };
  const first = repository.createModelingDocument(input);
  assert.equal(first.revisionNo, 1);
  assert.equal(first.revisions?.[0].origin, 'generated');
  assert.ok(first.revisions?.[0].workspaceVersionId);

  const second = repository.createModelingDocument({ ...input, markdown: input.markdown.replace('First.', 'Second.') });
  assert.equal(second.revisionNo, 2);
  const manualMarkdown = second.markdown.replace('Second.', 'Manual.');
  const third = repository.updateModelingDocument(first.id, { markdown: manualMarkdown });
  assert.equal(third?.revisionNo, 3);
  assert.equal(repository.updateModelingDocument(first.id, { markdown: manualMarkdown })?.revisionNo, 3);
  assert.equal(repository.updateModelingDocument(first.id, {})?.revisionNo, 3);
  const renamed = repository.updateModelingDocument(first.id, { title: 'Renamed PRD' });
  assert.equal(renamed?.revisionNo, 4);
  const reverted = repository.updateModelingDocument(first.id, { title: input.title, markdown: first.markdown });
  assert.equal(reverted?.revisionNo, 5);
  assert.deepEqual(reverted?.revisions?.map((revision) => revision.revisionNo), [1, 2, 3, 4, 5]);
  assert.deepEqual(reverted?.revisions?.map((revision) => revision.origin), ['generated', 'generated', 'manual', 'manual', 'manual']);
  assert.equal(reverted?.revisions?.[0].markdown, first.markdown);
  assert.equal(reverted?.revisions?.[2].markdown, manualMarkdown);
  assert.ok(reverted?.revisions?.every((revision) => revision.sourceHash === input.sourceHash
    && revision.workspaceVersionId === first.revisions?.[0].workspaceVersionId));
  assert.equal(repository.listModelingDocuments(workspace.id)[0].revisionNo, 5);
  repository.removeModelingDocument(first.id);
  assert.equal(documentDatabase.prepare<[string], { count: number }>('SELECT COUNT(*) AS count FROM modeling_document_versions WHERE document_id = ?')
    .get(first.id)?.count, 0);
});

test('keeps the original source snapshot when manual edits remove markers after the model changes', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Original source', dsl: 'domain Original {}' });
  const first = repository.createModelingDocument({
    workspaceId: workspace.id, title: 'Source PRD', kind: 'prd', language: 'en',
    sourceHash: hashMedolSource(workspace.dsl), markdown: '# Source PRD\n\nOriginal.'
  });
  workspaceRepository.createModelingWorkspaceVersion(workspace.id, { message: 'Changed source', dsl: 'domain Changed {}' });
  const edited = repository.updateModelingDocument(first.id, { markdown: '# Source PRD\n\nManual.' });
  assert.equal(edited?.sourceHash, first.sourceHash);
  assert.equal(edited?.revisionNo, 2);
  assert.equal(edited?.revisions?.[1].workspaceVersionId, first.revisions?.[0].workspaceVersionId);
  assert.equal(repository.readModelingDocument(first.id)?.revisionNo, 2);
  assert.equal(repository.readModelingDocument(first.id)?.sourceHash, first.sourceHash);
});

test('deduplicates only consecutive equivalent revisions including documents without a source hash', () => {
  const input = { workspaceId: 'no-source-revisions', title: 'Notes', kind: 'process' as const,
    language: 'en' as const, markdown: '# Notes\n\nFirst.' };
  const first = repository.createModelingDocument(input);
  assert.equal(repository.createModelingDocument(input).revisionNo, 1);
  const changed = repository.createModelingDocument({ ...input, markdown: '# Notes\n\nSecond.' });
  assert.equal(changed.revisionNo, 2);
  assert.equal(repository.createModelingDocument(input).revisionNo, 3);
  assert.equal(repository.createModelingDocument({ ...input, sourceHash: 'new-source' }).revisionNo, 4);
  assert.equal(repository.readModelingDocument(first.id)?.revisions?.length, 4);
});

test('stores release snapshot identity independently of identical model content', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Released source', dsl: 'domain Released {}' });
  const release = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v1.2.3'
  })?.version;
  assert.ok(release);
  const input = { workspaceId: workspace.id, title: 'Released PRD', kind: 'prd' as const,
    language: 'en' as const, sourceHash: hashMedolSource(workspace.dsl), markdown: '# Released PRD\n\nBody.' };
  const first = repository.createModelingDocument(input);
  assert.equal(first.workspaceVersionId, release.id);
  assert.equal(first.workspaceReleaseLabel, 'v1.2.3');
  const nextRelease = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v1.2.4'
  })?.version;
  assert.ok(nextRelease);
  const manual = repository.updateModelingDocument(first.id, { title: 'Manual release notes' });
  assert.equal(manual?.workspaceVersionId, release.id);
  assert.equal(manual?.workspaceReleaseLabel, 'v1.2.3');
  const regenerated = repository.createModelingDocument({ ...input, title: 'Manual release notes' });
  assert.equal(regenerated.revisionNo, 3);
  assert.equal(regenerated.workspaceVersionId, nextRelease.id);
  assert.equal(regenerated.workspaceReleaseLabel, 'v1.2.4');
  assert.equal(regenerated.revisions?.[0].workspaceReleaseLabel, 'v1.2.3');
  assert.equal(regenerated.revisions?.[1].workspaceReleaseLabel, 'v1.2.3');
  assert.equal(regenerated.revisions?.[2].workspaceReleaseLabel, 'v1.2.4');
  assert.equal(repository.createModelingDocument({ ...input, title: 'Manual release notes' }).revisionNo, 3);
});

test('prefers a matching restored head over newer snapshots with identical source', () => {
  const workspace = workspaceRepository.createModelingWorkspace({ name: 'Restored release', dsl: 'domain RestoredRelease {}' });
  const older = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v2.0.0'
  })?.version;
  const newer = workspaceRepository.createModelingWorkspaceVersion(workspace.id, {
    dsl: workspace.dsl, releaseChannel: 'stable', releaseLabel: 'v2.0.1'
  })?.version;
  assert.ok(older);
  assert.ok(newer);
  const input = { workspaceId: workspace.id, title: 'Restored PRD', kind: 'prd' as const,
    language: 'en' as const, sourceHash: hashMedolSource(workspace.dsl), markdown: '# Restored PRD\n\nBody.' };
  const first = repository.createModelingDocument(input);
  assert.equal(first.workspaceVersionId, newer.id);

  const restoredWorkspace = workspaceRepository.restoreModelingWorkspaceVersion(workspace.id, older.id);
  assert.equal(restoredWorkspace?.headVersionId, older.id);
  const restored = repository.createModelingDocument(input);
  assert.equal(restored.revisionNo, 2);
  assert.equal(restored.workspaceVersionId, older.id);
  assert.equal(restored.workspaceReleaseLabel, 'v2.0.0');
  assert.equal(repository.createModelingDocument(input).revisionNo, 2);

  workspaceRepository.restoreModelingWorkspaceVersion(workspace.id, newer.id);
  const manual = repository.updateModelingDocument(first.id, { markdown: '# Restored PRD\n\nManual.' });
  assert.equal(manual?.revisionNo, 3);
  assert.equal(manual?.workspaceVersionId, older.id);
  assert.equal(manual?.workspaceReleaseLabel, 'v2.0.0');

  workspaceRepository.createModelingWorkspaceVersion(workspace.id, { dsl: 'domain DifferentHead {}' });
  const historical = repository.createModelingDocument(input);
  assert.equal(historical.workspaceVersionId, newer.id);
  assert.equal(historical.workspaceReleaseLabel, 'v2.0.1');
});
