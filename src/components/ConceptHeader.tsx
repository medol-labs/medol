import type { NodeProps } from '@xyflow/react';
import { OverflowText } from './ui/overflow-text';

interface ConceptHeaderData extends Record<string, unknown> {
  name: string;
  states: string[];
  sliceCount: number;
}

export function ConceptHeader({ data }: NodeProps) {
  const concept = data as ConceptHeaderData;

  return (
    <section className="concept-header">
      <div>
        <span>Concept · organizes {concept.sliceCount} slices</span>
        <OverflowText as="strong" text={concept.name} />
      </div>
      {concept.states.length > 0 && (
        <ul>
          {concept.states.map((state, index) => <OverflowText as="li" key={`${state}:${index}`} text={state} />)}
        </ul>
      )}
    </section>
  );
}
