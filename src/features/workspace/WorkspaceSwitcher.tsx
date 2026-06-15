import { useEffect, useState } from 'react';
import { Check, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import type { ModelingWorkspaceSummary } from '../../contracts/modelingWorkspace';
import type { WorkspacePersistenceStatus } from './useModelingWorkspace';

interface WorkspaceSwitcherProps {
  workspaces: ModelingWorkspaceSummary[];
  activeWorkspaceId?: string;
  status: WorkspacePersistenceStatus;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  status,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: WorkspaceSwitcherProps) {
  const [mode, setMode] = useState<'create' | 'rename'>();
  const [name, setName] = useState('');
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  useEffect(() => {
    if (mode === 'rename') setName(activeWorkspace?.name ?? '');
  }, [activeWorkspace?.name, mode]);

  const submit = () => {
    const nextName = name.trim();
    if (!nextName) return;
    if (mode === 'create') onCreate(nextName);
    if (mode === 'rename') onRename(nextName);
    setMode(undefined);
    setName('');
  };

  return (
    <div className="workspace-switcher">
      <div className="workspace-switcher__row">
        <select
          value={activeWorkspaceId ?? ''}
          disabled={status === 'loading' || workspaces.length === 0}
          aria-label="Modeling workspace"
          title={activeWorkspace?.name}
          onChange={(event) => onSelect(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Create workspace"
          title="Create workspace"
          disabled={status === 'loading'}
          onClick={() => {
            setMode('create');
            setName('');
          }}
        >
          <FolderPlus size={15} />
        </button>
        <button
          type="button"
          aria-label="Rename workspace"
          title="Rename workspace"
          disabled={!activeWorkspace || status === 'loading'}
          onClick={() => setMode('rename')}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          aria-label="Delete workspace"
          title="Delete workspace"
          disabled={!activeWorkspace || workspaces.length <= 1 || status === 'loading'}
          onClick={() => {
            if (window.confirm(`Delete workspace "${activeWorkspace?.name}"?`)) onDelete();
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {mode && (
        <div className="workspace-switcher__form">
          <input
            autoFocus
            value={name}
            maxLength={120}
            aria-label={mode === 'create' ? 'New workspace name' : 'Workspace name'}
            placeholder={mode === 'create' ? 'New workspace' : 'Workspace name'}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') setMode(undefined);
            }}
          />
          <button type="button" aria-label="Confirm workspace name" onClick={submit}>
            <Check size={14} />
          </button>
          <button type="button" aria-label="Cancel workspace edit" onClick={() => setMode(undefined)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
