export const agentSliceStatusValues = [
  'unplanned',
  'planned',
  'running',
  'implemented',
  'verified',
  'blocked',
  'manual'
] as const;

export type AgentSliceStatus = typeof agentSliceStatusValues[number];

export interface AgentSliceStatusRecord {
  workspaceId: string;
  sliceId: string;
  contextName: string;
  sliceName: string;
  aggregateName?: string;
  status: AgentSliceStatus;
  updatedAt: string;
}

export interface UpdateAgentSliceStatusInput {
  workspaceId: string;
  sliceId: string;
  contextName: string;
  sliceName: string;
  aggregateName?: string;
  status: AgentSliceStatus;
}

export interface AgentSliceStatusClient {
  list(input: {
    workspaceId: string;
    status?: AgentSliceStatus;
  }, signal?: AbortSignal): Promise<AgentSliceStatusRecord[]>;
  update(input: UpdateAgentSliceStatusInput, signal?: AbortSignal): Promise<AgentSliceStatusRecord | undefined>;
}

export const isAgentSliceStatus = (value: unknown): value is AgentSliceStatus =>
  typeof value === 'string' && (agentSliceStatusValues as readonly string[]).includes(value);
