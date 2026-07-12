import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { DslEditor } from '../features/dsl-editor/DslEditor';
import { findDslLine, type DslLocationTarget } from '../features/dsl-editor/dslLocation';
import { AgentChatDock } from '../features/agent-chat/AgentChatDock';
import { GlobalMap } from '../features/global-map/GlobalMap';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { LayoutPreview } from '../components/LayoutPreview';
import { ModelExplorer } from '../features/model-explorer/ModelExplorer';
import { SemanticCanvas } from '../features/semantic-canvas/SemanticCanvas';
import { GlobalSearchDialog } from '../features/model-search/GlobalSearchDialog';
import { buildModelSearchIndex } from '../features/model-search/modelSearch';
import { useModelingWorkspace } from '../features/workspace/useModelingWorkspace';
import { DocumentWorkspace } from '../features/documentation/DocumentWorkspace';
import { hashMedolSource } from '../features/documentation/documentReferences';
import { useModelingDocuments } from '../features/documentation/useModelingDocuments';
import { modelToCodegenModel, modelToConfig } from '../lib/dslToConfig';
import { parseMedol } from '../lib/dslParser';
import { emModelToJson } from '../lib/emModelExport';
import { toReactFlow } from '../lib/flow';
import { toLayoutPreviewModel } from '../lib/layoutPreview';
import { toOverviewFlow } from '../lib/overviewFlow';
import { sampleDsl } from '../lib/sampleDsl';
import { EditorPaneHeader, EditorToolbar } from './EditorToolbar';
import { PreviewToolbar } from './PreviewToolbar';
import {
  formatPersistenceStatus,
  getInitialEditorPanelHeight,
  getInitialExplorerPanelWidth,
  getInitialLeftPanelWidth,
  type MedolStudioProps,
  type PreviewMode
} from './studioTypes';
import { useAgentSliceStatuses } from './useAgentSliceStatuses';
import { useDebouncedValue } from './useDebouncedValue';
import { useModelSearchDialog } from './useModelSearchDialog';
import { usePreviewSync } from './usePreviewSync';
import { useStudioSelection } from './useStudioSelection';
import { useToolbarActions } from './useToolbarActions';
import type { AgentDslPatch } from '../features/agent-chat/agentTypes';

