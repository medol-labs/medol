import type { NodeProps } from '@xyflow/react';

interface ContextOverviewNodeData extends Record<string, unknown> {
  title: string;
  note?: string;
  aggregates: number;
  concepts: number;
  slices: number;
  integrations: number;
  risks: number;
}

export function ContextOverviewNode({ data }: NodeProps) {
  const context = data as ContextOverviewNodeData;

  return (
    <section className="context-overview-node">
      <div>
        <span>Bounded Context</span>
        <strong>{context.title}</strong>
        {context.note && <p>{context.note}</p>}
      </div>
      <dl>
        <div><dt>Aggregates</dt><dd>{context.aggregates}</dd></div>
        <div><dt>Concepts</dt><dd>{context.concepts}</dd></div>
        <div><dt>Slices</dt><dd>{context.slices}</dd></div>
        <div><dt>Integrations</dt><dd>{context.integrations}</dd></div>
        <div><dt>Risks</dt><dd>{context.risks}</dd></div>
      </dl>
    </section>
  );
}
