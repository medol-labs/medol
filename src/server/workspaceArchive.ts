import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database } from './database';
import { documentDatabase } from './documentDatabase';
import { readModelingWorkspace } from './modelingWorkspaceRepository';
import './modelingDocumentRepository';
import './modelTranslationRepository';

export const archiveByteLimit = 64 * 1024 * 1024;
const text = z.string();
const id = text.min(1);
const nullable = text.nullable();
const positive = z.number().int().positive();
const kind = z.enum(['prd', 'software-design', 'database-design', 'process', 'test-outline',
  'user-journey', 'diagrams', 'installation-manual', 'user-manual', 'model-translations']);
const language = z.enum(['en', 'zh-CN']);
const association = z.object({
  source_hash: nullable,
  workspace_version_id: nullable,
  workspace_version_no: positive.nullable(),
  workspace_release_label: nullable
}).strict();
const schema = z.object({
  format: z.literal('medol-workspace'),
  formatVersion: z.literal(1),
  exportedAt: text,
  workspace: z.object({
    id, name: text.trim().min(1).max(120), dsl: text,
    head_version_id: nullable, created_at: text, updated_at: text
  }).strict(),
  versions: z.array(z.object({
    id, workspace_id: id, version_no: positive, parent_version_id: nullable,
    dsl: text, model_hash: text, message: text, author: nullable,
    release_channel: nullable, release_label: nullable, release_notes: nullable,
    released_at: nullable, created_at: text
  }).strict()),
  documents: z.array(z.object({
    id, workspace_id: id, title: text, kind, language, markdown: text,
    generated_markdown: nullable, source_hash: nullable,
    source_association: association.nullable(), created_at: text, updated_at: text
  }).strict()),
  documentVersions: z.array(z.object({
    id, document_id: id, workspace_id: id, title: text, kind, language,
    source_hash: nullable, workspace_version_id: nullable,
    workspace_version_no: positive.nullable(), workspace_version_message: nullable,
    workspace_release_label: nullable, created_at: text, revision_no: positive,
    origin: z.enum(['generated', 'manual', 'legacy']), markdown: text
  }).strict()),
  translations: z.array(z.object({
    workspace_id: id, source_hash: text, locale: text, source_text: text,
    translated_text: text, provider: nullable, model: nullable, created_at: text, updated_at: text
  }).strict())
}).strict();

export type WorkspaceArchive = z.infer<typeof schema>;

export function validateWorkspaceArchive(input: unknown): WorkspaceArchive {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid or unsupported workspace archive.');
  const archive = result.data;
  const unique = (values: (string | number)[]) => new Set(values).size === values.length;
  const versionIds = new Set(archive.versions.map((v) => v.id));
  const documentIds = new Set(archive.documents.map((d) => d.id));
  const validVersion = (value: string | null) => value === null || versionIds.has(value);
  const scoped = [...archive.versions, ...archive.documents, ...archive.documentVersions, ...archive.translations];
  if (scoped.some((row) => row.workspace_id !== archive.workspace.id)
    || !unique(archive.versions.map((v) => v.id))
    || !unique(archive.versions.map((v) => v.version_no))
    || !unique(archive.documents.map((d) => d.id))
    || !unique(archive.documentVersions.map((v) => v.id))
    || !unique(archive.documentVersions.map((v) => JSON.stringify([v.document_id, v.revision_no])))
    || !unique(archive.translations.map((v) => JSON.stringify([v.source_hash, v.locale, v.source_text])))
    || !validVersion(archive.workspace.head_version_id)
    || archive.versions.some((v) => !validVersion(v.parent_version_id)
      || (v.parent_version_id !== null && !archive.versions.some((p) => p.id === v.parent_version_id && p.version_no < v.version_no)))
    || archive.documents.some((d) => d.source_association && !validVersion(d.source_association.workspace_version_id))
    || archive.documentVersions.some((v) => !documentIds.has(v.document_id) || !validVersion(v.workspace_version_id))) {
    throw new Error('Workspace archive contains duplicate or invalid references.');
  }
  return archive;
}

