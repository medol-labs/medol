import type { NodeProps } from '@xyflow/react';

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
        <strong>{concept.name}</strong>
      </div>
      {concept.states.length > 0 && (
        <ul>
          {concept.states.map((state) => <li key={state}>{state}</li>)}
        </ul>
      )}
    </section>
  );
}
