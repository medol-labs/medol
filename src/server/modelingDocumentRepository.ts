import { randomUUID } from 'node:crypto';
import type {
  CreateModelingDocumentInput,
  ModelingDocument,
  ModelingDocumentSummary,
  UpdateModelingDocumentInput
} from '../contracts/modelingDocument';
import type {
  DocumentationKind,
  DocumentationLanguage
} from '../lib/generators/documentation';
import {
  addDocumentSectionReferences,
  extractDocumentSourceRefs,
  hashMedolSource,
  mergeGeneratedDocument,
  parseDocumentMarkdownSections
} from '../features/documentation/documentReferences';
import { parseMedol } from '../lib/dslParser';
import { humanize } from '../lib/name';
import { documentDatabase } from './documentDatabase';
import { readModelingWorkspace } from './modelingWorkspaceRepository';

interface DocumentRow {
  id: string;
  workspace_id: string;
  title: string;
  kind: DocumentationKind;
  language: DocumentationLanguage;
  markdown: string;
  generated_markdown: string | null;
  source_hash: string | null;
  created_at: string;
  updated_at: string;
}

documentDatabase.exec(`
  CREATE TABLE IF NOT EXISTS modeling_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    language TEXT NOT NULL,
    markdown TEXT NOT NULL,
    generated_markdown TEXT,
    source_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS modeling_documents_workspace_updated_at
  ON modeling_documents(workspace_id, updated_at DESC);
`);

const documentColumns = documentDatabase
  .prepare('PRAGMA table_info(modeling_documents)')
  .all() as Array<{ name: string }>;
if (!documentColumns.some((column) => column.name === 'source_hash')) {
  documentDatabase.exec('ALTER TABLE modeling_documents ADD COLUMN source_hash TEXT');
}
if (!documentColumns.some((column) => column.name === 'generated_markdown')) {
  documentDatabase.exec('ALTER TABLE modeling_documents ADD COLUMN generated_markdown TEXT');
}

const listDocuments = documentDatabase.prepare(`
  SELECT id, workspace_id, title, kind, language, markdown, generated_markdown, source_hash, created_at, updated_at
  FROM modeling_documents
  WHERE workspace_id = ?
  ORDER BY updated_at DESC, title ASC
`);

const selectDocument = documentDatabase.prepare(`
  SELECT id, workspace_id, title, kind, language, markdown, generated_markdown, source_hash, created_at, updated_at
  FROM modeling_documents
  WHERE id = ?
`);

const selectMatchingDocument = documentDatabase.prepare(`
  SELECT id, workspace_id, title, kind, language, markdown, generated_markdown, source_hash, created_at, updated_at
  FROM modeling_documents
  WHERE workspace_id = ? AND kind = ? AND language = ?
  ORDER BY updated_at DESC
  LIMIT 1
`);

const insertDocument = documentDatabase.prepare(`
  INSERT INTO modeling_documents (
    id, workspace_id, title, kind, language, markdown, generated_markdown, source_hash, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateDocument = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET title = ?, markdown = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const updateGeneratedDocument = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET title = ?, markdown = ?, generated_markdown = ?, source_hash = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const deleteDocument = documentDatabase.prepare(`
  DELETE FROM modeling_documents
  WHERE id = ?
`);

const backfillDocument = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET markdown = ?, generated_markdown = COALESCE(generated_markdown, ?), source_hash = ?
  WHERE id = ?
`);

const backfillGeneratedBaseline = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET generated_markdown = ?
  WHERE id = ? AND generated_markdown IS NULL
