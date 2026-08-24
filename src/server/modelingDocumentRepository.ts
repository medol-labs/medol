import { randomUUID } from 'node:crypto';
import type {
  CreateModelingDocumentInput,
  ModelingDocumentKind,
  ModelingDocument,
  ModelingDocumentSummary,
  UpdateModelingDocumentInput
} from '../contracts/modelingDocument';
import type { DocumentationLanguage } from '../lib/generators/documentation';
import {
  addDocumentSectionReferences,
  extractDocumentSourceRefs,
  hashMedolSource,
  mergeGeneratedDocument,
  parseDocumentMarkdownSections
} from '../features/documentation/documentReferences';
import { numberMarkdownHeadings } from '../lib/generators/documentation/documentHeadingNumbering';
import {
  documentTableOfContentsSectionId,
  stripMarkdownTableOfContents
} from '../lib/generators/documentation/documentTableOfContents';
import { parseMedol } from '../lib/dslParser';
import { humanize } from '../lib/name';
import { documentDatabase } from './documentDatabase';
import {
  listModelingWorkspaceVersions,
  readModelingWorkspace
} from './modelingWorkspaceRepository';

interface DocumentRow {
  id: string;
  workspace_id: string;
  title: string;
  kind: ModelingDocumentKind;
  language: DocumentationLanguage;
  markdown: string;
  generated_markdown: string | null;
  source_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentVersionRow {
  id: string;
  document_id: string;
  workspace_id: string;
  title: string;
  kind: ModelingDocumentKind;
  language: DocumentationLanguage;
  source_hash: string | null;
  workspace_version_id: string | null;
  workspace_version_no: number | null;
  workspace_version_message: string | null;
  created_at: string;
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

  CREATE TABLE IF NOT EXISTS modeling_document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    language TEXT NOT NULL,
    source_hash TEXT,
    workspace_version_id TEXT,
    workspace_version_no INTEGER,
    workspace_version_message TEXT,
    markdown TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS modeling_document_versions_document_created_at
  ON modeling_document_versions(document_id, created_at ASC);
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

const insertDocumentVersion = documentDatabase.prepare(`
  INSERT INTO modeling_document_versions (
    id, document_id, workspace_id, title, kind, language, source_hash,
    workspace_version_id, workspace_version_no, workspace_version_message, markdown, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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

const listDocumentVersions = documentDatabase.prepare(`
  SELECT id, document_id, workspace_id, title, kind, language, source_hash,
    workspace_version_id, workspace_version_no, workspace_version_message, created_at
  FROM modeling_document_versions
  WHERE document_id = ?
  ORDER BY created_at ASC
`);

const deleteDocument = documentDatabase.prepare(`
  DELETE FROM modeling_documents
  WHERE id = ?
`);

const deleteDocumentVersions = documentDatabase.prepare(`
  DELETE FROM modeling_document_versions
  WHERE document_id = ?
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

const backfillDocumentVersionHistory = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET markdown = ?, generated_markdown = ?, source_hash = COALESCE(source_hash, ?), updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
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
  const tracksVersions = supportsDocumentVersionHistory(input.kind);
  const existing = selectMatchingDocument.get(
    input.workspaceId,
    input.kind,
    input.language
  ) as DocumentRow | undefined;
  if (existing) {
    const prepared = ensureDocumentReferences(existing);
    const documentVersion = tracksVersions
      ? createDocumentVersionSnapshot(prepared.id, input)
      : undefined;
    const currentMarkdown = stripDocumentVersionHistory(prepared.markdown, prepared.title);
    const baselineMarkdown = prepared.generated_markdown
      ? stripDocumentVersionHistory(prepared.generated_markdown, prepared.title)
      : undefined;
    const nextMarkdown = stripDocumentVersionHistory(input.markdown, input.title);
    const merge = mergeGeneratedDocument(
      currentMarkdown,
      baselineMarkdown,
      nextMarkdown
    );
    const markdown = documentVersion
      ? prepareVersionedEditableMarkdown(merge.markdown, documentVersion)
      : merge.markdown;
    const generatedMarkdown = documentVersion
      ? prepareVersionedEditableMarkdown(nextMarkdown, documentVersion)
      : nextMarkdown;
    updateGeneratedDocument.run(
      input.title,
      markdown,
      generatedMarkdown,
      input.sourceHash ?? null,
      prepared.id
    );
    if (documentVersion) {
      persistDocumentVersion(prepared.id, input, documentVersion, markdown);
    }
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
  const documentVersion = tracksVersions
    ? createDocumentVersionSnapshot(documentId, input)
    : undefined;
  const markdown = documentVersion
    ? prepareVersionedEditableMarkdown(stripDocumentVersionHistory(input.markdown, input.title), documentVersion)
    : stripDocumentVersionHistory(input.markdown, input.title);
  insertDocument.run(
    documentId,
    input.workspaceId,
    input.title,
    input.kind,
    input.language,
    markdown,
    markdown,
    input.sourceHash ?? null
  );
  if (documentVersion) {
    persistDocumentVersion(documentId, input, documentVersion, markdown);
  }
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
  documentDatabase.transaction(() => {
    deleteDocumentVersions.run(documentId);
    return deleteDocument.run(documentId).changes > 0;
  })();

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

const documentVersionHistorySectionId = 'document.version-history';
const documentBodySectionId = 'document.body';
const documentPageBreakPattern =
  /(?:<!--\s*medol:pagebreak\s*-->|<div\s+style="page-break-before:\s*always;">\s*<\/div>)/giu;

const supportsDocumentVersionHistory = (kind: ModelingDocumentKind): boolean =>
  kind !== 'model-translations';

const readDocumentVersionRows = (documentId: string): DocumentVersionRow[] =>
  listDocumentVersions.all(documentId) as DocumentVersionRow[];

const createDocumentVersionSnapshot = (
  documentId: string,
  input: CreateModelingDocumentInput
): DocumentVersionRow => {
  const workspaceVersion = input.sourceHash
    ? listModelingWorkspaceVersions(input.workspaceId)
        .find((version) => version.modelHash === input.sourceHash)
    : undefined;
  return {
    id: randomUUID(),
    document_id: documentId,
    workspace_id: input.workspaceId,
    title: input.title,
    kind: input.kind,
    language: input.language,
    source_hash: input.sourceHash ?? null,
    workspace_version_id: workspaceVersion?.id ?? null,
    workspace_version_no: workspaceVersion?.versionNo ?? null,
    workspace_version_message: workspaceVersion?.message ?? null,
    created_at: new Date().toISOString()
  };
};

const persistDocumentVersion = (
  documentId: string,
  input: CreateModelingDocumentInput,
  version: DocumentVersionRow,
  markdown: string
): void => {
  if (hasEquivalentDocumentVersion(readDocumentVersionRows(documentId), version)) return;
  insertDocumentVersion.run(
    version.id,
    documentId,
    input.workspaceId,
    input.title,
    input.kind,
    input.language,
    input.sourceHash ?? null,
    version.workspace_version_id,
    version.workspace_version_no,
    version.workspace_version_message,
    markdown
  );
};

const stripDocumentVersionHistory = (markdown: string, title?: string): string => {
  const unwrapped = parseDocumentMarkdownSections(markdown)
    .map((section) => {
      if (
        section.id === documentVersionHistorySectionId
        || section.id === documentTableOfContentsSectionId
      ) {
        return '';
      }
      if (section.id === documentBodySectionId) {
        return section.markdown;
      }
      return [
        section.marker,
        section.markdown
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
  return ensureLeadingDocumentTitle(
    stripMarkdownTableOfContents(stripDocumentPageBreaks(unwrapped)),
    title
  );
};

const stripDocumentPageBreaks = (markdown: string): string =>
  markdown.replace(documentPageBreakPattern, '').replace(/\n{3,}/g, '\n\n').trim();

const ensureLeadingDocumentTitle = (markdown: string, title?: string): string => {
  const cleaned = markdown.trim();
  if (!title) return cleaned;
  const firstContent = cleaned.split(/\r?\n/).find((line) => line.trim())?.trim();
  if (firstContent && /^#\s+/u.test(firstContent)) return cleaned;
  return [`# ${title}`, cleaned].filter(Boolean).join('\n\n');
};

const prepareVersionedEditableMarkdown = (
  markdown: string,
  nextRow: DocumentVersionRow
): string =>
  stripDocumentVersionHistory(numberMarkdownHeadings(markdown, nextRow.language), nextRow.title);

const preparePersistedEditableMarkdown = (
  documentId: string,
  markdown: string,
  title: string
): string => {
  const rows = readDocumentVersionRows(documentId);
  if (rows.length === 0) return stripDocumentVersionHistory(markdown, title);
  return stripDocumentVersionHistory(numberMarkdownHeadings(markdown, rows[rows.length - 1].language), title);
};

const hasEquivalentDocumentVersion = (
  rows: DocumentVersionRow[],
  nextRow: DocumentVersionRow
): boolean =>
  rows.some((row) => {
    if (row.workspace_version_id && nextRow.workspace_version_id) {
      return row.workspace_version_id === nextRow.workspace_version_id;
    }
    return Boolean(row.source_hash)
      && Boolean(nextRow.source_hash)
      && row.source_hash === nextRow.source_hash;
  });

const ensureDocumentReferences = (row: DocumentRow): DocumentRow => {
  if (extractDocumentSourceRefs(row.markdown).length > 0) {
    const prepared = row.generated_markdown
      ? row
      : {
          ...row,
          generated_markdown: row.markdown
        };
    if (!row.generated_markdown) {
      backfillGeneratedBaseline.run(row.markdown, row.id);
    }
    return ensureDocumentVersionRows(prepared);
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
        ...model.contexts.flatMap((context) =>
          context.concepts.map((concept) => ({
            sectionId: `software.aggregate.${concept.name}`,
            sourceId: concept.id,
            headings: [concept.name, humanize(concept.name)]
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
  const markdown = addDocumentSectionReferences(stripDocumentVersionHistory(row.markdown, row.title), references);
  const sourceHash = hashMedolSource(workspace.dsl);
  const prepared = {
    ...row,
    markdown,
    generated_markdown: row.generated_markdown ?? markdown,
    source_hash: sourceHash
  };
  if (markdown !== row.markdown) {
    backfillDocument.run(markdown, markdown, sourceHash, row.id);
  }
  return ensureDocumentVersionRows(prepared, workspace);
};

const ensureDocumentVersionRows = (
  row: DocumentRow,
  workspace = readModelingWorkspace(row.workspace_id)
): DocumentRow => {
  if (!supportsDocumentVersionHistory(row.kind)) {
    return row;
  }
  const existingRows = readDocumentVersionRows(row.id);
  const sourceHash = row.source_hash ?? (workspace?.dsl ? hashMedolSource(workspace.dsl) : undefined);
  const input: CreateModelingDocumentInput = {
    workspaceId: row.workspace_id,
    title: row.title,
    kind: row.kind,
    language: row.language,
    markdown: row.markdown,
    ...(sourceHash ? { sourceHash } : {})
  };
  const documentVersion = existingRows.length === 0
    ? createDocumentVersionSnapshot(row.id, input)
    : undefined;
  const markdown = documentVersion
    ? prepareVersionedEditableMarkdown(row.markdown, documentVersion)
    : preparePersistedEditableMarkdown(row.id, row.markdown, row.title);
  const generatedMarkdown = row.generated_markdown
    ? (
        documentVersion
          ? prepareVersionedEditableMarkdown(row.generated_markdown, documentVersion)
          : preparePersistedEditableMarkdown(row.id, row.generated_markdown, row.title)
      )
    : null;
  const nextSourceHash = row.source_hash ?? sourceHash ?? null;
  if (
    markdown !== row.markdown
    || generatedMarkdown !== row.generated_markdown
    || nextSourceHash !== row.source_hash
  ) {
    backfillDocumentVersionHistory.run(markdown, generatedMarkdown, nextSourceHash, row.id);
  }
  if (documentVersion) {
    persistDocumentVersion(row.id, input, documentVersion, markdown);
  }
  return {
    ...row,
    markdown,
    generated_markdown: generatedMarkdown,
    source_hash: nextSourceHash
  };
};

const parseSectionCount = (markdown: string): number =>
  Math.max(1, parseDocumentMarkdownSections(markdown).length);