// A single connection provides a consistent snapshot and rollback across both stores.
function withStores<T>(operation: () => T): T {
  const file = (documentDatabase.pragma('database_list') as { name: string; file: string }[])
    .find((entry) => entry.name === 'main')!.file;
  database.prepare('ATTACH DATABASE ? AS archive_documents').run(file);
  try {
    return database.transaction(operation)();
  } finally {
    database.exec('DETACH DATABASE archive_documents');
  }
}

export function exportWorkspaceArchive(workspaceId: string, draft?: string): WorkspaceArchive | undefined {
  if (!readModelingWorkspace(workspaceId)) return undefined;
  return withStores(() => {
    const rows = (table: string) => database.prepare(`SELECT * FROM ${table} WHERE workspace_id = ? ORDER BY rowid`).all(workspaceId);
    const workspace = database.prepare('SELECT * FROM modeling_workspaces WHERE id = ?').get(workspaceId) as WorkspaceArchive['workspace'];
    if (draft !== undefined && draft !== workspace.dsl) {
      workspace.dsl = draft;
      workspace.head_version_id = null;
    }
    return validateWorkspaceArchive({
      format: 'medol-workspace', formatVersion: 1, exportedAt: new Date().toISOString(), workspace,
      versions: rows('modeling_workspace_versions'),
      documents: rows('archive_documents.modeling_documents').map((row) => {
        const document = row as Record<string, unknown>;
        return { ...document, source_association: document.source_association ? JSON.parse(document.source_association as string) : null };
      }),
      // Older restored stores can retain a previous workspace ID on a document's history.
      // Document ownership is authoritative; do not silently omit those revisions.
      documentVersions: database.prepare(`
        SELECT v.* FROM archive_documents.modeling_document_versions v
        JOIN archive_documents.modeling_documents d ON d.id = v.document_id
        WHERE d.workspace_id = ? ORDER BY v.rowid
      `).all(workspaceId).map((row) => ({ ...(row as Record<string, unknown>), workspace_id: workspaceId })),
      translations: rows('model_translations')
    });
  });
}

export function importWorkspaceArchive(input: unknown) {
  const archive = validateWorkspaceArchive(input);
  const workspaceId = randomUUID();
  const versionIds = new Map(archive.versions.map((v) => [v.id, randomUUID()]));
  const documentIds = new Map(archive.documents.map((d) => [d.id, randomUUID()]));
  const versionId = (value: string | null) => value === null ? null : versionIds.get(value)!;
  withStores(() => {
    const insert = (table: string, row: Record<string, unknown>) => {
      const columns = Object.keys(row);
      database.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
        .run(...Object.values(row));
    };
    insert('modeling_workspaces', { ...archive.workspace, id: workspaceId, head_version_id: versionId(archive.workspace.head_version_id) });
    for (const row of archive.versions) insert('modeling_workspace_versions', {
      ...row, id: versionIds.get(row.id), workspace_id: workspaceId, parent_version_id: versionId(row.parent_version_id)
    });
    for (const row of archive.documents) insert('archive_documents.modeling_documents', {
      ...row, id: documentIds.get(row.id), workspace_id: workspaceId,
      source_association: row.source_association ? JSON.stringify({ ...row.source_association,
        workspace_version_id: versionId(row.source_association.workspace_version_id) }) : null
    });
    for (const row of archive.documentVersions) insert('archive_documents.modeling_document_versions', {
      ...row, id: randomUUID(), document_id: documentIds.get(row.document_id),
      workspace_id: workspaceId, workspace_version_id: versionId(row.workspace_version_id)
    });
    for (const row of archive.translations) insert('model_translations', { ...row, workspace_id: workspaceId });
  });
  return readModelingWorkspace(workspaceId)!;
}
