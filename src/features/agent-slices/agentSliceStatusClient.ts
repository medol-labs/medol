import type {
  AgentSliceStatus,
  AgentSliceStatusClient,
  AgentSliceStatusRecord,
  UpdateAgentSliceStatusInput
} from '../../contracts/agentSliceStatus';

const defaultBaseUrl = '/api/agent';

export const createAgentSliceStatusClient = (
  baseUrl = defaultBaseUrl
): AgentSliceStatusClient => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return {
    list: async (input, signal) => {
      const searchParams = new URLSearchParams({ workspaceId: input.workspaceId });
      if (input.status) searchParams.set('status', input.status);
      const body = await request<{ slices: AgentSliceStatusRecord[] }>(
        `${normalizedBaseUrl}/slice-statuses?${searchParams}`,
        { signal }
      );
      return body.slices;
    },
    update: async (input, signal) => {
      const body = await request<{ slice?: AgentSliceStatusRecord }>(
        `${normalizedBaseUrl}/slice-statuses`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal
        }
      );
      return body.slice;
    }
  };
};

export const agentSliceStatusClient = createAgentSliceStatusClient();

export type AgentSliceStatusMap = Record<string, AgentSliceStatus>;

export const toAgentSliceStatusMap = (
  records: AgentSliceStatusRecord[]
): AgentSliceStatusMap => Object.fromEntries(records.map((record) => [record.sliceId, record.status]));

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  if (!response.ok) {
    throw new Error(body?.error ?? `Agent slice status request failed with HTTP ${response.status}`);
  }
  return body as T;
};

export type { AgentSliceStatus, UpdateAgentSliceStatusInput };
