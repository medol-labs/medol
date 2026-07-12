import { WorkspaceSwitcher } from '../features/workspace/WorkspaceSwitcher';
import { WorkspaceVersionPanel } from '../features/workspace/WorkspaceVersionPanel';
import type {
  CreateModelingWorkspaceVersionInput,
  ModelingWorkspaceVersion,
  ModelingWorkspaceVersionSummary,
  ModelingWorkspaceSummary
} from '../contracts/modelingWorkspace';
import type {
  WorkspacePersistenceStatus,
  WorkspaceVersionStatus
} from '../features/workspace/useModelingWorkspace';

export interface WorkspaceHeaderProps {
  workspaces: ModelingWorkspaceSummary[];
  activeWorkspaceId?: string;
  activeWorkspace?: ModelingWorkspaceSummary;
  versions: ModelingWorkspaceVersionSummary[];
  persistenceStatus: WorkspacePersistenceStatus;
  versionStatus: WorkspaceVersionStatus;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateVersion: (input: CreateModelingWorkspaceVersionInput) => Promise<ModelingWorkspaceVersionSummary | undefined>;
  onLoadVersion: (versionId: string) => Promise<ModelingWorkspaceVersion | undefined>;
  onRestoreVersion: (versionId: string) => Promise<void>;
}

export function WorkspaceHeader({
  workspaces,
  activeWorkspaceId,
  activeWorkspace,
  versions,
  persistenceStatus,
  versionStatus,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onCreateVersion,
  onLoadVersion,
  onRestoreVersion
}: WorkspaceHeaderProps) {
  return (
    <div className="workspace-header">
      <p className="eyebrow">Workspace</p>
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        status={persistenceStatus}
        onSelect={onSelect}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />
      <WorkspaceVersionPanel
        activeWorkspaceId={activeWorkspaceId}
        activeHeadVersionId={activeWorkspace?.headVersionId}
        versions={versions}
        status={versionStatus}
        onCreateVersion={onCreateVersion}
        onLoadVersion={onLoadVersion}
        onRestoreVersion={onRestoreVersion}
      />
    </div>
  );
}
