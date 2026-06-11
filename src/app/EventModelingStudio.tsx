import { getViewportForBounds } from '@xyflow/react';
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { DslEditor } from '../features/dsl-editor/DslEditor';
import { findDslLine, type DslLocationTarget } from '../features/dsl-editor/dslLocation';
import { AgentChatDock } from '../features/agent-chat/AgentChatDock';
import { GlobalMap } from '../features/global-map/GlobalMap';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { LayoutPreview } from '../components/LayoutPreview';
import { ModelExplorer } from '../features/model-explorer/ModelExplorer';
import { SemanticCanvas } from '../features/semantic-canvas/SemanticCanvas';
import { WorkspaceSwitcher } from '../features/workspace/WorkspaceSwitcher';
import { useModelingWorkspace } from '../features/workspace/useModelingWorkspace';
import { generateModelingDocument } from '../features/documentation/documentationClient';
import { modelToCodegenModel, modelToConfig } from '../lib/dslToConfig';
import { parseMedol } from '../lib/dslParser';
import { emModelToJson } from '../lib/emModelExport';
import { exportFlowViewportToPng, exportFlowViewportToSvg } from '../lib/exportFlowImage';
import { toReactFlow } from '../lib/flow';
import { toLayoutPreviewModel } from '../lib/layoutPreview';
import { aggregateIdFromOverviewNodeId, toOverviewFlow } from '../lib/overviewFlow';
import { sampleDsl } from '../lib/sampleDsl';
import { getFlowBounds } from './flowBounds';
import { findModelItem, resolveActiveAggregate, resolveActiveContext } from './modelSelection';
import { useDebouncedValue } from './useDebouncedValue';
import type { EmAggregate, EmContext, EmDomain, EmSlice } from '../lib/model';
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
type PreviewMode = 'canvas' | 'global' | 'layout';

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

