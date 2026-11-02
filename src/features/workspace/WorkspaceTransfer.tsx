import { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import type { ModelingWorkspace } from '../../contracts/modelingWorkspace';

const baseUrl = import.meta.env.VITE_WORKSPACE_API_BASE_URL?.trim().replace(/\/+$/, '') || '/api/modeling';
const limit = 64 * 1024 * 1024;

export function WorkspaceTransfer({ workspaceId, disabled, getDsl, onImported }: {
  workspaceId?: string;
  disabled: boolean;
  getDsl: () => string;
  onImported: (workspace: ModelingWorkspace) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const transfer = async (file?: File) => {
    setBusy(true);
    setError(undefined);
    try {
      if (file && file.size > limit) throw new Error('Workspace archive exceeds 64 MiB.');
      const body = file ? await file.text() : JSON.stringify({ dsl: getDsl() });
      const response = await fetch(`${baseUrl}/workspace-archive${file ? '' : `?workspaceId=${encodeURIComponent(workspaceId!)}`}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Workspace transfer failed.');
      if (file) {
        await onImported(result.workspace);
      } else {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        if (blob.size > limit) throw new Error('Workspace archive exceeds 64 MiB.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${result.workspace.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'workspace'}.medol-workspace.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Workspace transfer failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return <div className="workspace-switcher workspace-transfer" aria-busy={busy}>
    <div className="workspace-switcher__row">
      <button type="button" title="Export workspace (save document edits first)" aria-label="Export workspace"
        disabled={disabled || busy || !workspaceId} onClick={() => void transfer()}><Download size={15} /></button>
      <button type="button" title="Import workspace as a new copy" aria-label="Import workspace"
        disabled={disabled || busy} onClick={() => input.current?.click()}><Upload size={15} /></button>
      <input ref={input} type="file" accept=".json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void transfer(file);
      }} />
    </div>
    {busy && <span role="status" className="workspace-transfer__notice">Transferring…</span>}
    {error && <div role="alert" className="workspace-transfer__notice workspace-transfer__error">
      <span>{error}</span>
      <button type="button" title="Dismiss error" aria-label="Dismiss transfer error" onClick={() => setError(undefined)}><X size={14} /></button>
    </div>}
  </div>;
}