export function MedolStudio({ previewOnly = false, editorOnly = false }: MedolStudioProps = {}) {
  const {
    dsl,
    updateDsl,
    workspaces,
    versions,
    versionStatus,
    activeWorkspaceId,
    activeWorkspace,
    status: dslPersistenceStatus,
    workspaceRevision,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    createVersion,
    loadVersion,
    restoreVersion
  } = useModelingWorkspace(sampleDsl);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('canvas');
  const [canvasShowFields, setCanvasShowFields] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [explorerPanelOpen, setExplorerPanelOpen] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [leftPanelWidth, setLeftPanelWidth] = useState(getInitialLeftPanelWidth);
  const [editorPanelHeight, setEditorPanelHeight] = useState(getInitialEditorPanelHeight);
  const [explorerPanelWidth, setExplorerPanelWidth] = useState(getInitialExplorerPanelWidth);
  const [dslEditorVersion, setDslEditorVersion] = useState(0);
  const [previewPatch, setPreviewPatch] = useState<AgentDslPatch | undefined>();
  const [documentFocusSourceId, setDocumentFocusSourceId] = useState<string>();
  const [documentFocusVersion, setDocumentFocusVersion] = useState(0);
  const [documentNavigationMessage, setDocumentNavigationMessage] = useState<string>();
  const [documentNavigationTone, setDocumentNavigationTone] = useState<'info' | 'warning'>('warning');
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
  const {
    agentSliceStatuses,
    updateSliceAgentStatus
  } = useAgentSliceStatuses(activeWorkspaceId);

  const model = useMemo(() => parseMedol(debouncedDsl), [debouncedDsl]);
  const {
    selectedDomainId,
    selectedContextId,
    selectedAggregateId,
    selectedConceptId,
    selectedSliceId,
    selectedNodeId,
    activeDomain,
    activeContext,
    activeAggregate,
    activeConcept,
    displayContext,
    contextDesignMode,
    selectedItem,
    dslFocusTarget,
    dslFocusPosition,
    dslFocusVersion,
    setSelectedNodeId,
    resetSelection,
    applySyncedSelection,
    focusDslTarget,
    focusDslPosition,
    selectDomain,
    selectContext,
    selectAggregate,
    selectConcept,
    selectSlice,
    selectSearchItem,
    selectOverviewGroup,
    locateMedolSource
  } = useStudioSelection({
    model,
    previewMode,
    onPreviewModeChange: setPreviewMode
  });
  const {
    searchOpen,
    setSearchOpen,
    recentSearchIds,
    navigateToSearchItem
  } = useModelSearchDialog({
    activeWorkspaceId,
    previewOnly,
    onSelectItem: selectSearchItem,
    onOpenLeftPanel: () => setLeftPanelOpen(true),
    onOpenExplorerPanel: () => setExplorerPanelOpen(true)
  });
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
  const modelSearchIndex = useMemo(() => buildModelSearchIndex(model), [model]);
  const emModelJson = useMemo(() => emModelToJson(model), [model]);
  const codegenModelJson = useMemo(() => JSON.stringify(codegenModel, null, 2), [codegenModel]);
  const configJson = useMemo(() => JSON.stringify(modelToConfig(model), null, 2), [model]);
  const medolSourceHash = useMemo(() => hashMedolSource(dsl), [dsl]);
  const documentSourceRefs = useMemo(
    () => new Set(documents.flatMap((document) => document.sourceRefs)),
    [documents]
  );
  const {
    toolbarAction,
    setToolbarAction,
    toolbarActionPending,
    documentationLanguage,
    setDocumentationLanguage,
    modelTranslationMessage,
    runToolbarAction
  } = useToolbarActions({
    activeWorkspaceId,
    dsl,
    emModelJson,
    codegenModelJson,
    configJson,
    medolSourceHash,
    flowNodes: flow.nodes,
    createDocument,
    onPreviewModeChange: setPreviewMode,
    onDocumentFocusSourceIdChange: setDocumentFocusSourceId,
    onDocumentNavigationMessageChange: setDocumentNavigationMessage,
    onDocumentNavigationToneChange: setDocumentNavigationTone,
    onResetModel: () => {
      setPreviewPatch(undefined);
      updateDsl(sampleDsl);
      setDslEditorVersion((version) => version + 1);
    }
  });
  const dslFocusLine = dslFocusPosition?.line
    ?? findDslLine(dsl, dslFocusTarget);
  const dslFocusColumn = dslFocusPosition?.column;
  const { publishPreviewState } = usePreviewSync({
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
    onPreviewModeChange: setPreviewMode,
    onApplySelection: applySyncedSelection
  });
  const isParsingPending = dsl !== debouncedDsl;
  const modelStatus = previewPatch
    ? 'Patch preview'
    : isParsingPending
      ? 'Parsing'
      : model.diagnostics.length === 0
        ? 'Valid'
        : `${model.diagnostics.length} warnings`;

  useEffect(() => {
    resetSelection();
    setDocumentFocusSourceId(undefined);
    setDocumentNavigationMessage(undefined);
    setDocumentNavigationTone('warning');
  }, [activeWorkspaceId]);

  const selectWorkspace = (workspaceId: string) => {
    setPreviewPatch(undefined);
    resetSelection();
    void switchWorkspace(workspaceId);
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

  const openPreviewPage = () => {
    if (typeof window === 'undefined') return;
    window.open('/preview', '_blank', 'noopener,noreferrer');
    publishPreviewState(500);
  };

  const openEditorPage = () => {
    if (typeof window === 'undefined') return;
    window.open('/editor', '_blank', 'noopener,noreferrer');
  };

  const applyAgentDsl = (nextDsl: string, focusTarget?: DslLocationTarget) => {
    setPreviewPatch(undefined);
    updateDsl(nextDsl);
    if (focusTarget) {
      focusDslTarget(focusTarget);
    }
    setDslEditorVersion((version) => version + 1);
  };

  const previewAgentPatch = (patch: AgentDslPatch) => {
    setPreviewPatch(patch);
    focusDslTarget(patch.focusTarget);
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
  const explorerEditorGridTemplateColumns = explorerPanelOpen
    ? 'var(--explorer-panel-width,240px) 6px minmax(0,1fr)'
    : '42px 0 minmax(0,1fr)';
  const editorOnlyGridTemplateColumns = `${
    explorerPanelOpen ? 'var(--explorer-panel-width,240px) 6px' : '42px 0'
  } minmax(360px,1fr) ${
    agentPanelOpen ? 'minmax(320px,34vw)' : '42px'
  }`;
  const workspaceHeaderProps = {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    versions,
    persistenceStatus: dslPersistenceStatus,
    versionStatus,
    onSelect: selectWorkspace,
    onCreate: (name: string) => void createWorkspace(name),
    onRename: (name: string) => void renameWorkspace(name),
    onDelete: () => void deleteWorkspace(),
    onCreateVersion: createVersion,
    onLoadVersion: loadVersion,
    onRestoreVersion: restoreVersion
  };

  if (editorOnly) {
    return (
      <main
        className="grid h-screen min-h-0 overflow-hidden bg-[#f4f7fb]"
        style={{
          gridTemplateRows: 'auto minmax(0, 1fr)',
          '--explorer-panel-width': `${explorerPanelWidth}px`
        } as CSSProperties}
      >
        <EditorToolbar
          {...workspaceHeaderProps}
          onSearch={() => setSearchOpen(true)}
          onOpenPreviewPage={openPreviewPage}
        />
        <div
          className="grid min-h-0 min-w-0 overflow-hidden"
          style={{ gridTemplateColumns: editorOnlyGridTemplateColumns }}
        >
          {explorerPanelOpen ? (
            <>
              <ModelExplorer
                model={model}
                activeDomainId={selectedDomainId}
                activeContextId={selectedContextId}
                activeAggregateId={selectedAggregateId}
                activeConceptId={selectedConceptId}
                activeSliceId={selectedSliceId}
                sliceAgentStatuses={agentSliceStatuses}
                documentSourceRefs={documentSourceRefs}
                onSelectDomain={selectDomain}
                onSelectContext={selectContext}
                onSelectAggregate={selectAggregate}
                onSelectConcept={selectConcept}
                onSelectSlice={selectSlice}
                onChangeSliceAgentStatus={updateSliceAgentStatus}
                onLocateDocumentation={(sourceIds) => void locateDocumentation(sourceIds)}
                onCollapse={() => setExplorerPanelOpen(false)}
              />
              <div
                className="explorer-resize-handle explorer-resize-handle--vertical"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize explorer panel"
                onPointerDown={resizeExplorerPanel}
              />
            </>
          ) : (
            <>
              <button
                type="button"
                className="agent-panel-rail"
                onClick={() => setExplorerPanelOpen(true)}
              >
                Explorer
              </button>
              <div aria-hidden="true" />
            </>
          )}
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
          {agentPanelOpen ? (
            <section className="agent-panel">
              <header className="pane-header pane-header--inline agent-panel__header">
                <div>
                  <p className="eyebrow">Assistant</p>
                  <h2>AI Chat</h2>
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
              className="agent-panel-rail"
              onClick={() => setAgentPanelOpen(true)}
            >
              AI Chat
            </button>
          )}
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
          <EditorPaneHeader
            {...workspaceHeaderProps}
            onCollapse={() => setLeftPanelOpen(false)}
          />
          <div
            className={`grid min-h-0 min-w-0 overflow-hidden ${
              agentPanelOpen
                ? 'grid-rows-[minmax(180px,var(--editor-panel-height,1fr))_6px_minmax(150px,1fr)]'
                : 'grid-rows-[minmax(0,1fr)_32px]'
            }`}
          >
            <div
              className="grid min-h-0 min-w-0 overflow-hidden"
              style={{ gridTemplateColumns: explorerEditorGridTemplateColumns }}
            >
              {explorerPanelOpen ? (
                <>
                  <ModelExplorer
                    model={model}
                    activeDomainId={selectedDomainId}
                    activeContextId={selectedContextId}
                    activeAggregateId={selectedAggregateId}
                    activeConceptId={selectedConceptId}
                    activeSliceId={selectedSliceId}
                    sliceAgentStatuses={agentSliceStatuses}
                    documentSourceRefs={documentSourceRefs}
                    onSelectDomain={selectDomain}
                    onSelectContext={selectContext}
                    onSelectAggregate={selectAggregate}
                    onSelectConcept={selectConcept}
                    onSelectSlice={selectSlice}
                    onChangeSliceAgentStatus={updateSliceAgentStatus}
                    onLocateDocumentation={(sourceIds) => void locateDocumentation(sourceIds)}
                    onCollapse={() => setExplorerPanelOpen(false)}
                  />
                  <div
                    className="explorer-resize-handle explorer-resize-handle--vertical"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize explorer panel"
                    onPointerDown={resizeExplorerPanel}
                  />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="agent-panel-rail"
                    onClick={() => setExplorerPanelOpen(true)}
                  >
                    Explorer
                  </button>
                  <div aria-hidden="true" />
                </>
              )}
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
        <PreviewToolbar
          previewOnly={previewOnly}
          eyebrow={displayContext?.name ?? activeDomain?.name ?? 'Event Modeling'}
          title={activeAggregate?.name ?? activeConcept?.name ?? displayContext?.name ?? activeDomain?.name ?? 'Toolkit'}
          previewMode={previewMode}
          toolbarAction={toolbarAction}
          toolbarActionPending={toolbarActionPending}
          documentationLanguage={documentationLanguage}
          layoutDirection={layoutDirection}
          onSearch={() => setSearchOpen(true)}
          onPreviewModeChange={setPreviewMode}
          onToolbarActionChange={setToolbarAction}
          onDocumentationLanguageChange={setDocumentationLanguage}
          onToggleLayoutDirection={() => setLayoutDirection((current) => current === 'ltr' ? 'rtl' : 'ltr')}
          onOpenPreviewPage={openPreviewPage}
          onOpenEditorPage={openEditorPage}
          onRunToolbarAction={runToolbarAction}
        />
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
          {modelTranslationMessage && <span>{modelTranslationMessage}</span>}
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
                  focusDslPosition(diagnostic.range?.start);
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
