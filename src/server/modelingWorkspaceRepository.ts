import { randomUUID } from 'node:crypto';
import type {
  CreateModelingWorkspaceInput,
  CreateModelingWorkspaceVersionInput,
  ModelingWorkspace,
  ModelingWorkspaceVersion,
  ModelingWorkspaceVersionSummary,
  ModelingWorkspaceSummary,
  UpdateModelingWorkspaceInput
} from '../contracts/modelingWorkspace';
import { hashMedolSource } from '../features/documentation/documentReferences';
import { database } from './database';

interface WorkspaceRow {
  id: string;
  name: string;
  dsl: string;
  head_version_id: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceVersionRow {
  id: string;
  workspace_id: string;
  version_no: number;
  parent_version_id: string | null;
  dsl: string;
  model_hash: string;
  message: string;
  author: string | null;
  release_channel: string | null;
  release_label: string | null;
  release_notes: string | null;
  released_at: string | null;
  created_at: string;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS modeling_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dsl TEXT NOT NULL,
    head_version_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS modeling_workspaces_updated_at
  ON modeling_workspaces(updated_at DESC);

  CREATE TABLE IF NOT EXISTS modeling_workspace_versions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    parent_version_id TEXT,
    dsl TEXT NOT NULL,
    model_hash TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    author TEXT,
    release_channel TEXT,
    release_label TEXT,
    release_notes TEXT,
    released_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, version_no)
  );

  CREATE INDEX IF NOT EXISTS modeling_workspace_versions_workspace_created_at
  ON modeling_workspace_versions(workspace_id, created_at DESC, version_no DESC);
`);

ensureWorkspaceHeadVersionColumn();
ensureWorkspaceVersionReleaseColumns();
migrateLegacyDslWorkspaces();
backfillWorkspaceVersions();

const listWorkspacesStatement = database.prepare(`
  SELECT id, name, dsl, head_version_id, created_at, updated_at
  FROM modeling_workspaces
  ORDER BY updated_at DESC, name ASC
`);

const selectWorkspaceStatement = database.prepare(`
  SELECT id, name, dsl, head_version_id, created_at, updated_at
  FROM modeling_workspaces
  WHERE id = ?
