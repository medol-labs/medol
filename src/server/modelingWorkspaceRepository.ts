import { randomUUID } from 'node:crypto';
import type {
  CreateModelingWorkspaceInput,
  ModelingWorkspace,
  ModelingWorkspaceSummary,
  UpdateModelingWorkspaceInput
} from '../contracts/modelingWorkspace';
import { database } from './database';

interface WorkspaceRow {
  id: string;
  name: string;
  dsl: string;
  created_at: string;
  updated_at: string;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS modeling_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dsl TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS modeling_workspaces_updated_at
  ON modeling_workspaces(updated_at DESC);
`);

migrateLegacyDslWorkspaces();

const listWorkspacesStatement = database.prepare(`
  SELECT id, name, dsl, created_at, updated_at
  FROM modeling_workspaces
  ORDER BY updated_at DESC, name ASC
`);

const selectWorkspaceStatement = database.prepare(`
  SELECT id, name, dsl, created_at, updated_at
  FROM modeling_workspaces
  WHERE id = ?
`);

const insertWorkspaceStatement = database.prepare(`
  INSERT INTO modeling_workspaces (id, name, dsl, created_at, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateWorkspaceStatement = database.prepare(`
  UPDATE modeling_workspaces
  SET name = ?, dsl = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const deleteWorkspaceStatement = database.prepare(`
  DELETE FROM modeling_workspaces
  WHERE id = ?
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
  insertWorkspaceStatement.run(workspaceId, input.name, input.dsl ?? '');
  return requireWorkspace(workspaceId);
};

export const updateModelingWorkspace = (
  workspaceId: string,
  input: UpdateModelingWorkspaceInput
): ModelingWorkspace | undefined => {
  const current = readModelingWorkspace(workspaceId);
  if (!current) return undefined;

  updateWorkspaceStatement.run(
    input.name ?? current.name,
    input.dsl ?? current.dsl,
    workspaceId
  );
  return requireWorkspace(workspaceId);
};

export const removeModelingWorkspace = (workspaceId: string): boolean => {
  return deleteWorkspaceStatement.run(workspaceId).changes > 0;
};

const requireWorkspace = (workspaceId: string): ModelingWorkspace => {
  const workspace = readModelingWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} was not persisted`);
  return workspace;
};

const toSummary = (row: WorkspaceRow): ModelingWorkspaceSummary => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at
});

const toWorkspace = (row: WorkspaceRow): ModelingWorkspace => ({
  ...toSummary(row),
  dsl: row.dsl,
  createdAt: row.created_at
});

function migrateLegacyDslWorkspaces(): void {
  const legacyTable = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'dsl_workspace'
  `).get();
  if (!legacyTable) return;

  database.exec(`
    INSERT OR IGNORE INTO modeling_workspaces (id, name, dsl, created_at, updated_at)
    SELECT
      workspace_id,
      CASE
        WHEN workspace_id = 'default' THEN 'Default workspace'
        ELSE workspace_id
      END,
      dsl,
      updated_at,
      updated_at
    FROM dsl_workspace
  `);
}
