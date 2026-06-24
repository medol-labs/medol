import { getViewportForBounds } from '@xyflow/react';
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { Search } from 'lucide-react';
import { DslEditor } from '../features/dsl-editor/DslEditor';
import { findDslLine, type DslLocationTarget } from '../features/dsl-editor/dslLocation';
import { AgentChatDock } from '../features/agent-chat/AgentChatDock';
import { GlobalMap } from '../features/global-map/GlobalMap';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { LayoutPreview } from '../components/LayoutPreview';
import { OverflowText } from '../components/ui/overflow-text';
import { ModelExplorer } from '../features/model-explorer/ModelExplorer';
import { SemanticCanvas } from '../features/semantic-canvas/SemanticCanvas';
import { WorkspaceSwitcher } from '../features/workspace/WorkspaceSwitcher';
import { GlobalSearchDialog } from '../features/model-search/GlobalSearchDialog';
import { buildModelSearchIndex, type ModelSearchItem } from '../features/model-search/modelSearch';
import { useModelingWorkspace } from '../features/workspace/useModelingWorkspace';
import { generateModelingDocument } from '../features/documentation/documentationClient';
import { DocumentWorkspace } from '../features/documentation/DocumentWorkspace';
import { hashMedolSource } from '../features/documentation/documentReferences';
import { useModelingDocuments } from '../features/documentation/useModelingDocuments';
import { modelToCodegenModel, modelToConfig } from '../lib/dslToConfig';
import { parseMedol } from '../lib/dslParser';
import { emModelToJson } from '../lib/emModelExport';
import { exportFlowViewportToPng, exportFlowViewportToSvg } from '../lib/exportFlowImage';
import { toReactFlow } from '../lib/flow';
import { toLayoutPreviewModel } from '../lib/layoutPreview';
import { aggregateIdFromOverviewNodeId, conceptIdFromOverviewNodeId, contextIdFromOverviewNodeId, toOverviewFlow } from '../lib/overviewFlow';
import { sampleDsl } from '../lib/sampleDsl';
import { getFlowBounds } from './flowBounds';
import { findModelItem, resolveActiveAggregate, resolveActiveConcept, resolveActiveContext } from './modelSelection';
import { useDebouncedValue } from './useDebouncedValue';
import type { EmAggregate, EmConcept, EmContext, EmDomain, EmSlice } from '../lib/model';
import type { AgentDslPatch } from '../features/agent-chat/agentTypes';
import type {
  DocumentationKind,
  DocumentationLanguage
} from '../lib/generators/documentation';

type ToolbarAction =
  | 'em-model'
  | 'codegen-model'
  | 'config'
  | 'png'
  | 'svg'
  | 'prd-ai'
  | 'software-design-ai'
  | 'database-design-ai'
  | 'process-ai'
  | 'reset';
type PreviewMode = 'canvas' | 'global' | 'layout' | 'documents';

interface MedolStudioProps {
  previewOnly?: boolean;
  editorOnly?: boolean;
}

const getInitialLeftPanelWidth = () => {
  if (typeof window === 'undefined') return 820;
  const availableWidth = Math.max(360, window.innerWidth - 42 - 220 - 6);
  return Math.min(880, availableWidth, Math.max(360, Math.floor(window.innerWidth * 0.58)));
};

const getInitialEditorPanelHeight = () => {
  if (typeof window === 'undefined') return 420;
  return Math.floor((window.innerHeight - 120) / 2);
};

const getInitialExplorerPanelWidth = () => 240;

const formatPersistenceStatus = (status: 'loading' | 'saving' | 'saved' | 'offline'): string => {
  if (status === 'loading') return 'Loading';
  if (status === 'saving') return 'Saving';
  if (status === 'offline') return 'Offline';
  return 'Saved';
};

const isDocumentationAction = (
  action: ToolbarAction
): action is 'prd-ai' | 'software-design-ai' | 'database-design-ai' | 'process-ai' => {
  return action.endsWith('-ai');
};

const documentationKindFromAction = (
  action: 'prd-ai' | 'software-design-ai' | 'database-design-ai' | 'process-ai'
): DocumentationKind => {
  return action.slice(0, -3) as DocumentationKind;
};

const previewSyncChannelName = 'medol-preview-sync:v1';
const recentSearchStoragePrefix = 'medol:recent-search:v1';
const syncedPreviewModes = new Set<PreviewMode>(['canvas', 'global', 'layout', 'documents']);

