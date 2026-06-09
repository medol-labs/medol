import { useEffect, useMemo, useState } from 'react';
import { Eye, Focus, ListTree, Map, Rows3 } from 'lucide-react';
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
import { LaneLabel } from '../../components/LaneLabel';
import { SliceSummaryNode } from '../../components/SliceSummaryNode';
import { SliceHeader } from '../../components/SliceHeader';

const nodeTypes = {
  emElement: EmNode,
  laneLabel: LaneLabel,
  sliceSummary: SliceSummaryNode,
  sliceHeader: SliceHeader
};

interface SemanticCanvasProps {
  nodes: Node[];
  edges: Edge[];
  showFields: boolean;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onClearSelection: () => void;
  onShowFieldsChange: (showFields: boolean) => void;
}

const primaryRelations = new Set(['invokes', 'emits', 'updates']);

export function SemanticCanvas({
  nodes,
  edges,
  showFields,
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
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 180, maxZoom: 1 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, nodes]);

  const visibleEdges = useMemo(
    () => showAllRelations
      ? localEdges
      : localEdges.filter((edge) => !edge.label || primaryRelations.has(String(edge.label))),
    [localEdges, showAllRelations]
  );
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return undefined;
    const ids = new Set([selectedNodeId]);
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    }
    return ids;
  }, [selectedNodeId, visibleEdges]);
  const displayNodes = useMemo(() => localNodes.map((node) => {
    const isElement = node.type === 'emElement';
    const isDimmed = Boolean(connectedNodeIds && isElement && !connectedNodeIds.has(node.id));
    return {
      ...node,
      selected: node.id === selectedNodeId,
      data: isElement ? { ...node.data, showFields } : node.data,
      style: {
        ...node.style,
        ...(isDimmed ? { opacity: 0.2 } : {})
      }
    };
  }), [connectedNodeIds, localNodes, selectedNodeId, showFields]);
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
      <div className="canvas-view-controls" aria-label="Model canvas display">
        <button type="button" onClick={() => void fitView({ padding: 0.12, duration: 250 })} title="Fit model">
          <Focus size={14} />
          Fit
        </button>
        <button
          type="button"
          className={showFields ? 'is-active' : undefined}
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
        minZoom={0.35}
        maxZoom={1.6}
        nodesDraggable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={onClearSelection}
      >
        <Background gap={20} size={1} color="#dbe3ef" />
        {showMiniMap && <MiniMap pannable zoomable />}
        <Controls />
      </ReactFlow>
    </div>
  );
}
