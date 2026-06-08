import type {
  CreateModelingWorkspaceInput,
  ModelingWorkspace,
  ModelingWorkspaceClient,
  ModelingWorkspaceSummary,
  UpdateModelingWorkspaceInput
} from '../../contracts/modelingWorkspace';

export const createHttpModelingWorkspaceClient = (
  baseUrl: string
): ModelingWorkspaceClient => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  return {
    list: async (signal) => {
      const body = await request<{ workspaces: ModelingWorkspaceSummary[] }>(
        `${normalizedBaseUrl}/workspaces`,
        { signal }
      );
      return body.workspaces;
    },
    get: async (workspaceId, signal) => {
      const body = await request<{ workspace: ModelingWorkspace }>(
        workspaceUrl(normalizedBaseUrl, workspaceId),
        { signal }
      );
      return body.workspace;
    },
    create: async (input, signal) => {
      const body = await request<{ workspace: ModelingWorkspace }>(
        `${normalizedBaseUrl}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal
        }
      );
      return body.workspace;
    },
    update: async (workspaceId, input, signal) => {
      const body = await request<{ workspace: ModelingWorkspace }>(
        workspaceUrl(normalizedBaseUrl, workspaceId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal
        }
      );
      return body.workspace;
    },
    remove: async (workspaceId, signal) => {
      await request<void>(workspaceUrl(normalizedBaseUrl, workspaceId), {
        method: 'DELETE',
        signal
      });
    }
  };
};

const configuredBaseUrl = import.meta.env.VITE_WORKSPACE_API_BASE_URL?.trim();

export const modelingWorkspaceClient: ModelingWorkspaceClient = createHttpModelingWorkspaceClient(
  configuredBaseUrl || '/api/modeling'
);

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Workspace request failed with HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const workspaceUrl = (baseUrl: string, workspaceId: string): string => {
  return `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}`;
};
