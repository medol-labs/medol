import { Search } from 'lucide-react';
import { WorkspaceHeader, type WorkspaceHeaderProps } from './WorkspaceHeader';

interface EditorToolbarProps extends WorkspaceHeaderProps {
  onSearch: () => void;
  onOpenPreviewPage: () => void;
}

interface EditorPaneHeaderProps extends WorkspaceHeaderProps {
  onCollapse: () => void;
}

export function EditorToolbar({
  onSearch,
  onOpenPreviewPage,
  ...workspaceHeaderProps
}: EditorToolbarProps) {
  return (
    <header className="studio-toolbar">
      <WorkspaceHeader {...workspaceHeaderProps} />
      <div className="toolbar-actions">
        <div className="toolbar-view-controls">
          <button
            type="button"
            className="direction-toggle"
            onClick={onSearch}
            title="Search model (Cmd/Ctrl+K)"
          >
            <Search size={14} />
            Search
          </button>
          <button
            type="button"
            className="direction-toggle"
            onClick={onOpenPreviewPage}
            title="Open preview in a separate page"
          >
            Preview
          </button>
        </div>
      </div>
    </header>
  );
}

export function EditorPaneHeader({
  onCollapse,
  ...workspaceHeaderProps
}: EditorPaneHeaderProps) {
  return (
    <header className="pane-header pane-header--inline">
      <WorkspaceHeader {...workspaceHeaderProps} />
      <button type="button" className="collapse-button" onClick={onCollapse}>Hide</button>
    </header>
  );
}