export function MedolStudio() {
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
  const [selectedSliceId, setSelectedSliceId] = useState<string | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [canvasShowFields, setCanvasShowFields] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [leftPanelWidth, setLeftPanelWidth] = useState(getInitialLeftPanelWidth);
  const [editorPanelHeight, setEditorPanelHeight] = useState(getInitialEditorPanelHeight);
  const [explorerPanelWidth, setExplorerPanelWidth] = useState(getInitialExplorerPanelWidth);
  const [dslFocusTarget, setDslFocusTarget] = useState<DslLocationTarget | undefined>();
  const [dslFocusVersion, setDslFocusVersion] = useState(0);
  const [dslEditorVersion, setDslEditorVersion] = useState(0);
  const [previewPatch, setPreviewPatch] = useState<AgentDslPatch | undefined>();
  const debouncedDsl = useDebouncedValue(dsl, 800);

  const model = useMemo(() => parseMedol(debouncedDsl), [debouncedDsl]);
  const activeDomain = model.domains.find((domain) => domain.id === selectedDomainId) ?? model.domains[0];
  const activeContext = resolveActiveContext(model, selectedContextId);
  const activeAggregate = resolveActiveAggregate(activeContext, selectedAggregateId);
  const displayContext = selectedContextId ? activeContext : undefined;
  const contextOverviewMode = previewMode === 'canvas'
    && !selectedAggregateId
    && !selectedSliceId;
  const flow = useMemo(() => toReactFlow(model, {
    contextId: activeContext?.id,
    aggregateId: selectedAggregateId ? activeAggregate?.id : undefined,
    sliceId: selectedSliceId,
    compactSlices: contextOverviewMode,
    showFields: canvasShowFields
  }), [model, activeContext?.id, activeAggregate?.id, selectedAggregateId, selectedSliceId, contextOverviewMode, canvasShowFields]);
  const codegenModel = useMemo(() => modelToCodegenModel(model), [model]);
  const layoutPreview = useMemo(() => toLayoutPreviewModel(codegenModel), [codegenModel]);
  const overviewFlow = useMemo(() => toOverviewFlow(model), [model]);
  const selectedItem = useMemo(() => findModelItem(model, {
    domainId: selectedDomainId,
    contextId: selectedContextId,
    aggregateId: selectedAggregateId,
    sliceId: selectedSliceId,
    nodeId: selectedNodeId
  }), [model, selectedDomainId, selectedContextId, selectedAggregateId, selectedSliceId, selectedNodeId]);
  const emModelJson = useMemo(() => emModelToJson(model), [model]);
  const codegenModelJson = useMemo(() => JSON.stringify(codegenModel, null, 2), [codegenModel]);
  const configJson = useMemo(() => JSON.stringify(modelToConfig(model), null, 2), [model]);
  const dslFocusLine = useMemo(() => findDslLine(dsl, dslFocusTarget), [dsl, dslFocusTarget]);
  const isParsingPending = dsl !== debouncedDsl;
  const modelStatus = previewPatch
    ? 'Patch preview'
    : isParsingPending
      ? 'Parsing'
      : model.diagnostics.length === 0
        ? 'Valid'
        : `${model.diagnostics.length} warnings`;

  useEffect(() => {
    setSelectedDomainId(undefined);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
  }, [activeWorkspaceId]);

  const selectDomain = (domain: EmDomain) => {
    setSelectedDomainId(domain.id);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setPreviewMode('global');
    setDslFocusTarget({ kind: 'domain', name: domain.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectContext = (context: EmContext) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setDslFocusTarget({ kind: 'context', name: context.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectAggregate = (context: EmContext, aggregate: EmAggregate) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate.id);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    setDslFocusTarget({ kind: 'aggregate', name: aggregate.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectSlice = (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => {
    setSelectedDomainId(model.domains.find((domain) => domain.contexts.some((candidate) => candidate.id === context.id))?.id);
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate?.id);
    setSelectedSliceId(slice.id);
    setSelectedNodeId(undefined);
    setDslFocusTarget({ kind: 'slice', name: slice.name });
    setDslFocusVersion((version) => version + 1);
  };

  const selectOverviewAggregate = (nodeId: string) => {
    const aggregateId = aggregateIdFromOverviewNodeId(nodeId);
    if (!aggregateId) return;

    for (const context of model.contexts) {
      const aggregate = context.aggregates.find((candidate) => candidate.id === aggregateId);
      if (!aggregate) continue;
      selectAggregate(context, aggregate);
      setPreviewMode('canvas');
      return;
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

  const downloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
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
        downloadMarkdown(`${kind}${documentationLanguage === 'zh-CN' ? '.zh-CN' : ''}.md`, document.markdown);
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
      setDslFocusTarget(focusTarget);
      setDslFocusVersion((version) => version + 1);
    }
    setDslEditorVersion((version) => version + 1);
  };

  const previewAgentPatch = (patch: AgentDslPatch) => {
    setPreviewPatch(patch);
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

  const editorColumn = leftPanelOpen ? `${leftPanelWidth}px` : '42px';
  const resizeColumn = leftPanelOpen ? '6px' : '0px';
  const inspectorColumn = rightPanelOpen ? '320px' : '42px';
  const gridTemplateColumns = layoutDirection === 'ltr'
    ? `${editorColumn} ${resizeColumn} minmax(0, 1fr) ${inspectorColumn}`
    : `${inspectorColumn} minmax(0, 1fr) ${resizeColumn} ${editorColumn}`;
  const editorGridColumn = layoutDirection === 'ltr' ? 1 : 4;
  const resizeGridColumn = layoutDirection === 'ltr' ? 2 : 3;
  const resolvedPreviewGridColumn = layoutDirection === 'ltr' ? 3 : 2;
  const inspectorGridColumn = layoutDirection === 'ltr' ? 4 : 1;
  const isRtlLayout = layoutDirection === 'rtl';

  return (
    <main
      className="grid h-[calc(100vh-24px)] min-h-0 overflow-hidden bg-[#f4f7fb] mb-6"
      style={{
        gridTemplateColumns,
        gridTemplateRows: 'minmax(0, 1fr)',
        '--left-panel-width': `${leftPanelWidth}px`,
        '--editor-panel-height': `${editorPanelHeight}px`,
        '--explorer-panel-width': `${explorerPanelWidth}px`
      } as CSSProperties}
    >
      {leftPanelOpen && (
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
                activeSliceId={selectedSliceId}
                onSelectDomain={selectDomain}
                onSelectContext={selectContext}
                onSelectAggregate={selectAggregate}
                onSelectSlice={selectSlice}
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
                  diagnostics={model.diagnostics}
                  patchPreview={previewPatch ? { baseDsl: previewPatch.baseDsl ?? dsl, nextDsl: previewPatch.nextDsl } : undefined}
                  focusLine={dslFocusLine}
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
      {leftPanelOpen && (
        <div
          className="min-w-0 cursor-col-resize bg-[linear-gradient(to_right,transparent_0_2px,#d8dee8_2px_4px,transparent_4px_6px)] hover:bg-[linear-gradient(to_right,transparent_0_1px,#2563eb_1px_5px,transparent_5px_6px)] active:bg-[linear-gradient(to_right,transparent_0_1px,#2563eb_1px_5px,transparent_5px_6px)]"
          style={{ gridColumn: resizeGridColumn, gridRow: 1 }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor panel"
          onPointerDown={resizeLeftPanel}
        />
      )}
      {!leftPanelOpen && (
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
            <p className="eyebrow">{displayContext?.name ?? activeDomain?.name ?? 'Event Modeling'}</p>
            <h1>{activeAggregate?.name ?? displayContext?.name ?? activeDomain?.name ?? 'Toolkit'}</h1>
          </div>
          <div className="toolbar-actions">
            <div className="toolbar-view-controls">
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
              </select>
              <button
                type="button"
                className="direction-toggle"
                onClick={() => setLayoutDirection((current) => current === 'ltr' ? 'rtl' : 'ltr')}
                title="Toggle layout direction"
              >
                {layoutDirection.toUpperCase()}
              </button>
            </div>
            <div className="toolbar-command-controls">
              <select
                className="toolbar-action-select"
                value={toolbarAction}
                onChange={(event) => setToolbarAction(event.target.value as ToolbarAction | '')}
                aria-label="Toolkit action"
              >
                <option value="" disabled>Choose action</option>
                <option value="em-model">Export EmModel</option>
                <option value="codegen-model">Export CodegenModel</option>
                <option value="config">Export config</option>
                <option value="png">Export PNG</option>
                <option value="svg">Export SVG</option>
                <option value="prd-ai">Generate PRD with AI</option>
                <option value="software-design-ai">Generate software design with AI</option>
                <option value="database-design-ai">Generate database design with AI</option>
                <option value="process-ai">Generate process document with AI</option>
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
          </div>
        </header>
        <div className="preview-stage">
          {previewMode === 'canvas' ? (
            <SemanticCanvas
              nodes={flow.nodes}
              edges={flow.edges}
              showFields={canvasShowFields}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onClearSelection={() => setSelectedNodeId(undefined)}
              onShowFieldsChange={setCanvasShowFields}
            />
          ) : previewMode === 'global' ? (
            <GlobalMap nodes={overviewFlow.nodes} edges={overviewFlow.edges} onSelectAggregate={selectOverviewAggregate} />
          ) : (
            <LayoutPreview model={layoutPreview} />
          )}
        </div>
        <footer className="studio-status">
          <strong>{modelStatus}</strong>
          {previewMode === 'canvas' && <span>model canvas</span>}
          {previewMode === 'global' && <span>domain map</span>}
          {previewMode === 'layout' && <span>ui preview</span>}
          {contextOverviewMode && <span>context overview</span>}
          {selectedSliceId && <span>slice focused</span>}
          {selectedNodeId && <span>element focused</span>}
          {model.diagnostics.map((diagnostic) => (
            <span key={diagnostic}>{diagnostic}</span>
          ))}
        </footer>
      </section>
      {rightPanelOpen && (
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
      {!rightPanelOpen && (
        <button
          type="button"
          className={`min-w-0 cursor-pointer border-0 bg-white p-0 text-xs font-extrabold uppercase tracking-normal text-slate-600 [writing-mode:vertical-rl] hover:bg-[#eef4fb] hover:text-[#172033] ${isRtlLayout ? 'border-r border-slate-300' : 'border-l border-slate-300'}`}
          style={{ gridColumn: inspectorGridColumn, gridRow: 1 }}
          onClick={() => setRightPanelOpen(true)}
        >
          Inspector
        </button>
      )}
    </main>
  );
}
