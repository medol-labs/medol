import { useEffect, useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Eye, Focus, ListTree, Map, Rows3 } from 'lucide-react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  useReactFlow,
  useEdgesState,
  useNodesState
} from '@xyflow/react';
import { EmNode } from '../../components/EmNode';
import { ConceptHeader } from '../../components/ConceptHeader';
import { LaneLabel } from '../../components/LaneLabel';
import { SliceSummaryNode } from '../../components/SliceSummaryNode';
import { SliceHeader } from '../../components/SliceHeader';
import { ContextHeader } from '../../components/ContextHeader';

const nodeTypes = {
  emElement: EmNode,
  laneLabel: LaneLabel,
  sliceSummary: SliceSummaryNode,
  sliceHeader: SliceHeader,
  conceptHeader: ConceptHeader,
  contextHeader: ContextHeader
};

interface SemanticCanvasProps {
  domains: Array<{ id: string; name: string }>;
  domainId?: string;
  boardKind?: 'domain' | 'unassigned' | 'builtin';
  onDomainChange: (domainId: string) => void;
  contexts: Array<{ id: string; name: string }>;
  contextId?: string;
  localContextOnly: boolean;
  focusNodeId?: string;
  onContextChange: (contextId: string) => void;
  onLocalContextChange: (local: boolean) => void;
  onToggleContext: (contextId: string) => void;
  onOpenContext: (contextId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  nodes: Node[];
  edges: Edge[];
  showFields: boolean;
  fitKey: string;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onClearSelection: () => void;
  onShowFieldsChange: (showFields: boolean) => void;
}

const primaryRelations = new Set(['invokes', 'emits', 'updates']);

export function SemanticCanvas({
  domains,
  domainId,
  boardKind = 'domain',
  onDomainChange,
  contexts,
  contextId,
  localContextOnly,
  focusNodeId,
  onContextChange,
  onLocalContextChange,
  onToggleContext,
  onOpenContext,
  onCollapseAll,
  onExpandAll,
  nodes,
  edges,
  showFields,
  fitKey,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  onShowFieldsChange
}: SemanticCanvasProps) {
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const [showAllRelations, setShowAllRelations] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  useEffect(() => {
    if (focusNodeId) return;
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 180, maxZoom: 1 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitKey, fitView, focusNodeId]);

  useEffect(() => {
    if (!focusNodeId) return;
    const node = localNodes.find((candidate) => candidate.id === focusNodeId);
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      void fitView({ nodes: [node], padding: node.type === 'group' ? 0.12 : 0.8, duration: 240, maxZoom: 1.2 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, localNodes, focusNodeId]);

  const visibleEdges = useMemo(
    () => showAllRelations
      ? localEdges
      : localEdges.filter((edge) => edge.data?.crossContext || !edge.label
        || ((edge.data?.relations as string[] | undefined) ?? [String(edge.label)]).some((relation) => primaryRelations.has(relation))),
    [localEdges, showAllRelations]
  );
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !localNodes.some((node) => node.id === selectedNodeId)) return undefined;
    const ids = new Set([selectedNodeId]);
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    }
    return ids;
  }, [selectedNodeId, visibleEdges, localNodes]);
  const displayNodes = useMemo(() => localNodes.map((node) => {
    const isElement = node.type === 'emElement';
    const isDimmed = Boolean(connectedNodeIds && isElement && !connectedNodeIds.has(node.id));
    return {
      ...node,
      selected: node.id === selectedNodeId,
      data: isElement ? { ...node.data, showFields } : node.type === 'contextHeader'
        ? { ...node.data, onToggle: localContextOnly ? undefined : () => onToggleContext(String(node.data.contextId)), onOpen: () => onOpenContext(String(node.data.contextId)) }
        : node.data,
      style: {
        ...node.style,
        ...(isDimmed ? { opacity: 0.2 } : {})
      }
    };
  }), [connectedNodeIds, localNodes, selectedNodeId, showFields, localContextOnly, onToggleContext, onOpenContext]);
  const displayEdges = useMemo(() => visibleEdges.map((edge) => {
    const isConnected = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
    return {
      ...edge,
      style: {
        ...edge.style,
        ...(!isConnected ? { opacity: 0.12 } : {})
      },
      labelStyle: {
        ...edge.labelStyle,
        ...(!isConnected ? { opacity: 0.12 } : {})
      }
    };
  }), [selectedNodeId, visibleEdges]);

  return (
    <div className="canvas-pane">
      <div className="canvas-scope-controls">
        <select aria-label="Canvas domain" value={domainId ?? ''} onChange={(event) => onDomainChange(event.target.value)}>
          {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
        </select>
        <select aria-label="Canvas context" value={contextId ?? ''} onChange={(event) => onContextChange(event.target.value)}>
          <option value="">{localContextOnly ? 'Select context' : boardKind === 'builtin' ? 'All capabilities' : boardKind === 'unassigned' ? 'All contexts' : 'Whole domain'}</option>
          {contexts.map((context) => <option key={context.id} value={context.id}>{context.name}</option>)}
        </select>
        <label><input type="checkbox" checked={localContextOnly} disabled={!contexts.length} onChange={(event) => onLocalContextChange(event.target.checked)} />Local view</label>
        <button type="button" aria-label="Collapse all contexts" title="Collapse all contexts" disabled={localContextOnly || !contexts.length} onClick={onCollapseAll}><ChevronsDownUp size={16} /></button>
        <button type="button" aria-label="Expand all contexts" title="Expand all contexts" disabled={localContextOnly || !contexts.length} onClick={onExpandAll}><ChevronsUpDown size={16} /></button>
      </div>
      <div className="canvas-flow-stage">
      {!contexts.length && <div className="canvas-empty" role="status">No contexts</div>}
      <div className="canvas-view-controls" aria-label="Model canvas display">
        <button type="button" onClick={() => void fitView({ padding: 0.12, duration: 250 })} title="Fit model">
          <Focus size={14} />
          Fit
        </button>
        <button
          type="button"
          className={showFields ? 'is-active' : undefined}
          disabled={!localContextOnly}
          onClick={() => onShowFieldsChange(!showFields)}
          title="Show node fields"
        >
          <Rows3 size={14} />
          Fields
        </button>
        <button
          type="button"
          className={showAllRelations ? 'is-active' : undefined}
          onClick={() => setShowAllRelations((current) => !current)}
          title="Show specification and secondary relations"
        >
          <ListTree size={14} />
          Relations
        </button>
        <button
          type="button"
          className={showMiniMap ? 'is-active' : undefined}
          onClick={() => setShowMiniMap((current) => !current)}
          title="Toggle mini map"
        >
          {showMiniMap ? <Eye size={14} /> : <Map size={14} />}
          Map
        </button>
      </div>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.005}
        maxZoom={1.6}
        nodesDraggable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onNodeClick={(_, node) => node.type === 'contextHeader' ? onContextChange(String(node.data.contextId)) : onSelectNode(node.id)}
        onPaneClick={onClearSelection}
      >
        <Background gap={20} size={1} color="#dbe3ef" />
        {showMiniMap && <MiniMap pannable zoomable />}
        <Controls />
      </ReactFlow>
      </div>
    </div>
  );
}
