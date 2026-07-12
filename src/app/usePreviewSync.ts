import { useEffect, useMemo } from 'react';
import {
  previewSyncChannelName,
  syncedPreviewModes,
  type PreviewMode,
  type PreviewSyncMessage
} from './studioTypes';

interface UsePreviewSyncOptions {
  previewOnly: boolean;
  activeWorkspaceId?: string;
  dsl: string;
  previewMode: PreviewMode;
  selectedDomainId?: string;
  selectedContextId?: string;
  selectedAggregateId?: string;
  selectedConceptId?: string;
  selectedSliceId?: string;
  selectedNodeId?: string;
  switchWorkspace: (workspaceId: string) => void | Promise<void>;
  updateDsl: (dsl: string) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onApplySelection: (message: Partial<PreviewSyncMessage>) => void;
}

export const usePreviewSync = ({
  previewOnly,
  activeWorkspaceId,
  dsl,
  previewMode,
  selectedDomainId,
  selectedContextId,
  selectedAggregateId,
  selectedConceptId,
  selectedSliceId,
  selectedNodeId,
  switchWorkspace,
  updateDsl,
  onPreviewModeChange,
  onApplySelection
}: UsePreviewSyncOptions) => {
  const previewSyncMessage = useMemo<PreviewSyncMessage>(() => ({
    type: 'studio-state',
    ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {}),
    dsl,
    previewMode,
    ...(selectedDomainId ? { selectedDomainId } : {}),
    ...(selectedContextId ? { selectedContextId } : {}),
    ...(selectedAggregateId ? { selectedAggregateId } : {}),
    ...(selectedConceptId ? { selectedConceptId } : {}),
    ...(selectedSliceId ? { selectedSliceId } : {}),
    ...(selectedNodeId ? { selectedNodeId } : {})
  }), [
    activeWorkspaceId,
    dsl,
    previewMode,
    selectedDomainId,
    selectedContextId,
    selectedAggregateId,
    selectedConceptId,
    selectedSliceId,
    selectedNodeId
  ]);

  useEffect(() => {
    if (previewOnly) return;
    publishPreviewState(previewSyncMessage);
  }, [previewOnly, previewSyncMessage]);

  useEffect(() => {
    if (!previewOnly || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(previewSyncChannelName);
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as Partial<PreviewSyncMessage>;
      if (message.type !== 'studio-state') return;
      if (typeof message.workspaceId === 'string' && message.workspaceId !== activeWorkspaceId) {
        void switchWorkspace(message.workspaceId);
      }
      if (typeof message.dsl === 'string' && message.dsl !== dsl) updateDsl(message.dsl);
      if (message.previewMode && syncedPreviewModes.has(message.previewMode)) {
        onPreviewModeChange(message.previewMode);
      }
      onApplySelection(message);
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [activeWorkspaceId, dsl, previewOnly, switchWorkspace, updateDsl, onPreviewModeChange]);

  return {
    publishPreviewState: (delayMs = 0) => publishPreviewState(previewSyncMessage, delayMs)
  };
};

const publishPreviewState = (message: PreviewSyncMessage, delayMs = 0) => {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(previewSyncChannelName);
  const post = () => {
    channel.postMessage(message);
    channel.close();
  };
  if (delayMs > 0) {
    window.setTimeout(post, delayMs);
    return;
  }
  post();
};
