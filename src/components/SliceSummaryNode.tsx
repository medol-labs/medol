import { Handle, Position, type NodeProps } from '@xyflow/react';
import { OverflowText } from './ui/overflow-text';

export interface SliceSummaryNodeData extends Record<string, unknown> {
  name: string;
  resultingState?: string;
  startsLifecycle?: boolean;
  tags: string[];
  metrics: {
    commands: number;
    events: number;
    rejects: number;
    readmodels: number;
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
        <span>
          {node.startsLifecycle ? 'Lifecycle Start' : node.resultingState ?? 'Slice'}
        </span>
        <OverflowText as="strong" text={node.name} />
      </header>
      {node.tags.length > 0 && (
        <ul className="slice-summary-node__tags">
          {node.tags.map((tag) => <OverflowText as="li" key={tag} text={tag} />)}
        </ul>
      )}
      <dl>
        <div>
          <dt>Cmd</dt>
          <dd>{node.metrics.commands}</dd>
        </div>
        <div>
          <dt>Evt</dt>
          <dd>{node.metrics.events}</dd>
        </div>
        {node.metrics.rejects > 0 && (
          <div>
            <dt>Reject</dt>
            <dd>{node.metrics.rejects}</dd>
          </div>
        )}
        <div>
          <dt>Read</dt>
          <dd>{node.metrics.readmodels}</dd>
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
