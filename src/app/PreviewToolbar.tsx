import { Search } from 'lucide-react';
import { OverflowText } from '../components/ui/overflow-text';
import type { DocumentationLanguage } from '../lib/generators/documentation';
import type { PreviewMode, ToolbarAction } from './studioTypes';

const toolbarActionTitles: Record<ToolbarAction, string> = {
  'em-model': 'Export EmModel',
  'codegen-model': 'Export CodegenModel',
  config: 'Export config',
  png: 'Export PNG',
  svg: 'Export SVG',
  'prd-ai': 'Generate PRD',
  'software-design-ai': 'Generate software design',
  'database-design-ai': 'Generate database design',
  'process-ai': 'Generate process document',
  'model-translations': 'Generate model translations',
  'download-translations': 'Download model translations',
  reset: 'Reset MEDOL'
};

interface PreviewToolbarProps {
  previewOnly: boolean;
  eyebrow: string;
  title: string;
  previewMode: PreviewMode;
  toolbarAction: ToolbarAction | '';
  toolbarActionPending: boolean;
  documentationLanguage: DocumentationLanguage;
  layoutDirection: 'ltr' | 'rtl';
  onSearch: () => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onToolbarActionChange: (action: ToolbarAction | '') => void;
  onDocumentationLanguageChange: (language: DocumentationLanguage) => void;
  onToggleLayoutDirection: () => void;
  onOpenPreviewPage: () => void;
  onOpenEditorPage: () => void;
  onRunToolbarAction: () => void;
}

export function PreviewToolbar({
  previewOnly,
  eyebrow,
  title,
  previewMode,
  toolbarAction,
  toolbarActionPending,
  documentationLanguage,
  layoutDirection,
  onSearch,
  onPreviewModeChange,
  onToolbarActionChange,
  onDocumentationLanguageChange,
  onToggleLayoutDirection,
  onOpenPreviewPage,
  onOpenEditorPage,
  onRunToolbarAction
}: PreviewToolbarProps) {
  return (
    <header className="studio-toolbar">
      <div>
        <OverflowText as="p" className="eyebrow" text={eyebrow} />
        <OverflowText as="h1" text={title} />
      </div>
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
          <select
            className="preview-mode-select"
            value={previewMode}
            onChange={(event) => onPreviewModeChange(event.target.value as PreviewMode)}
            aria-label="Preview mode"
          >
            <option value="canvas">Model Canvas</option>
            <option value="global">Domain Map</option>
            <option value="layout">UI Preview</option>
            <option value="documents">Documents</option>
          </select>
        </div>
        <div className="toolbar-utility-controls">
          {!previewOnly && (
            <button
              type="button"
              className="direction-toggle"
              onClick={onToggleLayoutDirection}
              title="Toggle layout direction"
            >
              {layoutDirection.toUpperCase()}
            </button>
          )}
          {!previewOnly && (
            <button
              type="button"
              className="direction-toggle"
              onClick={onOpenPreviewPage}
              title="Open preview in a separate page"
            >
              Preview
            </button>
          )}
          <button
            type="button"
            className="direction-toggle"
            onClick={onOpenEditorPage}
            title="Open editor in a separate page"
          >
            Editor
          </button>
        </div>
        {!previewOnly && (
          <div className="toolbar-command-controls">
            <select
              className="toolbar-action-select"
              value={toolbarAction}
              onChange={(event) => onToolbarActionChange(event.target.value as ToolbarAction | '')}
              aria-label="Toolkit action"
              title={toolbarAction ? toolbarActionTitles[toolbarAction] : 'Choose toolkit action'}
            >
              <option value="" disabled>Choose action</option>
              <option value="em-model">EmModel JSON</option>
              <option value="codegen-model">Codegen JSON</option>
              <option value="config">Config JSON</option>
              <option value="png">Export PNG</option>
              <option value="svg">Export SVG</option>
              <option value="prd-ai">PRD</option>
              <option value="software-design-ai">Software design</option>
              <option value="database-design-ai">Database design</option>
              <option value="process-ai">Process doc</option>
              <option value="model-translations">Translate model</option>
              <option value="download-translations">Download i18n</option>
              <option value="reset">Reset MEDOL</option>
            </select>
            <select
              className="toolbar-language-select"
              value={documentationLanguage}
              onChange={(event) => onDocumentationLanguageChange(event.target.value as DocumentationLanguage)}
              aria-label="Document language"
              title="Document language"
            >
              <option value="en">EN</option>
              <option value="zh-CN">中文</option>
            </select>
            <button
              type="button"
              className="toolbar-confirm"
              aria-label="Confirm action"
              onClick={onRunToolbarAction}
              disabled={!toolbarAction || toolbarActionPending}
            >
              {toolbarActionPending ? 'Working' : 'Run'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