interface PreviewSyncMessage {
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

export function MedolStudio({ previewOnly = false, editorOnly = false }: MedolStudioProps = {}) {
  const {
    dsl,
    updateDsl,
    workspaces,
    activeWorkspaceId,
    status: dslPersistenceStatus,
    workspaceRevision,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace
  } = useModelingWorkspace(sampleDsl);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('canvas');
  const [toolbarAction, setToolbarAction] = useState<ToolbarAction | ''>('');
  const [toolbarActionPending, setToolbarActionPending] = useState(false);
  const [documentationLanguage, setDocumentationLanguage] = useState<DocumentationLanguage>('en');
  const [selectedDomainId, setSelectedDomainId] = useState<string | undefined>();
  const [selectedContextId, setSelectedContextId] = useState<string | undefined>();
  const [selectedAggregateId, setSelectedAggregateId] = useState<string | undefined>();
  const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>();
  const [selectedSliceId, setSelectedSliceId] = useState<string | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [canvasShowFields, setCanvasShowFields] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [leftPanelWidth, setLeftPanelWidth] = useState(getInitialLeftPanelWidth);
  const [editorPanelHeight, setEditorPanelHeight] = useState(getInitialEditorPanelHeight);
  const [explorerPanelWidth, setExplorerPanelWidth] = useState(getInitialExplorerPanelWidth);
  const [dslFocusTarget, setDslFocusTarget] = useState<DslLocationTarget | undefined>();
  const [dslFocusPosition, setDslFocusPosition] = useState<{ line: number; column: number }>();
  const [dslFocusVersion, setDslFocusVersion] = useState(0);
  const [dslEditorVersion, setDslEditorVersion] = useState(0);
  const [previewPatch, setPreviewPatch] = useState<AgentDslPatch | undefined>();
  const [documentFocusSourceId, setDocumentFocusSourceId] = useState<string>();
  const [documentFocusVersion, setDocumentFocusVersion] = useState(0);
  const [documentNavigationMessage, setDocumentNavigationMessage] = useState<string>();
  const [documentNavigationTone, setDocumentNavigationTone] = useState<'info' | 'warning'>('warning');
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearchIds, setRecentSearchIds] = useState<string[]>([]);
  const debouncedDsl = useDebouncedValue(dsl, 800);
  const {
    documents,
    activeDocument,
    status: documentStatus,
    error: documentError,
    loadDocument,
    createDocument,
    saveDocument,
    deleteDocument
  } = useModelingDocuments(activeWorkspaceId);

