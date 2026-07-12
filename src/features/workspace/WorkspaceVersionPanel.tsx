import { History, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ModelingWorkspaceVersionSummary } from '../../contracts/modelingWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '../../components/ui/dialog';

interface WorkspaceVersionPanelProps {
  activeWorkspaceId?: string;
  activeHeadVersionId?: string;
  versions: ModelingWorkspaceVersionSummary[];
  status: 'loading' | 'ready' | 'offline';
  onCreateVersion: (message: string) => Promise<ModelingWorkspaceVersionSummary | undefined>;
  onRestoreVersion: (versionId: string) => Promise<void>;
}

export function WorkspaceVersionPanel({
  activeWorkspaceId,
  activeHeadVersionId,
  versions,
  status,
  onCreateVersion,
  onRestoreVersion
}: WorkspaceVersionPanelProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string>();

  useEffect(() => {
    setMessage('');
    setFeedback(undefined);
  }, [activeWorkspaceId]);

  const createVersion = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || pending) return;

    setPending(true);
    setFeedback(undefined);
    try {
      const version = await onCreateVersion(trimmedMessage);
      if (version) {
        setMessage('');
        setFeedback(`Created v${version.versionNo}`);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to create version');
    } finally {
      setPending(false);
    }
  };

  const restoreVersion = async (version: ModelingWorkspaceVersionSummary) => {
    if (pending) return;
    if (typeof window !== 'undefined' && !window.confirm(`Restore v${version.versionNo}?`)) {
      return;
    }

    setPending(true);
    setFeedback(undefined);
    try {
      await onRestoreVersion(version.id);
      setFeedback(`Restored v${version.versionNo}`);
      setOpen(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to restore version');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="workspace-version-trigger"
        onClick={() => setOpen(true)}
        disabled={!activeWorkspaceId}
        title="Version history"
      >
        <History size={14} />
        Versions
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="workspace-version-dialog">
          <div className="workspace-version-dialog__header">
            <div>
              <DialogTitle className="workspace-version-dialog__title">
                Version History
              </DialogTitle>
              <DialogDescription className="sr-only">
                Draft saves stay mutable; versions are immutable snapshots.
              </DialogDescription>
            </div>
          </div>

          <form
            className="workspace-version-create"
            onSubmit={(event) => {
              event.preventDefault();
              void createVersion();
            }}
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Version message"
              maxLength={500}
              disabled={pending || !activeWorkspaceId}
            />
            <button
              type="submit"
              disabled={pending || !activeWorkspaceId || !message.trim()}
            >
              {pending ? 'Working' : 'Create'}
            </button>
          </form>

          {feedback && (
            <p className="workspace-version-feedback">{feedback}</p>
          )}

          <div className="workspace-version-list">
            {status === 'loading' ? (
              <p className="workspace-version-empty">Loading versions</p>
            ) : status === 'offline' ? (
              <p className="workspace-version-empty">Version history unavailable</p>
            ) : versions.length === 0 ? (
              <p className="workspace-version-empty">No versions</p>
            ) : (
              versions.map((version) => (
                <article key={version.id} className="workspace-version-item">
                  <div className="workspace-version-item__body">
                    <div className="workspace-version-item__title">
                      <strong>v{version.versionNo}</strong>
                      {version.id === activeHeadVersionId && <span>Current</span>}
                    </div>
                    <p>{version.message}</p>
                    <small>
                      {version.createdAt} · {version.modelHash}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="workspace-version-restore"
                    onClick={() => void restoreVersion(version)}
                    disabled={pending || version.id === activeHeadVersionId}
                    title={`Restore v${version.versionNo}`}
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