`);

export const listModelingDocuments = (workspaceId: string): ModelingDocumentSummary[] =>
  (listDocuments.all(workspaceId) as DocumentRow[]).map(ensureDocumentReferences).map(toSummary);

export const readModelingDocument = (documentId: string): ModelingDocument | undefined => {
  const row = selectDocument.get(documentId) as DocumentRow | undefined;
  return row ? toDocument(ensureDocumentReferences(row)) : undefined;
};

export const createModelingDocument = (
  input: CreateModelingDocumentInput
): ModelingDocument => {
  const existing = selectMatchingDocument.get(
    input.workspaceId,
    input.kind,
    input.language
  ) as DocumentRow | undefined;
  if (existing) {
    const prepared = ensureDocumentReferences(existing);
    const merge = mergeGeneratedDocument(
      prepared.markdown,
      prepared.generated_markdown ?? undefined,
      input.markdown
    );
    updateGeneratedDocument.run(
      input.title,
      merge.markdown,
      input.markdown,
      input.sourceHash ?? null,
      prepared.id
    );
    return {
      ...requireDocument(prepared.id),
      mergeSummary: {
        created: false,
        added: merge.added,
        updated: merge.updated,
        preserved: merge.preserved,
        removed: merge.removed
      }
    };
  }

  const documentId = randomUUID();
  insertDocument.run(
    documentId,
    input.workspaceId,
    input.title,
    input.kind,
    input.language,
    input.markdown,
    input.markdown,
    input.sourceHash ?? null
  );
  return {
    ...requireDocument(documentId),
    mergeSummary: {
      created: true,
      added: parseSectionCount(input.markdown),
      updated: 0,
      preserved: 0,
      removed: 0
    }
  };
};

export const updateModelingDocument = (
  documentId: string,
  input: UpdateModelingDocumentInput
): ModelingDocument | undefined => {
  const current = readModelingDocument(documentId);
  if (!current) return undefined;
  updateDocument.run(
    input.title ?? current.title,
    input.markdown ?? current.markdown,
    documentId
  );
  return requireDocument(documentId);
};

export const removeModelingDocument = (documentId: string): boolean =>
  deleteDocument.run(documentId).changes > 0;

const requireDocument = (documentId: string): ModelingDocument => {
  const document = readModelingDocument(documentId);
  if (!document) throw new Error(`Document ${documentId} was not persisted`);
  return document;
};

const toSummary = (row: DocumentRow): ModelingDocumentSummary => ({
  id: row.id,
  workspaceId: row.workspace_id,
  title: row.title,
  kind: row.kind,
  language: row.language,
  sourceRefs: extractDocumentSourceRefs(row.markdown),
  ...(row.source_hash ? { sourceHash: row.source_hash } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toDocument = (row: DocumentRow): ModelingDocument => ({
  ...toSummary(row),
  markdown: row.markdown
});

const ensureDocumentReferences = (row: DocumentRow): DocumentRow => {
  if (extractDocumentSourceRefs(row.markdown).length > 0) {
    if (row.generated_markdown) return row;
    backfillGeneratedBaseline.run(row.markdown, row.id);
    return {
      ...row,
      generated_markdown: row.markdown
    };
  }
  const workspace = readModelingWorkspace(row.workspace_id);
  if (!workspace?.dsl) return row;

  const model = parseMedol(workspace.dsl);
  const references = row.kind === 'software-design'
    ? [
        ...model.contexts.flatMap((context) =>
          context.aggregates.map((aggregate) => ({
            sectionId: `software.aggregate.${aggregate.name}`,
            sourceId: aggregate.id,
            headings: [aggregate.name, humanize(aggregate.name)]
          }))
        ),
        ...model.contexts.map((context) => ({
          sectionId: `software.context.${context.name}`,
          sourceId: context.id,
          headings: [context.name, humanize(context.name)]
        }))
      ]
    : row.kind === 'database-design'
      ? model.contexts.flatMap((context) => [
          ...context.aggregates.flatMap((aggregate) =>
            aggregate.slices.flatMap((slice) =>
              slice.elements
                .filter((element) => element.kind === 'readmodel')
                .map((element) => ({
                  sectionId: `database.readmodel.${element.name}`,
                  sourceId: element.id,
                  headings: [element.name, humanize(element.name)]
                }))
            )
          ),
          ...context.slices.flatMap((slice) =>
            slice.elements
              .filter((element) => element.kind === 'readmodel')
              .map((element) => ({
                sectionId: `database.readmodel.${element.name}`,
                sourceId: element.id,
                headings: [element.name, humanize(element.name)]
              }))
          )
        ])
      : model.contexts.flatMap((context) => [
          ...context.aggregates.flatMap((aggregate) =>
            aggregate.slices.map((slice) => ({
              sectionId: `${row.kind}.slice.${slice.name}`,
              sourceId: slice.id,
              headings: [slice.name, humanize(slice.name)]
            }))
          ),
          ...context.slices.map((slice) => ({
            sectionId: `${row.kind}.slice.${slice.name}`,
            sourceId: slice.id,
            headings: [slice.name, humanize(slice.name)]
          }))
        ]);
  const markdown = addDocumentSectionReferences(row.markdown, references);
  if (markdown === row.markdown) return row;

  const sourceHash = hashMedolSource(workspace.dsl);
  backfillDocument.run(markdown, markdown, sourceHash, row.id);
  return {
    ...row,
    markdown,
    generated_markdown: row.generated_markdown ?? markdown,
    source_hash: sourceHash
  };
};

const parseSectionCount = (markdown: string): number =>
  Math.max(1, parseDocumentMarkdownSections(markdown).length);
