import { Background, Controls, getViewportForBounds, MiniMap, ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import { EmNode } from './components/EmNode';
import { LaneLabel } from './components/LaneLabel';
import { SliceHeader } from './components/SliceHeader';
import { dslToConfig } from './lib/dslToConfig';
import { parseEventModelingDsl } from './lib/dslParser';
import { exportFlowViewportToPng, exportFlowViewportToSvg } from './lib/exportFlowImage';
import { toReactFlow } from './lib/flow';
import { sampleDsl } from './lib/sampleDsl';
import './styles/app.css';

const nodeTypes = {
  emElement: EmNode,
  laneLabel: LaneLabel,
  sliceHeader: SliceHeader
};

function EventModelingApp() {
  const [dsl, setDsl] = useState(sampleDsl);
  const model = useMemo(() => parseEventModelingDsl(dsl), [dsl]);
  const flow = useMemo(() => toReactFlow(model), [model]);
  const configJson = useMemo(() => JSON.stringify(dslToConfig(dsl), null, 2), [dsl]);

  const downloadConfig = () => {
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.json';
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

  const exportPng = async () => {
    if (flow.nodes.length === 0) return;

    await exportFlowViewportToPng({
      ...getImageExportOptions('event-modeling-flow.png'),
      pixelRatio: 2
    });
  };

  const exportSvg = () => {
    if (flow.nodes.length === 0) return;

    exportFlowViewportToSvg(getImageExportOptions('event-modeling-flow.svg'));
  };

  return (
    <main className="app-shell">
      <aside className="editor-pane">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Langium DSL</p>
            <h1>Event Modeling Toolkit</h1>
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={downloadConfig}>Export config</button>
            <button type="button" onClick={exportPng}>Export PNG</button>
            <button type="button" onClick={exportSvg}>Export SVG</button>
            <button type="button" onClick={() => setDsl(sampleDsl)}>Reset</button>
          </div>
        </div>
        <textarea
          spellCheck={false}
          value={dsl}
          onChange={(event) => setDsl(event.target.value)}
          aria-label="Event modeling DSL"
        />
        <footer className="diagnostics">
          <strong>{flow.nodes.length}</strong> nodes
          <strong>{flow.edges.length}</strong> edges
          {model.diagnostics.map((diagnostic) => (
            <span key={diagnostic}>{diagnostic}</span>
          ))}
        </footer>
      </aside>
      <section className="canvas-pane">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.25}
          maxZoom={1.6}
        >
          <Background gap={20} size={1} color="#dbe3ef" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}

const getFlowBounds = (nodes: Node[]): { x: number; y: number; width: number; height: number } => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const absolutePositionCache = new Map<string, { x: number; y: number }>();

  const getAbsolutePosition = (node: Node): { x: number; y: number } => {
    const cached = absolutePositionCache.get(node.id);
    if (cached) return cached;

    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const parentPosition = parent ? getAbsolutePosition(parent) : { x: 0, y: 0 };
    const position = {
      x: parentPosition.x + node.position.x,
      y: parentPosition.y + node.position.y
    };
    absolutePositionCache.set(node.id, position);
    return position;
  };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const position = getAbsolutePosition(node);
    const width = getNodeDimension(node, 'width');
    const height = getNodeDimension(node, 'height');
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 1280, height: 720 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

const getNodeDimension = (node: Node, key: 'width' | 'height'): number => {
  const styleValue = node.style?.[key];
  if (typeof styleValue === 'number') return styleValue;
  if (typeof styleValue === 'string') {
    const parsed = Number.parseFloat(styleValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  const measured = node.measured?.[key];
  if (typeof measured === 'number') return measured;
  return key === 'width' ? 190 : 66;
};

export default function App() {
  return (
    <ReactFlowProvider>
      <EventModelingApp />
    </ReactFlowProvider>
  );
}
