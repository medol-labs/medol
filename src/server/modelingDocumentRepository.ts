import { randomUUID } from 'node:crypto';
import type {
  CreateModelingDocumentInput,
  ModelingDocumentKind,
  ModelingDocument,
  ModelingDocumentSummary,
  ModelingDocumentRevision,
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
  readModelingWorkspaceVersion,
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
  source_association: string | null;
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
  workspace_release_label: string | null;
  created_at: string;
  revision_no: number;
  origin: ModelingDocumentRevision['origin'];
  markdown: string;
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
if (!documentColumns.some((column) => column.name === 'source_association')) {
  documentDatabase.exec('ALTER TABLE modeling_documents ADD COLUMN source_association TEXT');
}

const versionColumns = documentDatabase.prepare('PRAGMA table_info(modeling_document_versions)')
  .all() as Array<{ name: string }>;
documentDatabase.transaction(() => {
  if (!versionColumns.some((column) => column.name === 'revision_no')) {
    documentDatabase.exec(`
      ALTER TABLE modeling_document_versions ADD COLUMN revision_no INTEGER;
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at, rowid) AS number
        FROM modeling_document_versions
      )
      UPDATE modeling_document_versions SET revision_no = (
        SELECT number FROM numbered WHERE numbered.id = modeling_document_versions.id
      );
    `);
  }
  if (!versionColumns.some((column) => column.name === 'origin')) {
    documentDatabase.exec("ALTER TABLE modeling_document_versions ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy'");
  }
  if (!versionColumns.some((column) => column.name === 'workspace_release_label')) {
    documentDatabase.exec('ALTER TABLE modeling_document_versions ADD COLUMN workspace_release_label TEXT');
    const rows = documentDatabase.prepare(`
      SELECT id, workspace_id, workspace_version_id FROM modeling_document_versions
      WHERE workspace_version_id IS NOT NULL
    `).all() as Array<{ id: string; workspace_id: string; workspace_version_id: string }>;
    const updateLabel = documentDatabase.prepare('UPDATE modeling_document_versions SET workspace_release_label = ? WHERE id = ?');
    for (const row of rows) {
      const label = readModelingWorkspaceVersion(row.workspace_id, row.workspace_version_id)?.release?.label;
      if (label) updateLabel.run(label, row.id);
    }
  }
  documentDatabase.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS modeling_document_versions_revision
    ON modeling_document_versions(document_id, revision_no);
  `);
})();

const listDocuments = documentDatabase.prepare(`
  SELECT *
  FROM modeling_documents
  WHERE workspace_id = ?
  ORDER BY updated_at DESC, title ASC
`);

const selectDocument = documentDatabase.prepare(`
  SELECT *
  FROM modeling_documents
  WHERE id = ?
`);

const selectMatchingDocument = documentDatabase.prepare(`
  SELECT *
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
    workspace_version_id, workspace_version_no, workspace_version_message, workspace_release_label, markdown, revision_no, origin, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

const updateSourceAssociation = documentDatabase.prepare(`
  UPDATE modeling_documents SET source_association = ? WHERE id = ?
`);

const listDocumentVersions = documentDatabase.prepare(`
  SELECT id, document_id, workspace_id, title, kind, language, source_hash,
    workspace_version_id, workspace_version_no, workspace_version_message, workspace_release_label, markdown, revision_no, origin, created_at
  FROM modeling_document_versions
  WHERE document_id = ?
  ORDER BY COALESCE(revision_no, 0) ASC, created_at ASC, rowid ASC
`);

const selectLatestDocumentVersionMetadata = documentDatabase.prepare(`
  SELECT revision_no, workspace_version_id, workspace_version_no, workspace_release_label
  FROM modeling_document_versions
  WHERE document_id = ?
  ORDER BY revision_no DESC, created_at DESC, rowid DESC
  LIMIT 1
`);

const selectLatestDocumentVersion = documentDatabase.prepare(`
  SELECT * FROM modeling_document_versions
  WHERE document_id = ?
  ORDER BY revision_no DESC, created_at DESC, rowid DESC
  LIMIT 1
`);

const countDocumentsForWorkspace = documentDatabase.prepare(`
  SELECT COUNT(*) AS count
  FROM modeling_documents
  WHERE workspace_id = ?
`);

const listDocumentWorkspaceGroups = documentDatabase.prepare(`
  SELECT workspace_id AS workspaceId, COUNT(*) AS count, MAX(updated_at) AS updatedAt
  FROM modeling_documents
  GROUP BY workspace_id
  ORDER BY count DESC, updatedAt DESC
`);

const reassignDocumentsToWorkspace = documentDatabase.prepare(`
  UPDATE modeling_documents
  SET workspace_id = ?, updated_at = CURRENT_TIMESTAMP
  WHERE workspace_id = ?
`);

const reassignDocumentVersionsToWorkspace = documentDatabase.prepare(`
  UPDATE modeling_document_versions
  SET workspace_id = ?
  WHERE workspace_id = ?
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

export const listModelingDocuments = (workspaceId: string): ModelingDocumentSummary[] => {
  recoverOrphanDocumentsForWorkspace(workspaceId);
  return (listDocuments.all(workspaceId) as DocumentRow[]).map(ensureDocumentReferences).map(toSummary);
};

export const readModelingDocument = (documentId: string): ModelingDocument | undefined => {
  const row = selectDocument.get(documentId) as DocumentRow | undefined;
  return row ? toDocument(ensureDocumentReferences(row)) : undefined;
};

export const createModelingDocument = (
  input: CreateModelingDocumentInput
): ModelingDocument => documentDatabase.transaction(() => {
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
    } else {
      persistSourceAssociation(prepared.id, input);
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
  } else {
    persistSourceAssociation(documentId, input);
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
})();

export const updateModelingDocument = (
  documentId: string,
  input: UpdateModelingDocumentInput
): ModelingDocument | undefined => documentDatabase.transaction(() => {
  const current = readModelingDocument(documentId);
  if (!current) return undefined;
  if (supportsDocumentVersionHistory(current.kind)) {
    const versionInput: CreateModelingDocumentInput = {
      ...current,
      title: input.title ?? current.title,
      markdown: input.markdown ?? current.markdown
    };
    const previous = readLatestDocumentVersion(documentId);
    const version = createDocumentVersionSnapshot(documentId, versionInput);
    if (previous) {
      version.workspace_version_id = previous.workspace_version_id;
      version.workspace_version_no = previous.workspace_version_no;
      version.workspace_version_message = previous.workspace_version_message;
      version.workspace_release_label = previous.workspace_release_label;
    }
    version.origin = 'manual';
    const markdown = prepareVersionedEditableMarkdown(versionInput.markdown, version);
    updateDocument.run(versionInput.title, markdown, documentId);
    persistDocumentVersion(documentId, versionInput, version, markdown);
  } else {
    updateDocument.run(input.title ?? current.title, input.markdown ?? current.markdown, documentId);
  }
  return requireDocument(documentId);
})();

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

const recoverOrphanDocumentsForWorkspace = (workspaceId: string): void => {
  if (!readModelingWorkspace(workspaceId)) return;
  const current = countDocumentsForWorkspace.get(workspaceId) as { count: number } | undefined;
  if ((current?.count ?? 0) > 0) return;

  const orphanGroups = (listDocumentWorkspaceGroups.all() as Array<{
    workspaceId: string;
    count: number;
    updatedAt: string | null;
  }>).filter((group) =>
    group.workspaceId !== workspaceId
    && !readModelingWorkspace(group.workspaceId)
    && group.count > 0
  );

  if (orphanGroups.length !== 1) return;

  documentDatabase.transaction(() => {
    reassignDocumentsToWorkspace.run(workspaceId, orphanGroups[0].workspaceId);
    reassignDocumentVersionsToWorkspace.run(workspaceId, orphanGroups[0].workspaceId);
  })();
};

const toSummary = (row: DocumentRow): ModelingDocumentSummary => {
  const version = supportsDocumentVersionHistory(row.kind) ? selectLatestDocumentVersionMetadata.get(row.id) as Pick<
    DocumentVersionRow, 'revision_no' | 'workspace_version_id' | 'workspace_version_no' | 'workspace_release_label'
  > | undefined : row.source_association ? JSON.parse(row.source_association) as DocumentVersionRow : undefined;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    kind: row.kind,
    language: row.language,
    sourceRefs: extractDocumentSourceRefs(row.markdown),
    ...(row.source_hash ? { sourceHash: row.source_hash } : {}),
    ...(supportsDocumentVersionHistory(row.kind)
      ? { revisionNo: version?.revision_no ?? 0 }
      : {}),
    ...(version?.workspace_version_id ? { workspaceVersionId: version.workspace_version_id } : {}),
    ...(version?.workspace_version_no != null ? { workspaceVersionNo: version.workspace_version_no } : {}),
    ...(version?.workspace_release_label ? { workspaceReleaseLabel: version.workspace_release_label } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const toDocument = (row: DocumentRow): ModelingDocument => ({
  ...toSummary(row),
  markdown: row.markdown,
  ...(supportsDocumentVersionHistory(row.kind) ? {
    revisions: readDocumentVersionRows(row.id).map((version) => ({
      id: version.id,
      revisionNo: version.revision_no,
      origin: version.origin,
      title: version.title,
      markdown: version.markdown,
      ...(version.source_hash ? { sourceHash: version.source_hash } : {}),
      ...(version.workspace_version_id ? { workspaceVersionId: version.workspace_version_id } : {}),
      ...(version.workspace_version_no != null ? { workspaceVersionNo: version.workspace_version_no } : {}),
      ...(version.workspace_version_message ? { workspaceVersionMessage: version.workspace_version_message } : {}),
      ...(version.workspace_release_label ? { workspaceReleaseLabel: version.workspace_release_label } : {}),
      createdAt: version.created_at
    }))
  } : {})
});

const documentVersionHistorySectionId = 'document.version-history';
const documentBodySectionId = 'document.body';
const documentPageBreakPattern =
  /(?:<!--\s*medol:pagebreak\s*-->|<div\s+style="page-break-before:\s*always;">\s*<\/div>)/giu;

const supportsDocumentVersionHistory = (kind: ModelingDocumentKind): boolean =>
  kind !== 'model-translations';

const readDocumentVersionRows = (documentId: string): DocumentVersionRow[] =>
  listDocumentVersions.all(documentId) as DocumentVersionRow[];

const readLatestDocumentVersion = (documentId: string): DocumentVersionRow | undefined =>
  selectLatestDocumentVersion.get(documentId) as DocumentVersionRow | undefined;

const createDocumentVersionSnapshot = (
  documentId: string,
  input: CreateModelingDocumentInput,
  bindSource = true
): DocumentVersionRow => {
  const matchingVersions = bindSource && input.sourceHash
    ? listModelingWorkspaceVersions(input.workspaceId)
        .filter((version) => version.modelHash === input.sourceHash)
    : [];
  const headVersionId = readModelingWorkspace(input.workspaceId)?.headVersionId;
  const workspaceVersion = matchingVersions.find((version) => version.id === headVersionId)
    ?? matchingVersions[0];
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
    workspace_release_label: workspaceVersion?.release?.label ?? null,
    revision_no: (readLatestDocumentVersion(documentId)?.revision_no ?? 0) + 1,
    origin: 'generated',
    markdown: input.markdown,
    created_at: new Date().toISOString()
  };
};

// Catalogs retain generation provenance without exposing document revision history.
const persistSourceAssociation = (documentId: string, input: CreateModelingDocumentInput): void => {
  const snapshot = createDocumentVersionSnapshot(documentId, input);
  updateSourceAssociation.run(JSON.stringify({
    source_hash: snapshot.source_hash,
    workspace_version_id: snapshot.workspace_version_id,
    workspace_version_no: snapshot.workspace_version_no,
    workspace_release_label: snapshot.workspace_release_label
  }), documentId);
};

const persistDocumentVersion = (
  documentId: string,
  input: CreateModelingDocumentInput,
  version: DocumentVersionRow,
  markdown: string
): void => {
  const previous = readLatestDocumentVersion(documentId);
  if (previous
    && previous.title === input.title
    && stripDocumentVersionHistory(previous.markdown, previous.title) === stripDocumentVersionHistory(markdown, input.title)
    && previous.source_hash === (input.sourceHash ?? null)
    && previous.workspace_version_id === version.workspace_version_id
    && previous.workspace_release_label === version.workspace_release_label) return;
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
    version.workspace_release_label,
    markdown,
    version.revision_no,
    version.origin,
    version.created_at
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
  const version = readLatestDocumentVersion(documentId);
  if (!version) return stripDocumentVersionHistory(markdown, title);
  return stripDocumentVersionHistory(numberMarkdownHeadings(markdown, version.language), title);
};

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
  if (!workspace?.dsl || row.source_hash !== hashMedolSource(workspace.dsl)) {
    return ensureDocumentVersionRows(row);
  }

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
  const sourceHash = row.source_hash;
  const prepared = {
    ...row,
    markdown,
    generated_markdown: row.generated_markdown ?? markdown,
    source_hash: sourceHash
  };
  if (markdown !== row.markdown) {
    backfillDocument.run(markdown, markdown, sourceHash, row.id);
  }
  return ensureDocumentVersionRows(prepared);
};

const ensureDocumentVersionRows = (
  row: DocumentRow
): DocumentRow => {
  if (!supportsDocumentVersionHistory(row.kind)) {
    return row;
  }
  const previous = readLatestDocumentVersion(row.id);
  const sourceHash = row.source_hash;
  const input: CreateModelingDocumentInput = {
    workspaceId: row.workspace_id,
    title: row.title,
    kind: row.kind,
    language: row.language,
    markdown: row.markdown,
    ...(sourceHash ? { sourceHash } : {})
  };
  const documentVersion = !previous
    || previous.title !== row.title
    || stripDocumentVersionHistory(previous.markdown, previous.title)
      !== preparePersistedEditableMarkdown(row.id, row.markdown, row.title)
    || previous.source_hash !== (sourceHash ?? null)
    ? createDocumentVersionSnapshot(row.id, input, false)
    : undefined;
  if (documentVersion) {
    documentVersion.origin = 'legacy';
    if (previous && previous.source_hash === documentVersion.source_hash) {
      documentVersion.workspace_version_id = previous.workspace_version_id;
      documentVersion.workspace_version_no = previous.workspace_version_no;
      documentVersion.workspace_version_message = previous.workspace_version_message;
      documentVersion.workspace_release_label = previous.workspace_release_label;
    }
  }
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
