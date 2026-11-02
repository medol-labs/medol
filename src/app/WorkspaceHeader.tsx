import { WorkspaceSwitcher } from '../features/workspace/WorkspaceSwitcher';
import { WorkspaceTransfer } from '../features/workspace/WorkspaceTransfer';
import { WorkspaceVersionPanel } from '../features/workspace/WorkspaceVersionPanel';
import type {
  CreateModelingWorkspaceVersionInput,
  ModelingWorkspaceVersion,
  ModelingWorkspaceVersionSummary,
  ModelingWorkspaceSummary
} from '../contracts/modelingWorkspace';
import type { ModelingWorkspace } from '../contracts/modelingWorkspace';
import type {
  WorkspacePersistenceStatus,
  WorkspaceVersionStatus
} from '../features/workspace/useModelingWorkspace';

export interface WorkspaceHeaderProps {
  getDsl: () => string;
  onImported: (workspace: ModelingWorkspace) => Promise<void>;
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
  onRestoreVersion,
  getDsl,
  onImported
}: WorkspaceHeaderProps) {
  return (
    <div className="workspace-header">
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        status={persistenceStatus}
        onSelect={onSelect}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        actions={(
          <>
            <WorkspaceVersionPanel
              activeWorkspaceId={activeWorkspaceId}
              activeHeadVersionId={activeWorkspace?.headVersionId}
              versions={versions}
              status={versionStatus}
              onCreateVersion={onCreateVersion}
              onLoadVersion={onLoadVersion}
              onRestoreVersion={onRestoreVersion}
            />
            <WorkspaceTransfer
              workspaceId={activeWorkspaceId}
              disabled={persistenceStatus === 'loading'}
              getDsl={getDsl}
              onImported={onImported}
            />
          </>
        )}
      />
    </div>
  );
}
