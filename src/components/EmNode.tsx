import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EmField, EmElementKind } from '../lib/model';

interface EmNodeData extends Record<string, unknown> {
  kind: EmElementKind;
  name: string;
  fields: EmField[];
  accent: string;
  fill: string;
}

const labels: Record<EmElementKind, string> = {
  actor: 'Actor',
  screen: 'UI',
  command: 'Command',
  event: 'Event',
  transition: 'Transition',
  projection: 'Projection',
  automation: 'Automation',
  policy: 'Policy',
  gwt: 'GWT',
  aggregate: 'Aggregate',
  hotspot: 'Hotspot',
  integration: 'Integration'
};

export function EmNode({ data }: NodeProps) {
  const node = data as EmNodeData;
  const fields = node.fields.slice(0, 5);
  const hiddenCount = Math.max(node.fields.length - fields.length, 0);

  return (
    <section className="em-node" style={{ borderColor: node.accent, background: node.fill }}>
      <Handle type="target" position={Position.Left} />
      <header className="em-node__header">
        <span className="em-node__kind" style={{ color: node.accent }}>{labels[node.kind]}</span>
        <strong>{node.name}</strong>
      </header>
      {fields.length > 0 && (
        <ul className="em-node__fields">
          {fields.map((field) => (
            <li key={`${field.name}:${field.type}`}>
              <span>{field.name}</span>
              <code>{field.type}{field.cardinality === 'List' ? '[]' : field.cardinality === 'Optional' ? '?' : ''}</code>
            </li>
          ))}
          {hiddenCount > 0 && <li className="em-node__more">+ {hiddenCount} fields</li>}
        </ul>
      )}
      <Handle type="source" position={Position.Right} />
    </section>
  );
}
