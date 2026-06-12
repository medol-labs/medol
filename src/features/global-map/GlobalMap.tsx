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
import { OverviewNode } from '../../components/OverviewNode';
import { ContextOverviewNode } from '../../components/ContextOverviewNode';

const nodeTypes = {
  overviewNode: OverviewNode,
  contextOverview: ContextOverviewNode
};

interface GlobalMapProps {
  nodes: Node[];
  edges: Edge[];
  onSelectGroup: (nodeId: string) => void;
}

export function GlobalMap({ nodes, edges, onSelectGroup }: GlobalMapProps) {
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
        minZoom={0.2}
        maxZoom={1.4}
        nodesDraggable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onNodeClick={(_, node) => onSelectGroup(node.id)}
      >
        <Background gap={24} size={1} color="#dbe3ef" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
