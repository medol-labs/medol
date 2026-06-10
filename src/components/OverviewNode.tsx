import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface OverviewNodeData extends Record<string, unknown> {
  kind: 'aggregate' | 'concept' | 'integration';
  title: string;
  contextName?: string;
  metrics: {
    slices?: number;
    commands?: number;
    events?: number;
    rejects?: number;
    readmodels?: number;
    hotspots?: number;
  };
}

export function OverviewNode({ data }: NodeProps) {
  const node = data as OverviewNodeData;
  const metrics = [
    ['Slices', node.metrics.slices],
    ['Cmd', node.metrics.commands],
    ['Evt', node.metrics.events],
    ['Reject', node.metrics.rejects],
    ['Read', node.metrics.readmodels],
    ['Hot', node.metrics.hotspots]
  ].filter(([, value]) => typeof value === 'number' && value > 0);

  return (
    <section className={`overview-node overview-node--${node.kind}`}>
      <Handle type="target" position={Position.Left} />
      <header>
        <span>{node.kind === 'aggregate' ? 'Aggregate' : node.kind === 'concept' ? 'Concept' : 'Integration'}</span>
        <strong>{node.title}</strong>
        {node.contextName && <small>{node.contextName}</small>}
      </header>
      {metrics.length > 0 && (
        <dl>
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Handle type="source" position={Position.Right} />
    </section>
  );
}
