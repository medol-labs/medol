export interface ModelingWorkspaceSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ModelingWorkspace extends ModelingWorkspaceSummary {
  dsl: string;
  createdAt: string;
}

export interface CreateModelingWorkspaceInput {
  name: string;
  dsl?: string;
}

export interface UpdateModelingWorkspaceInput {
  name?: string;
  dsl?: string;
}

export interface ModelingWorkspaceClient {
  list(signal?: AbortSignal): Promise<ModelingWorkspaceSummary[]>;
  get(workspaceId: string, signal?: AbortSignal): Promise<ModelingWorkspace>;
  create(input: CreateModelingWorkspaceInput, signal?: AbortSignal): Promise<ModelingWorkspace>;
  update(
    workspaceId: string,
    input: UpdateModelingWorkspaceInput,
    signal?: AbortSignal
  ): Promise<ModelingWorkspace>;
  remove(workspaceId: string, signal?: AbortSignal): Promise<void>;
}
