import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EmField, EmElementKind } from '../lib/model';
import { OverflowText } from './ui/overflow-text';

interface EmNodeData extends Record<string, unknown> {
  kind: EmElementKind;
  name: string;
  fields: EmField[];
  accent: string;
  fill: string;
  showFields?: boolean;
  outcome?: string;
  details?: string[];
  kindLabel?: string;
}

const labels: Record<EmElementKind, string> = {
  actor: 'Actor',
  screen: 'UI',
  command: 'Command',
  event: 'Event',
  readmodel: 'Read Model',
  automation: 'Automation',
  policy: 'Policy',
  gwt: 'GWT',
  aggregate: 'Aggregate',
  hotspot: 'Hotspot',
  integration: 'Integration'
};

export function EmNode({ data, selected }: NodeProps) {
  const node = data as EmNodeData;
  const showFields = node.showFields === true;
  const fields = showFields ? node.fields : [];

  return (
    <section className={selected ? 'em-node is-selected' : 'em-node'} style={{ borderColor: node.accent, background: node.fill }}>
      <Handle type="target" position={Position.Left} />
      <header className="em-node__header">
        <span className="em-node__kind" style={{ color: node.accent }}>{node.kindLabel ?? labels[node.kind]}</span>
        <OverflowText as="strong" text={node.name} />
      </header>
      {node.outcome && <p className="em-node__outcome">{node.outcome}</p>}
      {node.details && node.details.length > 0 && (
        <ul className="em-node__details">
          {node.details.map((detail, index) => <li key={`${detail}:${index}`}>{detail}</li>)}
        </ul>
      )}
      {fields.length > 0 && (
        <ul className="em-node__fields">
          {fields.map((field) => (
            <li key={`${field.name}:${field.type}`}>
              <OverflowText text={field.name} />
              <code title={field.type}>
                {field.type}
                {field.cardinality === 'OptionalList' ? '[]?' : field.cardinality === 'List' ? '[]' : field.cardinality === 'Optional' ? '?' : ''}
              </code>
            </li>
          ))}
        </ul>
      )}
      {!showFields && node.fields.length > 0 && (
        <div className="em-node__field-count">{node.fields.length} fields</div>
      )}
      <Handle type="source" position={Position.Right} />
    </section>
  );
}
