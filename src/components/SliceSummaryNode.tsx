import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface SliceSummaryNodeData extends Record<string, unknown> {
  name: string;
  resultingState?: string;
  createsAggregate?: boolean;
  metrics: {
    commands: number;
    events: number;
    projections: number;
    policies: number;
    hotspots: number;
  };
}

export function SliceSummaryNode({ data }: NodeProps) {
  const node = data as SliceSummaryNodeData;

  return (
    <section className="slice-summary-node">
      <Handle type="target" position={Position.Left} />
      <header>
        <span>{node.createsAggregate ? 'Entry Slice' : node.resultingState ?? 'Slice'}</span>
        <strong>{node.name}</strong>
      </header>
      <dl>
        <div>
          <dt>Cmd</dt>
          <dd>{node.metrics.commands}</dd>
        </div>
        <div>
          <dt>Evt</dt>
          <dd>{node.metrics.events}</dd>
        </div>
        <div>
          <dt>Read</dt>
          <dd>{node.metrics.projections}</dd>
        </div>
        <div>
          <dt>Rule</dt>
          <dd>{node.metrics.policies}</dd>
        </div>
        <div>
          <dt>Hot</dt>
          <dd>{node.metrics.hotspots}</dd>
        </div>
      </dl>
      <Handle type="source" position={Position.Right} />
    </section>
  );
}
