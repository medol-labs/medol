import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import { EmNode } from './components/EmNode';
import { LaneLabel } from './components/LaneLabel';
import { SliceHeader } from './components/SliceHeader';
import { dslToConfig } from './lib/dslToConfig';
import { parseEventModelingDsl } from './lib/dslParser';
import { toReactFlow } from './lib/flow';
import { sampleDsl } from './lib/sampleDsl';
import './styles/app.css';

const nodeTypes = {
  emElement: EmNode,
  laneLabel: LaneLabel,
  sliceHeader: SliceHeader
};

export default function App() {
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

  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <aside className="editor-pane">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Langium DSL</p>
              <h1>Event Modeling Toolkit</h1>
            </div>
            <div className="toolbar-actions">
              <button type="button" onClick={downloadConfig}>Export config</button>
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
    </ReactFlowProvider>
  );
}
