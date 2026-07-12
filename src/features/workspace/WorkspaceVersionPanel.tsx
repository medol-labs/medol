import { GitCompare, History, RotateCcw, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CreateModelingWorkspaceVersionInput,
  ModelingWorkspaceVersion,
  ModelingWorkspaceVersionSummary
} from '../../contracts/modelingWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '../../components/ui/dialog';
import {
  createWorkspaceVersionDiff,
  type WorkspaceVersionDiff
} from './workspaceVersionDiff';

interface WorkspaceVersionPanelProps {
  activeWorkspaceId?: string;
  activeHeadVersionId?: string;
  versions: ModelingWorkspaceVersionSummary[];
  status: 'loading' | 'ready' | 'offline';
  onCreateVersion: (input: CreateModelingWorkspaceVersionInput) => Promise<ModelingWorkspaceVersionSummary | undefined>;
  onLoadVersion: (versionId: string) => Promise<ModelingWorkspaceVersion | undefined>;
  onRestoreVersion: (versionId: string) => Promise<void>;
}

interface VersionDiffState {
  base: ModelingWorkspaceVersionSummary;
  target: ModelingWorkspaceVersionSummary;
  diff: WorkspaceVersionDiff;
}

export function WorkspaceVersionPanel({
  activeWorkspaceId,
  activeHeadVersionId,
  versions,
  status,
  onCreateVersion,
  onLoadVersion,
  onRestoreVersion
}: WorkspaceVersionPanelProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [releaseEnabled, setReleaseEnabled] = useState(false);
  const [releaseChannel, setReleaseChannel] = useState('preview');
  const [releaseLabel, setReleaseLabel] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [diffState, setDiffState] = useState<VersionDiffState>();

  const versionsById = useMemo(
    () => new Map(versions.map((version) => [version.id, version])),
    [versions]
  );

  useEffect(() => {
    setMessage('');
    setReleaseEnabled(false);
    setReleaseChannel('preview');
    setReleaseLabel('');
    setReleaseNotes('');
    setFeedback(undefined);
    setDiffState(undefined);
  }, [activeWorkspaceId]);

  const createVersion = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || pending) return;

    const input: CreateModelingWorkspaceVersionInput = {
      message: trimmedMessage,
      ...(releaseEnabled ? {
        releaseChannel,
        ...(releaseLabel.trim() ? { releaseLabel: releaseLabel.trim() } : {}),
        ...(releaseNotes.trim() ? { releaseNotes: releaseNotes.trim() } : {})
      } : {})
    };

    setPending(true);
    setFeedback(undefined);
    try {
      const version = await onCreateVersion(input);
      if (version) {
        setMessage('');
        setReleaseLabel('');
        setReleaseNotes('');
        setFeedback(`${version.release ? 'Released' : 'Created'} v${version.versionNo}`);
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

  const showDiff = async (target: ModelingWorkspaceVersionSummary) => {
    const base = target.parentVersionId ? versionsById.get(target.parentVersionId) : undefined;
    if (!base || pending) {
      setFeedback('No parent version available for diff');
      return;
    }

    setPending(true);
    setFeedback(undefined);
    try {
      const [baseVersion, targetVersion] = await Promise.all([
        onLoadVersion(base.id),
        onLoadVersion(target.id)
      ]);
      if (!baseVersion || !targetVersion) {
        setFeedback('Version diff unavailable');
        return;
      }
      setDiffState({
        base,
        target,
        diff: createWorkspaceVersionDiff(baseVersion.dsl, targetVersion.dsl)
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to load version diff');
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
              <DialogDescription className="workspace-version-dialog__description">
                Draft saves stay mutable. Versions are immutable checkpoints; release metadata marks a version as a publishable baseline.
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
              {pending ? 'Working' : releaseEnabled ? 'Release' : 'Create'}
            </button>

            <label className="workspace-version-release-toggle">
              <input
                type="checkbox"
                checked={releaseEnabled}
                onChange={(event) => setReleaseEnabled(event.target.checked)}
                disabled={pending || !activeWorkspaceId}
              />
              <Tag size={13} />
              Release version
            </label>

            {releaseEnabled && (
              <div className="workspace-version-release-fields">
                <select
                  value={releaseChannel}
                  onChange={(event) => setReleaseChannel(event.target.value)}
                  disabled={pending || !activeWorkspaceId}
                  aria-label="Release channel"
                >
                  <option value="preview">preview</option>
                  <option value="beta">beta</option>
                  <option value="stable">stable</option>
                  <option value="deprecated">deprecated</option>
                </select>
                <input
                  value={releaseLabel}
                  onChange={(event) => setReleaseLabel(event.target.value)}
                  placeholder="Release label"
                  maxLength={120}
                  disabled={pending || !activeWorkspaceId}
                />
                <textarea
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                  placeholder="Release notes"
                  maxLength={2000}
                  disabled={pending || !activeWorkspaceId}
                />
              </div>
            )}
          </form>

          {feedback && (
            <p className="workspace-version-feedback">{feedback}</p>
          )}

          <div className="workspace-version-content">
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
                        {version.release && (
                          <span className="workspace-version-item__release">
                            {version.release.channel}
                          </span>
                        )}
                      </div>
                      <p>{version.message}</p>
                      <small>
                        {version.createdAt} · {version.modelHash}
                        {version.release?.label ? ` · ${version.release.label}` : ''}
                      </small>
                    </div>
                    <div className="workspace-version-item__actions">
                      <button
                        type="button"
                        className="workspace-version-restore"
                        onClick={() => void showDiff(version)}
                        disabled={pending || !version.parentVersionId}
                        title={`Diff v${version.versionNo}`}
                      >
                        <GitCompare size={14} />
                        Diff
                      </button>
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
                    </div>
                  </article>
                ))
              )}
            </div>

            {diffState && (
              <section className="workspace-version-diff">
                <header>
                  <div>
                    <strong>{`v${diffState.base.versionNo} -> v${diffState.target.versionNo}`}</strong>
                    <span>
                      +{diffState.diff.addedLines} / -{diffState.diff.removedLines}
                    </span>
                  </div>
                  <button type="button" onClick={() => setDiffState(undefined)}>
                    Close
                  </button>
                </header>
                <pre>
                  {diffState.diff.lines.map((line, index) => (
                    <code
                      key={`${line.kind}:${line.oldLine ?? ''}:${line.newLine ?? ''}:${index}`}
                      className={`is-${line.kind}`}
                    >
                      <span>{line.oldLine ?? ''}</span>
                      <span>{line.newLine ?? ''}</span>
                      <span>{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>
                      <span>{line.text || ' '}</span>
                    </code>
                  ))}
                </pre>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
