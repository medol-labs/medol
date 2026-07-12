import type { DocumentationKind } from '../lib/generators/documentation';

export type ToolbarAction =
  | 'em-model'
  | 'codegen-model'
  | 'config'
  | 'png'
  | 'svg'
  | 'prd-ai'
  | 'software-design-ai'
  | 'database-design-ai'
  | 'process-ai'
  | 'model-translations'
  | 'download-translations'
  | 'reset';

export type DocumentationToolbarAction =
  | 'prd-ai'
  | 'software-design-ai'
  | 'database-design-ai'
  | 'process-ai';

export type PreviewMode = 'canvas' | 'global' | 'layout' | 'documents';

export interface MedolStudioProps {
  previewOnly?: boolean;
  editorOnly?: boolean;
}

export interface PreviewSyncMessage {
  type: 'studio-state';
  workspaceId?: string;
  dsl?: string;
  previewMode?: PreviewMode;
  selectedDomainId?: string;
  selectedContextId?: string;
  selectedAggregateId?: string;
  selectedConceptId?: string;
  selectedSliceId?: string;
  selectedNodeId?: string;
}

export const previewSyncChannelName = 'medol-preview-sync:v1';
export const recentSearchStoragePrefix = 'medol:recent-search:v1';
export const syncedPreviewModes = new Set<PreviewMode>(['canvas', 'global', 'layout', 'documents']);

export const getInitialLeftPanelWidth = () => {
  if (typeof window === 'undefined') return 820;
  const availableWidth = Math.max(360, window.innerWidth - 42 - 220 - 6);
  return Math.min(880, availableWidth, Math.max(360, Math.floor(window.innerWidth * 0.58)));
};

export const getInitialEditorPanelHeight = () => {
  if (typeof window === 'undefined') return 420;
  return Math.floor((window.innerHeight - 120) / 2);
};

export const getInitialExplorerPanelWidth = () => 240;

export const formatPersistenceStatus = (
  status: 'loading' | 'saving' | 'saved' | 'offline'
): string => {
  if (status === 'loading') return 'Loading';
  if (status === 'saving') return 'Saving';
  if (status === 'offline') return 'Offline';
  return 'Saved';
};

export const isDocumentationAction = (
  action: ToolbarAction
): action is DocumentationToolbarAction => {
  return action.endsWith('-ai');
};

export const documentationKindFromAction = (
  action: DocumentationToolbarAction
): DocumentationKind => {
  return action.slice(0, -3) as DocumentationKind;
};