`);

const insertWorkspaceStatement = database.prepare(`
  INSERT INTO modeling_workspaces (id, name, dsl, created_at, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateWorkspaceStatement = database.prepare(`
  UPDATE modeling_workspaces
  SET name = ?, dsl = ?, head_version_id = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const updateWorkspaceDslStatement = database.prepare(`
  UPDATE modeling_workspaces
  SET dsl = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const updateWorkspaceHeadVersionStatement = database.prepare(`
  UPDATE modeling_workspaces
  SET head_version_id = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const restoreWorkspaceVersionStatement = database.prepare(`
  UPDATE modeling_workspaces
  SET dsl = ?, head_version_id = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const deleteWorkspaceStatement = database.prepare(`
  DELETE FROM modeling_workspaces
  WHERE id = ?
`);

const deleteWorkspaceVersionsStatement = database.prepare(`
  DELETE FROM modeling_workspace_versions
  WHERE workspace_id = ?
`);

const listWorkspaceVersionsStatement = database.prepare(`
  SELECT id, workspace_id, version_no, parent_version_id, dsl, model_hash, message, author,
    release_channel, release_label, release_notes, released_at, created_at
  FROM modeling_workspace_versions
  WHERE workspace_id = ?
  ORDER BY version_no DESC
`);

const selectWorkspaceVersionStatement = database.prepare(`
  SELECT id, workspace_id, version_no, parent_version_id, dsl, model_hash, message, author,
    release_channel, release_label, release_notes, released_at, created_at
  FROM modeling_workspace_versions
  WHERE workspace_id = ? AND id = ?
`);

const selectLatestWorkspaceVersionStatement = database.prepare(`
  SELECT id, workspace_id, version_no, parent_version_id, dsl, model_hash, message, author,
    release_channel, release_label, release_notes, released_at, created_at
  FROM modeling_workspace_versions
  WHERE workspace_id = ?
  ORDER BY version_no DESC
  LIMIT 1
`);

const insertWorkspaceVersionStatement = database.prepare(`
  INSERT INTO modeling_workspace_versions (
    id,
    workspace_id,
    version_no,
    parent_version_id,
    dsl,
    model_hash,
    message,
    author,
    release_channel,
    release_label,
    release_notes,
    released_at,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

export const listModelingWorkspaces = (): ModelingWorkspaceSummary[] => {
  return (listWorkspacesStatement.all() as WorkspaceRow[]).map(toSummary);
};

export const readModelingWorkspace = (workspaceId: string): ModelingWorkspace | undefined => {
  const row = selectWorkspaceStatement.get(workspaceId) as WorkspaceRow | undefined;
  return row ? toWorkspace(row) : undefined;
};

export const createModelingWorkspace = (
  input: CreateModelingWorkspaceInput
): ModelingWorkspace => {
  const workspaceId = randomUUID();
  database.transaction(() => {
    insertWorkspaceStatement.run(workspaceId, input.name, input.dsl ?? '');
    const version = insertWorkspaceVersion({
      workspaceId,
      versionNo: 1,
      parentVersionId: undefined,
      dsl: input.dsl ?? '',
      message: 'Initial version',
      author: undefined,
      releaseChannel: undefined,
      releaseLabel: undefined,
      releaseNotes: undefined
    });
    updateWorkspaceHeadVersionStatement.run(version.id, workspaceId);
  })();
  return requireWorkspace(workspaceId);
};

export const updateModelingWorkspace = (
  workspaceId: string,
  input: UpdateModelingWorkspaceInput
): ModelingWorkspace | undefined => {
  const current = readModelingWorkspace(workspaceId);
  if (!current) return undefined;

  const nextDsl = input.dsl ?? current.dsl;
  const headVersionId = input.dsl !== undefined && input.dsl !== current.dsl
    ? null
    : current.headVersionId ?? null;

  updateWorkspaceStatement.run(input.name ?? current.name, nextDsl, headVersionId, workspaceId);
  return requireWorkspace(workspaceId);
};

export const removeModelingWorkspace = (workspaceId: string): boolean => {
  return database.transaction(() => {
    deleteWorkspaceVersionsStatement.run(workspaceId);
    return deleteWorkspaceStatement.run(workspaceId).changes > 0;
  })();
};

export const listModelingWorkspaceVersions = (
  workspaceId: string
): ModelingWorkspaceVersionSummary[] => {
  return (listWorkspaceVersionsStatement.all(workspaceId) as WorkspaceVersionRow[])
    .map(toVersionSummary);
};

export const readModelingWorkspaceVersion = (
  workspaceId: string,
  versionId: string
): ModelingWorkspaceVersion | undefined => {
  const row = selectWorkspaceVersionStatement.get(workspaceId, versionId) as
    | WorkspaceVersionRow
    | undefined;
  return row ? toVersion(row) : undefined;
};

export const createModelingWorkspaceVersion = (
  workspaceId: string,
  input: CreateModelingWorkspaceVersionInput
): { workspace: ModelingWorkspace; version: ModelingWorkspaceVersion } | undefined => {
  const current = readModelingWorkspace(workspaceId);
  if (!current) return undefined;

  const sourceDsl = input.dsl ?? current.dsl;
  const createdVersion = database.transaction(() => {
    if (sourceDsl !== current.dsl) {
      updateWorkspaceDslStatement.run(sourceDsl, workspaceId);
    }

    const latest = selectLatestWorkspaceVersionStatement.get(workspaceId) as
      | WorkspaceVersionRow
      | undefined;
    const version = insertWorkspaceVersion({
      workspaceId,
      versionNo: (latest?.version_no ?? 0) + 1,
      parentVersionId: latest?.id,
      dsl: sourceDsl,
      message: input.message?.trim() || `Version ${(latest?.version_no ?? 0) + 1}`,
      author: input.author?.trim() || undefined,
      releaseChannel: input.releaseChannel?.trim() || undefined,
      releaseLabel: input.releaseLabel?.trim() || undefined,
      releaseNotes: input.releaseNotes?.trim() || undefined
    });
    updateWorkspaceHeadVersionStatement.run(version.id, workspaceId);
    return version;
  })();

  return {
    workspace: requireWorkspace(workspaceId),
    version: createdVersion
  };
};

export const restoreModelingWorkspaceVersion = (
  workspaceId: string,
  versionId: string
): ModelingWorkspace | undefined => {
  const version = readModelingWorkspaceVersion(workspaceId, versionId);
  if (!version) return undefined;

  restoreWorkspaceVersionStatement.run(version.dsl, version.id, workspaceId);
  return requireWorkspace(workspaceId);
};

const requireWorkspace = (workspaceId: string): ModelingWorkspace => {
  const workspace = readModelingWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} was not persisted`);
  return workspace;
};

const toSummary = (row: WorkspaceRow): ModelingWorkspaceSummary => ({
  id: row.id,
  name: row.name,
  ...(row.head_version_id ? { headVersionId: row.head_version_id } : {}),
  updatedAt: row.updated_at
});

const toWorkspace = (row: WorkspaceRow): ModelingWorkspace => ({
  ...toSummary(row),
  dsl: row.dsl,
  createdAt: row.created_at
});

const toVersionSummary = (row: WorkspaceVersionRow): ModelingWorkspaceVersionSummary => ({
  id: row.id,
  workspaceId: row.workspace_id,
  versionNo: row.version_no,
  ...(row.parent_version_id ? { parentVersionId: row.parent_version_id } : {}),
  modelHash: row.model_hash,
  message: row.message,
  ...(row.author ? { author: row.author } : {}),
  ...(row.release_channel ? {
    release: {
      channel: row.release_channel,
      ...(row.release_label ? { label: row.release_label } : {}),
      ...(row.release_notes ? { notes: row.release_notes } : {}),
      releasedAt: row.released_at ?? row.created_at
    }
  } : {}),
  createdAt: row.created_at
});

const toVersion = (row: WorkspaceVersionRow): ModelingWorkspaceVersion => ({
  ...toVersionSummary(row),
  dsl: row.dsl
});

const insertWorkspaceVersion = ({
  workspaceId,
  versionNo,
  parentVersionId,
  dsl,
  message,
  author,
  releaseChannel,
  releaseLabel,
  releaseNotes
}: {
  workspaceId: string;
  versionNo: number;
  parentVersionId?: string;
  dsl: string;
  message: string;
  author?: string;
  releaseChannel?: string;
  releaseLabel?: string;
  releaseNotes?: string;
}): ModelingWorkspaceVersion => {
  const versionId = randomUUID();
  insertWorkspaceVersionStatement.run(
    versionId,
    workspaceId,
    versionNo,
    parentVersionId ?? null,
    dsl,
    hashMedolSource(dsl),
    message,
    author ?? null,
    releaseChannel ?? null,
    releaseLabel ?? null,
    releaseNotes ?? null,
    releaseChannel ? new Date().toISOString() : null
  );

  const row = selectWorkspaceVersionStatement.get(workspaceId, versionId) as
    | WorkspaceVersionRow
    | undefined;
  if (!row) throw new Error(`Workspace version ${versionId} was not persisted`);
  return toVersion(row);
};

function ensureWorkspaceHeadVersionColumn(): void {
  const columns = database.prepare('PRAGMA table_info(modeling_workspaces)').all() as Array<{
    name: string;
  }>;
  if (columns.some((column) => column.name === 'head_version_id')) return;
  database.exec('ALTER TABLE modeling_workspaces ADD COLUMN head_version_id TEXT');
}

function ensureWorkspaceVersionReleaseColumns(): void {
  const columns = database.prepare('PRAGMA table_info(modeling_workspace_versions)').all() as Array<{
    name: string;
  }>;
  const columnNames = new Set(columns.map((column) => column.name));
  const columnDefinitions: Array<[string, string]> = [
    ['release_channel', 'TEXT'],
    ['release_label', 'TEXT'],
    ['release_notes', 'TEXT'],
    ['released_at', 'TEXT']
  ];

  for (const [name, type] of columnDefinitions) {
    if (!columnNames.has(name)) {
      database.exec(`ALTER TABLE modeling_workspace_versions ADD COLUMN ${name} ${type}`);
    }
  }
}

function migrateLegacyDslWorkspaces(): void {
  const legacyTable = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'dsl_workspace'
  `).get();
  if (!legacyTable) return;

  database.exec(`
    INSERT OR IGNORE INTO modeling_workspaces (id, name, dsl, head_version_id, created_at, updated_at)
    SELECT
      workspace_id,
      CASE
        WHEN workspace_id = 'default' THEN 'Default workspace'
        ELSE workspace_id
      END,
      dsl,
      NULL,
      updated_at,
      updated_at
    FROM dsl_workspace
  `);
}

function backfillWorkspaceVersions(): void {
  const rows = database.prepare(`
    SELECT workspace.id, workspace.dsl
    FROM modeling_workspaces workspace
    WHERE NOT EXISTS (
      SELECT 1
      FROM modeling_workspace_versions version
      WHERE version.workspace_id = workspace.id
    )
  `).all() as Array<{ id: string; dsl: string }>;

  const insertBackfilledVersion = database.transaction((workspaces: Array<{ id: string; dsl: string }>) => {
    for (const workspace of workspaces) {
      const versionId = randomUUID();
      database.prepare(`
        INSERT INTO modeling_workspace_versions (
          id,
          workspace_id,
          version_no,
          parent_version_id,
          dsl,
          model_hash,
          message,
          author,
          created_at
        )
        VALUES (?, ?, 1, NULL, ?, ?, 'Initial imported version', NULL, CURRENT_TIMESTAMP)
      `).run(versionId, workspace.id, workspace.dsl, hashMedolSource(workspace.dsl));
      database.prepare(`
        UPDATE modeling_workspaces
        SET head_version_id = COALESCE(head_version_id, ?)
        WHERE id = ?
      `).run(versionId, workspace.id);
    }
  });

  insertBackfilledVersion(rows);
}
