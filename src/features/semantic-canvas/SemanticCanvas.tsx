import { useEffect } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
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
  onSelectNode: (nodeId: string) => void;
}

export function SemanticCanvas({ nodes, edges, onSelectNode }: SemanticCanvasProps) {
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  return (
    <div className="canvas-pane">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.25}
        maxZoom={1.6}
        nodesDraggable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onNodeClick={(_, node) => onSelectNode(node.id)}
      >
        <Background gap={20} size={1} color="#dbe3ef" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
