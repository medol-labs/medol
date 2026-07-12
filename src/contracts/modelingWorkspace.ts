export interface ModelingWorkspaceSummary {
  id: string;
  name: string;
  headVersionId?: string;
  updatedAt: string;
}

export interface ModelingWorkspace extends ModelingWorkspaceSummary {
  dsl: string;
  createdAt: string;
}

export interface ModelingWorkspaceVersionSummary {
  id: string;
  workspaceId: string;
  versionNo: number;
  parentVersionId?: string;
  modelHash: string;
  message: string;
  author?: string;
  release?: ModelingWorkspaceVersionRelease;
  createdAt: string;
}

export interface ModelingWorkspaceVersion extends ModelingWorkspaceVersionSummary {
  dsl: string;
}

export interface ModelingWorkspaceVersionRelease {
  channel: string;
  label?: string;
  notes?: string;
  releasedAt: string;
}

export interface CreateModelingWorkspaceInput {
  name: string;
  dsl?: string;
}

export interface UpdateModelingWorkspaceInput {
  name?: string;
  dsl?: string;
}

export interface CreateModelingWorkspaceVersionInput {
  message?: string;
  dsl?: string;
  author?: string;
  releaseChannel?: string;
  releaseLabel?: string;
  releaseNotes?: string;
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
  listVersions(
    workspaceId: string,
    signal?: AbortSignal
  ): Promise<ModelingWorkspaceVersionSummary[]>;
  getVersion(
    workspaceId: string,
    versionId: string,
    signal?: AbortSignal
  ): Promise<ModelingWorkspaceVersion>;
  createVersion(
    workspaceId: string,
    input: CreateModelingWorkspaceVersionInput,
    signal?: AbortSignal
  ): Promise<{ workspace: ModelingWorkspace; version: ModelingWorkspaceVersion }>;
  restoreVersion(
    workspaceId: string,
    versionId: string,
    signal?: AbortSignal
  ): Promise<ModelingWorkspace>;
}
