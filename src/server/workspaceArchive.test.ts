import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test from 'node:test';

const paths = [`/private/tmp/medol-archive-${process.pid}.sqlite`, `/private/tmp/medol-archive-docs-${process.pid}.sqlite`];
process.env.MEDOL_DB_PATH = paths[0];
process.env.MEDOL_DOCUMENT_DB_PATH = paths[1];
const { database } = await import('./database');
const { documentDatabase } = await import('./documentDatabase');
const workspaces = await import('./modelingWorkspaceRepository');
const documents = await import('./modelingDocumentRepository');
const { upsertModelTranslations, readModelTranslations } = await import('./modelTranslationRepository');
const { exportWorkspaceArchive, importWorkspaceArchive, validateWorkspaceArchive } = await import('./workspaceArchive');
const { hashMedolSource } = await import('../features/documentation/documentReferences');

test.after(() => {
  database.close();
  documentDatabase.close();
  for (const path of paths) for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
});

function fixture() {
  const workspace = workspaces.createModelingWorkspace({ name: 'Orders', dsl: 'domain Orders {}' });
  workspaces.createModelingWorkspaceVersion(workspace.id, { releaseChannel: 'stable', releaseLabel: 'v1.2.3' });
  const sourceHash = hashMedolSource(workspace.dsl);
  const doc = documents.createModelingDocument({ workspaceId: workspace.id, title: 'PRD', kind: 'prd', language: 'en', sourceHash, markdown: '# PRD\n\nGenerated.' });
  documents.updateModelingDocument(doc.id, { markdown: '# PRD\n\nManual.' });
  documents.createModelingDocument({ workspaceId: workspace.id, title: 'Translations', kind: 'model-translations', language: 'zh-CN', sourceHash, markdown: '# Translations' });
  upsertModelTranslations({ workspaceId: workspace.id, sourceHash, locale: 'zh-CN', translations: { Orders: '订单' } });
  return { workspace, doc, sourceHash };
}

test('round trips drafts, releases, document originals, edits, revisions, catalog associations and translations', () => {
  const { workspace, sourceHash } = fixture();
  const other = workspaces.createModelingWorkspace({ name: 'Private', dsl: 'private' });
  const archive = exportWorkspaceArchive(workspace.id)!;
  assert.equal(archive.versions.length, 2);
  assert.equal(archive.documents.length, 2);
  assert.ok(archive.documents.every((d) => d.workspace_id !== other.id));
  assert.match(archive.documents[0].generated_markdown!, /Generated/);
  assert.match(archive.documents[0].markdown, /Manual/);
  const imported = importWorkspaceArchive(JSON.parse(JSON.stringify(archive)));
  assert.notEqual(imported.id, workspace.id);
  assert.notEqual(imported.headVersionId, archive.workspace.head_version_id);
  const copy = exportWorkspaceArchive(imported.id)!;
  assert.equal(copy.versions.length, 2);
  assert.equal(copy.versions[1].release_label, 'v1.2.3');
  assert.equal(copy.versions[1].parent_version_id, copy.versions[0].id);
  assert.equal(copy.documents[0].generated_markdown, archive.documents[0].generated_markdown);
  assert.equal(copy.documents[0].markdown, archive.documents[0].markdown);
  assert.equal(copy.documentVersions.length, archive.documentVersions.length);
  assert.ok(copy.documentVersions.every((v) => v.document_id === copy.documents[0].id));
  assert.equal(copy.documentVersions[0].workspace_version_id, imported.headVersionId);
  assert.equal(copy.documents[1].source_association?.workspace_version_id, imported.headVersionId);
  assert.deepEqual(readModelTranslations({ workspaceId: imported.id, sourceHash, locale: 'zh-CN' }), { Orders: '订单' });
  const originalAfterImport = exportWorkspaceArchive(workspace.id)!;
  assert.deepEqual(originalAfterImport, { ...archive, exportedAt: originalAfterImport.exportedAt });
  assert.notEqual(importWorkspaceArchive(archive).id, imported.id);
  // Continue editing/regenerating through the existing repository after import.
  const regenerated = documents.createModelingDocument({ workspaceId: imported.id, title: 'PRD', kind: 'prd', language: 'en', sourceHash, markdown: '# PRD\n\nNew generated.' });
  assert.match(regenerated.markdown, /Manual/);
});

test('exports the current unsaved model without mutating the server draft or head', () => {
  const { workspace } = fixture();
  const current = workspaces.readModelingWorkspace(workspace.id)!;
  const archive = exportWorkspaceArchive(workspace.id, 'domain Draft {}')!;
  assert.equal(archive.workspace.dsl, 'domain Draft {}');
  assert.equal(archive.workspace.head_version_id, null);
  assert.deepEqual(workspaces.readModelingWorkspace(workspace.id), current);
  assert.equal(exportWorkspaceArchive('missing'), undefined);
});

test('includes document-owned legacy history after a workspace database restore', () => {
  const { workspace, doc } = fixture();
  documentDatabase.prepare('UPDATE modeling_document_versions SET workspace_id = ? WHERE document_id = ?')
    .run('previous-workspace-id', doc.id);
  const archive = exportWorkspaceArchive(workspace.id)!;
  assert.equal(archive.documentVersions.length, 2);
  assert.ok(archive.documentVersions.every((v) => v.workspace_id === workspace.id));
  assert.equal(exportWorkspaceArchive(importWorkspaceArchive(archive).id)!.documentVersions.length, 2);
});

test('rejects invalid format, cross-workspace data, duplicates and broken references before writing', () => {
  const { workspace } = fixture();
  const archive = exportWorkspaceArchive(workspace.id)!;
  const before = workspaces.listModelingWorkspaces().length;
  for (const mutate of [
    (a: any) => { a.formatVersion = 2; },
    (a: any) => { a.documents[0].workspace_id = 'another'; },
    (a: any) => { a.workspace.head_version_id = 'missing'; },
    (a: any) => { a.versions.push(a.versions[0]); },
    (a: any) => { a.documentVersions[0].document_id = 'missing'; },
    (a: any) => { a.documents[1].source_association.workspace_version_id = 'missing'; }
  ]) {
    const invalid = structuredClone(archive);
    mutate(invalid);
    assert.throws(() => importWorkspaceArchive(invalid), /archive/i);
  }
  assert.equal(workspaces.listModelingWorkspaces().length, before);
  assert.throws(() => validateWorkspaceArchive(null), /archive/);
});

test('rolls back both stores when inserting a document fails', () => {
  const { workspace } = fixture();
  const archive = exportWorkspaceArchive(workspace.id)!;
  const before = workspaces.listModelingWorkspaces().length;
  const beforeDocs = documentDatabase.prepare('SELECT count(*) AS n FROM modeling_documents').get();
  documentDatabase.exec("CREATE TRIGGER reject_archive BEFORE INSERT ON modeling_documents WHEN NEW.title = 'Translations' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  try { assert.throws(() => importWorkspaceArchive(archive), /test failure/); }
  finally { documentDatabase.exec('DROP TRIGGER reject_archive'); }
  assert.equal(workspaces.listModelingWorkspaces().length, before);
  assert.deepEqual(documentDatabase.prepare('SELECT count(*) AS n FROM modeling_documents').get(), beforeDocs);
});