  const model = useMemo(() => parseMedol(debouncedDsl), [debouncedDsl]);
  const activeDomain = model.domains.find((domain) => domain.id === selectedDomainId) ?? model.domains[0];
  const activeContext = resolveActiveContext(model, selectedContextId);
  const activeAggregate = resolveActiveAggregate(activeContext, selectedAggregateId);
  const activeConcept = resolveActiveConcept(activeContext, selectedConceptId);
  const displayContext = selectedContextId ? activeContext : undefined;
  const contextDesignMode = previewMode === 'canvas'
    && Boolean(selectedContextId)
    && !selectedAggregateId
    && !selectedConceptId
    && !selectedSliceId;
  const flow = useMemo(() => toReactFlow(model, {
    contextId: activeContext?.id,
    aggregateId: selectedAggregateId ? activeAggregate?.id : undefined,
    conceptId: selectedConceptId ? activeConcept?.id : undefined,
    sliceId: selectedSliceId,
    showFields: canvasShowFields
  }), [model, activeContext?.id, activeAggregate?.id, activeConcept?.id, selectedAggregateId, selectedConceptId, selectedSliceId, canvasShowFields]);
  const canvasFitKey = [
    activeWorkspaceId ?? 'loading',
    previewMode,
    activeContext?.id ?? 'all-contexts',
    activeAggregate?.id ?? '',
    activeConcept?.id ?? '',
    selectedSliceId ?? ''
  ].join(':');
  const codegenModel = useMemo(() => modelToCodegenModel(model), [model]);
  const layoutPreview = useMemo(() => toLayoutPreviewModel(codegenModel), [codegenModel]);
  const overviewFlow = useMemo(() => toOverviewFlow(model), [model]);
  const selectedItem = useMemo(() => findModelItem(model, {
    domainId: selectedDomainId,
    contextId: selectedContextId,
    aggregateId: selectedAggregateId,
    conceptId: selectedConceptId,
    sliceId: selectedSliceId,
    nodeId: selectedNodeId
  }), [model, selectedDomainId, selectedContextId, selectedAggregateId, selectedConceptId, selectedSliceId, selectedNodeId]);
  const modelSearchIndex = useMemo(() => buildModelSearchIndex(model), [model]);
  const emModelJson = useMemo(() => emModelToJson(model), [model]);
  const codegenModelJson = useMemo(() => JSON.stringify(codegenModel, null, 2), [codegenModel]);
  const configJson = useMemo(() => JSON.stringify(modelToConfig(model), null, 2), [model]);
  const medolSourceHash = useMemo(() => hashMedolSource(dsl), [dsl]);
  const documentSourceRefs = useMemo(
    () => new Set(documents.flatMap((document) => document.sourceRefs)),
    [documents]
  );
  const dslFocusLine = dslFocusPosition?.line
    ?? findDslLine(dsl, dslFocusTarget);
  const dslFocusColumn = dslFocusPosition?.column;
  const isParsingPending = dsl !== debouncedDsl;
  const modelStatus = previewPatch
    ? 'Patch preview'
    : isParsingPending
      ? 'Parsing'
      : model.diagnostics.length === 0
        ? 'Valid'
        : `${model.diagnostics.length} warnings`;
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
    if (previewOnly || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(previewSyncChannelName);
    channel.postMessage(previewSyncMessage);
    channel.close();
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
        setPreviewMode(message.previewMode);
      }
      setSelectedDomainId(message.selectedDomainId);
      setSelectedContextId(message.selectedContextId);
      setSelectedAggregateId(message.selectedAggregateId);
      setSelectedConceptId(message.selectedConceptId);
      setSelectedSliceId(message.selectedSliceId);
      setSelectedNodeId(message.selectedNodeId);
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [activeWorkspaceId, dsl, previewOnly, switchWorkspace, updateDsl]);

  useEffect(() => {
    setSelectedDomainId(undefined);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setDocumentFocusSourceId(undefined);
    setDocumentNavigationMessage(undefined);
    setDocumentNavigationTone('warning');
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId || typeof window === 'undefined') {
      setRecentSearchIds([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`${recentSearchStoragePrefix}:${activeWorkspaceId}`);
      const parsed = stored ? JSON.parse(stored) : [];
      setRecentSearchIds(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 10) : []);
    } catch {
      setRecentSearchIds([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const selectDomain = (domain: EmDomain) => {
    setSelectedDomainId(domain.id);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setPreviewMode('global');
    setDslFocusPosition(undefined);
    setDslFocusTarget({ kind: 'domain', name: domain.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectContext = (context: EmContext) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setPreviewMode('canvas');
    setDslFocusPosition(undefined);
    setDslFocusTarget({ kind: 'context', name: context.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectAggregate = (context: EmContext, aggregate: EmAggregate) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate.id);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setPreviewMode('canvas');
    setDslFocusPosition(undefined);
    setDslFocusTarget({ kind: 'aggregate', name: aggregate.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectConcept = (context: EmContext, concept: EmConcept) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(concept.id);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setPreviewMode('canvas');
    setDslFocusPosition(undefined);
    setDslFocusTarget({ kind: 'concept', name: concept.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectSlice = (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate?.id);
    setSelectedConceptId(aggregate
      ? undefined
      : context.concepts.find((concept) => concept.sliceIds.includes(slice.id))?.id);
    setSelectedSliceId(slice.id);
    setSelectedNodeId(undefined);
    setPreviewMode('canvas');
    setDslFocusPosition(undefined);
    setDslFocusTarget({ kind: 'slice', name: slice.name });
    setDslFocusVersion((version) => version + 1);
  };

  const navigateToSearchItem = (item: ModelSearchItem) => {
    setSelectedDomainId(item.domainId);
    setSelectedContextId(item.contextId);
    setSelectedAggregateId(item.aggregateId);
    setSelectedConceptId(item.conceptId);
    setSelectedSliceId(item.sliceId);
    setSelectedNodeId(item.nodeId);
    setDslFocusTarget(undefined);
    setDslFocusPosition(item.sourceRange?.start);
    setDslFocusVersion((version) => version + 1);
    if (!previewOnly) setLeftPanelOpen(true);
    setPreviewMode(item.kind === 'domain' ? 'global' : 'canvas');

    setRecentSearchIds((current) => {
      const next = [item.id, ...current.filter((id) => id !== item.id)].slice(0, 10);
      if (activeWorkspaceId && typeof window !== 'undefined') {
        window.localStorage.setItem(`${recentSearchStoragePrefix}:${activeWorkspaceId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const globalSearch = (
    <GlobalSearchDialog
      open={searchOpen}
      items={modelSearchIndex}
      recentIds={recentSearchIds}
      onOpenChange={setSearchOpen}
      onSelect={navigateToSearchItem}
    />
  );

  const selectOverviewGroup = (nodeId: string) => {
    const contextId = contextIdFromOverviewNodeId(nodeId);
    if (contextId) {
      const context = model.contexts.find((candidate) => candidate.id === contextId);
      if (context) selectContext(context);
      return;
    }

    const aggregateId = aggregateIdFromOverviewNodeId(nodeId);
    if (aggregateId) {
      for (const context of model.contexts) {
        const aggregate = context.aggregates.find((candidate) => candidate.id === aggregateId);
        if (!aggregate) continue;
        selectAggregate(context, aggregate);
        setPreviewMode('canvas');
        return;
      }
    }

    const conceptId = conceptIdFromOverviewNodeId(nodeId);
    if (conceptId) {
      for (const context of model.contexts) {
        const concept = context.concepts.find((candidate) => candidate.id === conceptId);
        if (!concept) continue;
        selectConcept(context, concept);
        return;
      }
    }
  };

  const locateDocumentation = async (sourceIds: string[]) => {
    const sourceId = sourceIds.find((candidate) =>
      documents.some((document) => document.sourceRefs.includes(candidate))
    );
    if (!sourceId) {
      setPreviewMode('documents');
      setDocumentFocusSourceId(undefined);
      setDocumentNavigationMessage(
        documents.length
          ? 'No linked section was found in the saved documents. Regenerate the document so it includes MEDOL references.'
          : 'Generate a PRD, software design, database design, or process document first. It will then be linked to this MEDOL item.'
      );
      setDocumentNavigationTone('warning');
      return;
    }
    const document = documents.find((candidate) => candidate.sourceRefs.includes(sourceId));
    if (!document) return;

    setPreviewMode('documents');
    setDocumentNavigationMessage(undefined);
    setDocumentNavigationTone('warning');
    setDocumentFocusSourceId(sourceId);
    setDocumentFocusVersion((version) => version + 1);
    if (activeDocument?.id !== document.id) {
      await loadDocument(document.id);
    }
  };

  const locateMedolSource = (sourceId: string) => {
    for (const domain of model.domains) {
      if (domain.id === sourceId) {
        selectDomain(domain);
        return;
      }
      for (const context of domain.contexts) {
        if (context.id === sourceId) {
          selectContext(context);
          return;
        }
        for (const concept of context.concepts) {
          if (concept.id === sourceId) {
            selectConcept(context, concept);
            return;
          }
        }
        for (const aggregate of context.aggregates) {
          if (aggregate.id === sourceId) {
            selectAggregate(context, aggregate);
            setPreviewMode('canvas');
            return;
          }
          for (const slice of aggregate.slices) {
            if (slice.id === sourceId) {
              selectSlice(context, aggregate, slice);
              setPreviewMode('canvas');
              return;
            }
            const element = slice.elements.find((candidate) => candidate.id === sourceId);
            if (element) {
              selectSlice(context, aggregate, slice);
              setSelectedNodeId(element.id);
              setPreviewMode('canvas');
              return;
            }
          }
        }
        for (const slice of context.slices) {
          if (slice.id === sourceId) {
            selectSlice(context, undefined, slice);
            setPreviewMode('canvas');
            return;
          }
          const element = slice.elements.find((candidate) => candidate.id === sourceId);
          if (element) {
            selectSlice(context, undefined, slice);
            setSelectedNodeId(element.id);
            setPreviewMode('canvas');
            return;
          }
        }
      }
    }
  };

  const downloadJson = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getImageExportOptions = (filename: string) => {
    const bounds = getFlowBounds(flow.nodes);
    const padding = 180;
    const imageWidth = Math.max(1280, Math.ceil(bounds.width + padding * 2));
    const imageHeight = Math.max(720, Math.ceil(bounds.height + padding * 2));
    const paddedBounds = {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2
    };
    const viewport = getViewportForBounds(paddedBounds, imageWidth, imageHeight, 0.1, 1.5, 1);

    return {
      filename,
      width: imageWidth,
      height: imageHeight,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      backgroundColor: '#f4f7fb'
    };
  };

  const openPreviewPage = () => {
    if (typeof window === 'undefined') return;
    window.open('/preview', '_blank', 'noopener,noreferrer');
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(previewSyncChannelName);
    window.setTimeout(() => {
      channel.postMessage(previewSyncMessage);
      channel.close();
    }, 500);
  };

  const openEditorPage = () => {
    if (typeof window === 'undefined') return;
    window.open('/editor', '_blank', 'noopener,noreferrer');
  };

  const runToolbarAction = async () => {
    if (!toolbarAction || toolbarActionPending) return;
    setToolbarActionPending(true);
    try {
      if (toolbarAction === 'em-model') {
        downloadJson('em-model.json', emModelJson);
      } else if (toolbarAction === 'codegen-model') {
        downloadJson('codegen-model.json', codegenModelJson);
      } else if (toolbarAction === 'config') {
        downloadJson('config.json', configJson);
      } else if (toolbarAction === 'png' && flow.nodes.length > 0) {
        await exportFlowViewportToPng({
          ...getImageExportOptions('medol-model.png'),
          pixelRatio: 2
        });
      } else if (toolbarAction === 'svg' && flow.nodes.length > 0) {
        exportFlowViewportToSvg(getImageExportOptions('medol-model.svg'));
      } else if (isDocumentationAction(toolbarAction)) {
        const kind = documentationKindFromAction(toolbarAction);
        const document = await generateModelingDocument({
          dsl,
          kind,
          language: documentationLanguage,
          enhanceWithAi: true
        });
        if (document.warning) console.warn(document.warning);
        const savedDocument = await createDocument({
          title: document.title,
          kind,
          language: documentationLanguage,
          markdown: document.markdown,
          sourceHash: medolSourceHash
        });
        const merge = savedDocument.mergeSummary;
        setDocumentNavigationMessage(merge
          ? merge.created
            ? `Created document with ${merge.added} generated sections.`
            : `Incremental update: ${merge.updated} updated, ${merge.added} added, ${merge.removed} removed, ${merge.preserved} manually edited sections preserved.`
          : undefined);
        setDocumentNavigationTone(merge?.preserved ? 'warning' : 'info');
        setDocumentFocusSourceId(undefined);
        setPreviewMode('documents');
      } else if (toolbarAction === 'reset') {
        setPreviewPatch(undefined);
        updateDsl(sampleDsl);
        setDslEditorVersion((version) => version + 1);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setToolbarActionPending(false);
      setToolbarAction('');
    }
  };

  const applyAgentDsl = (nextDsl: string, focusTarget?: DslLocationTarget) => {
    setPreviewPatch(undefined);
    updateDsl(nextDsl);
    if (focusTarget) {
      setDslFocusPosition(undefined);
      setDslFocusTarget(focusTarget);
      setDslFocusVersion((version) => version + 1);
    }
    setDslEditorVersion((version) => version + 1);
  };

  const previewAgentPatch = (patch: AgentDslPatch) => {
    setPreviewPatch(patch);
    setDslFocusPosition(undefined);
    setDslFocusTarget(patch.focusTarget);
    setDslFocusVersion((version) => version + 1);
  };

  const clearAgentPatchPreview = (patchId?: string) => {
    setPreviewPatch((current) => {
      if (!current) return undefined;
      return !patchId || current.id === patchId ? undefined : current;
    });
  };

  const resizeLeftPanel = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = leftPanelWidth;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const rightWidth = rightPanelOpen ? 320 : 42;
      const previewMinWidth = 220;
      const resizeHandleWidth = 6;
      const maxWidth = Math.max(window.innerWidth - rightWidth - previewMinWidth - resizeHandleWidth, 360);
      const dragDelta = layoutDirection === 'rtl' ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const nextWidth = Math.min(Math.max(startWidth + dragDelta, 360), maxWidth);
      setLeftPanelWidth(nextWidth);
      setExplorerPanelWidth((current) => Math.min(current, Math.max(nextWidth - 186, 140)));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const resizeWorkbenchRows = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = editorPanelHeight;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const modelingMinHeight = 180;
      const assistantMinHeight = 150;
      const reservedHeight = 120;
      const maxHeight = Math.max(window.innerHeight - reservedHeight - assistantMinHeight, modelingMinHeight);
      const nextHeight = Math.min(Math.max(startHeight + moveEvent.clientY - startY, modelingMinHeight), maxHeight);
      setEditorPanelHeight(nextHeight);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const resizeExplorerPanel = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = explorerPanelWidth;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const explorerMinWidth = 140;
      const editorMinWidth = 180;
      const maxWidth = Math.max(leftPanelWidth - editorMinWidth - 6, explorerMinWidth);
      const nextWidth = Math.min(
        Math.max(startWidth + moveEvent.clientX - startX, explorerMinWidth),
        maxWidth
      );
      setExplorerPanelWidth(nextWidth);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const showLeftPanel = !previewOnly && leftPanelOpen;
  const showRightPanel = !previewOnly && rightPanelOpen;
  const editorColumn = previewOnly ? '0px' : showLeftPanel ? `${leftPanelWidth}px` : '42px';
  const resizeColumn = showLeftPanel ? '6px' : '0px';
  const inspectorColumn = previewOnly ? '0px' : showRightPanel ? '320px' : '42px';
  const gridTemplateColumns = previewOnly
    ? 'minmax(0, 1fr)'
    : layoutDirection === 'ltr'
    ? `${editorColumn} ${resizeColumn} minmax(0, 1fr) ${inspectorColumn}`
    : `${inspectorColumn} minmax(0, 1fr) ${resizeColumn} ${editorColumn}`;
  const editorGridColumn = layoutDirection === 'ltr' ? 1 : 4;
  const resizeGridColumn = layoutDirection === 'ltr' ? 2 : 3;
  const resolvedPreviewGridColumn = previewOnly ? 1 : layoutDirection === 'ltr' ? 3 : 2;
  const inspectorGridColumn = layoutDirection === 'ltr' ? 4 : 1;
  const isRtlLayout = layoutDirection === 'rtl';

  if (editorOnly) {
    return (
      <main
        className="grid h-screen min-h-0 overflow-hidden bg-[#f4f7fb]"
        style={{
          gridTemplateRows: 'auto minmax(0, 1fr)',
          '--explorer-panel-width': `${explorerPanelWidth}px`
        } as CSSProperties}
      >
        <header className="studio-toolbar">
          <div className="workspace-header">
            <p className="eyebrow">Workspace</p>
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              status={dslPersistenceStatus}
              onSelect={(workspaceId) => {
                setPreviewPatch(undefined);
                setSelectedDomainId(undefined);
                setSelectedContextId(undefined);
                setSelectedAggregateId(undefined);
                setSelectedConceptId(undefined);
                setSelectedSliceId(undefined);
                setSelectedNodeId(undefined);
                void switchWorkspace(workspaceId);
              }}
              onCreate={(name) => void createWorkspace(name)}
              onRename={(name) => void renameWorkspace(name)}
              onDelete={() => void deleteWorkspace()}
            />
          </div>
          <div className="toolbar-actions">
            <div className="toolbar-view-controls">
              <button
                type="button"
                className="direction-toggle"
                onClick={() => setSearchOpen(true)}
                title="Search model (Cmd/Ctrl+K)"
              >
                <Search size={14} />
                Search
              </button>
              <button
                type="button"
                className="direction-toggle"
                onClick={openPreviewPage}
                title="Open preview in a separate page"
              >
                Preview
              </button>
            </div>
          </div>
        </header>
        <div className="grid min-h-0 min-w-0 grid-cols-[var(--explorer-panel-width,240px)_6px_minmax(360px,1fr)_minmax(320px,34vw)] overflow-hidden">
          <ModelExplorer
            model={model}
            activeDomainId={selectedDomainId}
            activeContextId={selectedContextId}
            activeAggregateId={selectedAggregateId}
            activeConceptId={selectedConceptId}
            activeSliceId={selectedSliceId}
            documentSourceRefs={documentSourceRefs}
            onSelectDomain={selectDomain}
            onSelectContext={selectContext}
            onSelectAggregate={selectAggregate}
            onSelectConcept={selectConcept}
            onSelectSlice={selectSlice}
            onLocateDocumentation={(sourceIds) => void locateDocumentation(sourceIds)}
          />
          <div
            className="explorer-resize-handle explorer-resize-handle--vertical"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize explorer panel"
            onPointerDown={resizeExplorerPanel}
          />
          <section className="left-section left-section--editor">
            <div className="left-section__title">
              <span>MEDOL</span>
              <strong title={`MEDOL persistence: ${dslPersistenceStatus}`}>
                {modelStatus} · {formatPersistenceStatus(dslPersistenceStatus)}
              </strong>
            </div>
            <DslEditor
              key={`${activeWorkspaceId ?? 'loading'}:${workspaceRevision}:${dslEditorVersion}`}
              value={dsl}
              diagnostics={model.diagnosticDetails}
              patchPreview={previewPatch ? { baseDsl: previewPatch.baseDsl ?? dsl, nextDsl: previewPatch.nextDsl } : undefined}
              focusLine={dslFocusLine}
              focusColumn={dslFocusColumn}
              focusVersion={dslFocusVersion}
              onChange={updateDsl}
            />
          </section>
          <section className="agent-panel">
            <header className="pane-header pane-header--inline agent-panel__header">
              <div>
                <p className="eyebrow">Assistant</p>
                <h2>AI Chat</h2>
              </div>
            </header>
            {activeWorkspaceId && (
              <AgentChatDock
                key={activeWorkspaceId}
                workspaceId={activeWorkspaceId}
                dsl={dsl}
                model={model}
                selectedItem={selectedItem}
                isParsingPending={isParsingPending}
                onApplyDsl={applyAgentDsl}
                onPreviewPatch={previewAgentPatch}
                onClearPatchPreview={clearAgentPatchPreview}
              />
            )}
          </section>
        </div>
        {globalSearch}
      </main>
    );
  }

  return (
    <main
      className={`grid min-h-0 overflow-hidden bg-[#f4f7fb] ${previewOnly ? 'h-screen' : 'h-[calc(100vh-24px)] mb-6'}`}
      style={{
        gridTemplateColumns,
        gridTemplateRows: 'minmax(0, 1fr)',
        '--left-panel-width': `${leftPanelWidth}px`,
        '--editor-panel-height': `${editorPanelHeight}px`,
        '--explorer-panel-width': `${explorerPanelWidth}px`
      } as CSSProperties}
    >
      {showLeftPanel && (
        <aside
          className={`grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white ${isRtlLayout ? 'border-l border-slate-300' : 'border-r border-slate-300'}`}
          style={{ gridColumn: editorGridColumn, gridRow: 1 }}
        >
          <header className="pane-header pane-header--inline">
            <div className="workspace-header">
              <p className="eyebrow">Workspace</p>
              <WorkspaceSwitcher
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                status={dslPersistenceStatus}
                onSelect={(workspaceId) => {
                  setPreviewPatch(undefined);
                  setSelectedDomainId(undefined);
                  setSelectedContextId(undefined);
                  setSelectedAggregateId(undefined);
                  setSelectedConceptId(undefined);
                  setSelectedSliceId(undefined);
                  setSelectedNodeId(undefined);
                  void switchWorkspace(workspaceId);
                }}
                onCreate={(name) => void createWorkspace(name)}
                onRename={(name) => void renameWorkspace(name)}
                onDelete={() => void deleteWorkspace()}
              />
            </div>
            <button type="button" className="collapse-button" onClick={() => setLeftPanelOpen(false)}>Hide</button>
          </header>
          <div
            className={`grid min-h-0 min-w-0 overflow-hidden ${
              agentPanelOpen
                ? 'grid-rows-[minmax(180px,var(--editor-panel-height,1fr))_6px_minmax(150px,1fr)]'
                : 'grid-rows-[minmax(0,1fr)_32px]'
            }`}
          >
            <div className="grid min-h-0 min-w-0 grid-cols-[var(--explorer-panel-width,240px)_6px_minmax(0,1fr)] overflow-hidden">
              <ModelExplorer
                model={model}
                activeDomainId={selectedDomainId}
                activeContextId={selectedContextId}
                activeAggregateId={selectedAggregateId}
                activeConceptId={selectedConceptId}
                activeSliceId={selectedSliceId}
                documentSourceRefs={documentSourceRefs}
                onSelectDomain={selectDomain}
                onSelectContext={selectContext}
                onSelectAggregate={selectAggregate}
                onSelectConcept={selectConcept}
                onSelectSlice={selectSlice}
                onLocateDocumentation={(sourceIds) => void locateDocumentation(sourceIds)}
              />
              <div
                className="explorer-resize-handle explorer-resize-handle--vertical"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize explorer panel"
                onPointerDown={resizeExplorerPanel}
              />
              <section className="left-section left-section--editor">
                <div className="left-section__title">
                  <span>MEDOL</span>
                  <strong title={`MEDOL persistence: ${dslPersistenceStatus}`}>
                    {modelStatus} · {formatPersistenceStatus(dslPersistenceStatus)}
                  </strong>
                </div>
                <DslEditor
                  key={`${activeWorkspaceId ?? 'loading'}:${workspaceRevision}:${dslEditorVersion}`}
                  value={dsl}
                  diagnostics={model.diagnosticDetails}
                  patchPreview={previewPatch ? { baseDsl: previewPatch.baseDsl ?? dsl, nextDsl: previewPatch.nextDsl } : undefined}
                  focusLine={dslFocusLine}
                  focusColumn={dslFocusColumn}
                  focusVersion={dslFocusVersion}
                  onChange={updateDsl}
                />
              </section>
            </div>
            {agentPanelOpen && (
              <div
                className="explorer-resize-handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize assistant panel"
                onPointerDown={resizeWorkbenchRows}
              />
            )}
            {agentPanelOpen ? (
              <section className="agent-panel agent-panel--horizontal">
                <header className="pane-header pane-header--inline agent-panel__header">
                  <div>
                    <h2>Assistant</h2>
                  </div>
                  <button type="button" className="collapse-button" onClick={() => setAgentPanelOpen(false)}>Hide</button>
                </header>
                {activeWorkspaceId && (
                  <AgentChatDock
                    key={activeWorkspaceId}
                    workspaceId={activeWorkspaceId}
                    dsl={dsl}
                    model={model}
                    selectedItem={selectedItem}
                    isParsingPending={isParsingPending}
                    onApplyDsl={applyAgentDsl}
                    onPreviewPatch={previewAgentPatch}
                    onClearPatchPreview={clearAgentPatchPreview}
                  />
                )}
              </section>
            ) : (
              <button
                type="button"
                className="agent-panel-rail agent-panel-rail--horizontal"
                onClick={() => setAgentPanelOpen(true)}
              >
                Assistant
              </button>
            )}
          </div>
        </aside>
      )}
      {showLeftPanel && (
        <div
          className="min-w-0 cursor-col-resize bg-[linear-gradient(to_right,transparent_0_2px,#d8dee8_2px_4px,transparent_4px_6px)] hover:bg-[linear-gradient(to_right,transparent_0_1px,#2563eb_1px_5px,transparent_5px_6px)] active:bg-[linear-gradient(to_right,transparent_0_1px,#2563eb_1px_5px,transparent_5px_6px)]"
          style={{ gridColumn: resizeGridColumn, gridRow: 1 }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor panel"
          onPointerDown={resizeLeftPanel}
        />
      )}
      {!previewOnly && !showLeftPanel && (
        <button
          type="button"
          className={`min-w-0 cursor-pointer border-0 bg-white p-0 text-xs font-extrabold uppercase tracking-normal text-slate-600 [writing-mode:vertical-rl] hover:bg-[#eef4fb] hover:text-[#172033] ${isRtlLayout ? 'border-l border-slate-300' : 'border-r border-slate-300'}`}
          style={{ gridColumn: editorGridColumn, gridRow: 1 }}
          onClick={() => setLeftPanelOpen(true)}
        >
          Editor
        </button>
      )}
      <section
        className="preview-panel grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#f4f7fb]"
        style={{ gridColumn: resolvedPreviewGridColumn, gridRow: 1 }}
      >
        <header className="studio-toolbar">
          <div>
            <OverflowText
              as="p"
              className="eyebrow"
              text={displayContext?.name ?? activeDomain?.name ?? 'Event Modeling'}
            />
            <OverflowText
              as="h1"
              text={activeAggregate?.name ?? activeConcept?.name ?? displayContext?.name ?? activeDomain?.name ?? 'Toolkit'}
            />
          </div>
          <div className="toolbar-actions">
            <div className="toolbar-view-controls">
              <button
                type="button"
                className="direction-toggle"
                onClick={() => setSearchOpen(true)}
                title="Search model (Cmd/Ctrl+K)"
              >
                <Search size={14} />
                Search
              </button>
              <div className="preview-tabs" role="tablist" aria-label="Preview mode">
                <button
                  type="button"
                  className={previewMode === 'canvas' ? 'is-active' : undefined}
                  aria-selected={previewMode === 'canvas'}
                  onClick={() => setPreviewMode('canvas')}
                >
                  Model Canvas
                </button>
                <button
                  type="button"
                  className={previewMode === 'global' ? 'is-active' : undefined}
                  aria-selected={previewMode === 'global'}
                  onClick={() => setPreviewMode('global')}
                >
                  Domain Map
                </button>
                <button
                  type="button"
                  className={previewMode === 'layout' ? 'is-active' : undefined}
                  aria-selected={previewMode === 'layout'}
                  onClick={() => setPreviewMode('layout')}
                >
                  UI Preview
                </button>
                <button
                  type="button"
                  className={previewMode === 'documents' ? 'is-active' : undefined}
                  aria-selected={previewMode === 'documents'}
                  onClick={() => setPreviewMode('documents')}
                >
                  Documents
                </button>
              </div>
              <select
                className="preview-mode-select"
                value={previewMode}
                onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
                aria-label="Preview mode"
              >
                <option value="canvas">Model Canvas</option>
                <option value="global">Domain Map</option>
                <option value="layout">UI Preview</option>
                <option value="documents">Documents</option>
              </select>
              {!previewOnly && (
                <button
                  type="button"
                  className="direction-toggle"
                  onClick={() => setLayoutDirection((current) => current === 'ltr' ? 'rtl' : 'ltr')}
                  title="Toggle layout direction"
                >
                  {layoutDirection.toUpperCase()}
                </button>
              )}
              {!previewOnly && (
                <button
                  type="button"
                  className="direction-toggle"
                  onClick={openPreviewPage}
                  title="Open preview in a separate page"
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                className="direction-toggle"
                onClick={openEditorPage}
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
                onChange={(event) => setToolbarAction(event.target.value as ToolbarAction | '')}
                aria-label="Toolkit action"
                title={toolbarAction
                  ? {
                      'em-model': 'Export EmModel',
                      'codegen-model': 'Export CodegenModel',
                      config: 'Export config',
                      png: 'Export PNG',
                      svg: 'Export SVG',
                      'prd-ai': 'Generate PRD',
                      'software-design-ai': 'Generate software design',
                      'database-design-ai': 'Generate database design',
                      'process-ai': 'Generate process document',
                      reset: 'Reset MEDOL'
                    }[toolbarAction]
                  : 'Choose toolkit action'}
              >
                <option value="" disabled>Choose action</option>
                <option value="em-model">Export EmModel</option>
                <option value="codegen-model">Export CodegenModel</option>
                <option value="config">Export config</option>
                <option value="png">Export PNG</option>
                <option value="svg">Export SVG</option>
                <option value="prd-ai">Generate PRD</option>
                <option value="software-design-ai">Generate software design</option>
                <option value="database-design-ai">Generate database design</option>
                <option value="process-ai">Generate process document</option>
                <option value="reset">Reset MEDOL</option>
              </select>
              <select
                className="toolbar-language-select"
                value={documentationLanguage}
                onChange={(event) => setDocumentationLanguage(event.target.value as DocumentationLanguage)}
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
                onClick={runToolbarAction}
                disabled={!toolbarAction || toolbarActionPending}
              >
                {toolbarActionPending ? 'Working' : 'OK'}
              </button>
            </div>
            )}
          </div>
        </header>
        <div className="preview-stage">
          {previewMode === 'canvas' ? (
            <SemanticCanvas
              nodes={flow.nodes}
              edges={flow.edges}
              showFields={canvasShowFields}
              fitKey={canvasFitKey}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onClearSelection={() => setSelectedNodeId(undefined)}
              onShowFieldsChange={setCanvasShowFields}
            />
          ) : previewMode === 'global' ? (
            <GlobalMap nodes={overviewFlow.nodes} edges={overviewFlow.edges} onSelectGroup={selectOverviewGroup} />
          ) : previewMode === 'layout' ? (
            <LayoutPreview model={layoutPreview} />
          ) : (
            <DocumentWorkspace
              documents={documents}
              activeDocument={activeDocument}
              status={documentStatus}
              error={documentError}
              navigationMessage={documentNavigationMessage}
              navigationMessageTone={documentNavigationTone}
              focusSourceId={documentFocusSourceId}
              focusVersion={documentFocusVersion}
              currentSourceHash={medolSourceHash}
              onSelect={(documentId) => {
                setDocumentFocusSourceId(undefined);
                setDocumentNavigationMessage(undefined);
                setDocumentNavigationTone('warning');
                void loadDocument(documentId);
              }}
              onSave={saveDocument}
              onDelete={deleteDocument}
              onLocateSource={locateMedolSource}
            />
          )}
        </div>
        <footer className="studio-status">
          <strong>{modelStatus}</strong>
          {previewMode === 'canvas' && <span>model canvas</span>}
          {previewMode === 'global' && <span>domain map</span>}
          {previewMode === 'layout' && <span>ui preview</span>}
          {previewMode === 'documents' && <span>{activeDocument ? `${activeDocument.title} · ${documentStatus}` : 'documents'}</span>}
          {contextDesignMode && <span>context focused</span>}
          {selectedSliceId && <span>slice focused</span>}
          {selectedNodeId && <span>element focused</span>}
          {model.diagnosticDetails.map((diagnostic, index) => (
            diagnostic.range ? (
              <button
                key={`${diagnostic.message}:${index}`}
                type="button"
                className="studio-status__diagnostic"
                title={`Go to line ${diagnostic.range.start.line}, column ${diagnostic.range.start.column}`}
                onClick={() => {
                  setLeftPanelOpen(true);
                  setDslFocusTarget(undefined);
                  setDslFocusPosition(diagnostic.range?.start);
                  setDslFocusVersion((version) => version + 1);
                }}
              >
                {diagnostic.message}
              </button>
            ) : (
              <span key={`${diagnostic.message}:${index}`}>{diagnostic.message}</span>
            )
          ))}
        </footer>
      </section>
      {showRightPanel && (
        <aside
          className={`grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white ${isRtlLayout ? 'border-r border-slate-300' : 'border-l border-slate-300'}`}
          style={{ gridColumn: inspectorGridColumn, gridRow: 1 }}
        >
          <header className="pane-header pane-header--inline">
            <div>
              <p className="eyebrow">Semantic</p>
              <h2>Inspector</h2>
            </div>
            <button type="button" className="collapse-button" onClick={() => setRightPanelOpen(false)}>Hide</button>
          </header>
          <InspectorPanel item={selectedItem} compact />
        </aside>
      )}
      {!previewOnly && !showRightPanel && (
        <button
          type="button"
          className={`min-w-0 cursor-pointer border-0 bg-white p-0 text-xs font-extrabold uppercase tracking-normal text-slate-600 [writing-mode:vertical-rl] hover:bg-[#eef4fb] hover:text-[#172033] ${isRtlLayout ? 'border-r border-slate-300' : 'border-l border-slate-300'}`}
          style={{ gridColumn: inspectorGridColumn, gridRow: 1 }}
          onClick={() => setRightPanelOpen(true)}
        >
          Inspector
        </button>
      )}
      {globalSearch}
    </main>
  );
}
