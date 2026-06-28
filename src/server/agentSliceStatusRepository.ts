import type {
  AgentSliceStatus,
  AgentSliceStatusRecord,
  UpdateAgentSliceStatusInput
} from '../contracts/agentSliceStatus';
import { database } from './database';

interface AgentSliceStatusRow {
  workspace_id: string;
  slice_id: string;
  context_name: string;
  aggregate_name: string | null;
  slice_name: string;
  status: AgentSliceStatus;
  updated_at: string;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS agent_slice_statuses (
    workspace_id TEXT NOT NULL,
    slice_id TEXT NOT NULL,
    context_name TEXT NOT NULL,
    aggregate_name TEXT,
    slice_name TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, slice_id)
  );

  CREATE INDEX IF NOT EXISTS agent_slice_statuses_workspace_status
  ON agent_slice_statuses(workspace_id, status, updated_at DESC);
`);

const listSliceStatusesStatement = database.prepare(`
  SELECT workspace_id, slice_id, context_name, aggregate_name, slice_name, status, updated_at
  FROM agent_slice_statuses
  WHERE workspace_id = ?
  ORDER BY context_name ASC, slice_name ASC
`);

const listSliceStatusesByStatusStatement = database.prepare(`
  SELECT workspace_id, slice_id, context_name, aggregate_name, slice_name, status, updated_at
  FROM agent_slice_statuses
  WHERE workspace_id = ? AND status = ?
  ORDER BY context_name ASC, slice_name ASC
`);

const selectSliceStatusStatement = database.prepare(`
  SELECT workspace_id, slice_id, context_name, aggregate_name, slice_name, status, updated_at
  FROM agent_slice_statuses
  WHERE workspace_id = ? AND slice_id = ?
`);

const upsertSliceStatusStatement = database.prepare(`
  INSERT INTO agent_slice_statuses (
    workspace_id,
    slice_id,
    context_name,
    aggregate_name,
    slice_name,
    status,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(workspace_id, slice_id) DO UPDATE SET
    context_name = excluded.context_name,
    aggregate_name = excluded.aggregate_name,
    slice_name = excluded.slice_name,
    status = excluded.status,
    updated_at = CURRENT_TIMESTAMP
`);

const deleteSliceStatusStatement = database.prepare(`
  DELETE FROM agent_slice_statuses
  WHERE workspace_id = ? AND slice_id = ?
`);

export const listAgentSliceStatuses = (input: {
  workspaceId: string;
  status?: AgentSliceStatus;
}): AgentSliceStatusRecord[] => {
  const rows = input.status
    ? listSliceStatusesByStatusStatement.all(input.workspaceId, input.status)
    : listSliceStatusesStatement.all(input.workspaceId);
  return (rows as AgentSliceStatusRow[]).map(toRecord);
};

export const updateAgentSliceStatus = (
  input: UpdateAgentSliceStatusInput
): AgentSliceStatusRecord | undefined => {
  if (input.status === 'unplanned') {
    deleteSliceStatusStatement.run(input.workspaceId, input.sliceId);
    return undefined;
  }

  upsertSliceStatusStatement.run(
    input.workspaceId,
    input.sliceId,
    input.contextName,
    input.aggregateName?.trim() || null,
    input.sliceName,
    input.status
  );

  return readAgentSliceStatus(input.workspaceId, input.sliceId);
};

export const readAgentSliceStatus = (
  workspaceId: string,
  sliceId: string
): AgentSliceStatusRecord | undefined => {
  const row = selectSliceStatusStatement.get(workspaceId, sliceId) as AgentSliceStatusRow | undefined;
  return row ? toRecord(row) : undefined;
};

const toRecord = (row: AgentSliceStatusRow): AgentSliceStatusRecord => ({
  workspaceId: row.workspace_id,
  sliceId: row.slice_id,
  contextName: row.context_name,
  ...(row.aggregate_name ? { aggregateName: row.aggregate_name } : {}),
  sliceName: row.slice_name,
  status: row.status,
  updatedAt: row.updated_at
});
