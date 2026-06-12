import type { NodeProps } from '@xyflow/react';

interface SliceHeaderData extends Record<string, unknown> {
  name: string;
  resultingState?: string;
  startsLifecycle?: boolean;
  tags: string[];
}

export function SliceHeader({ data }: NodeProps) {
  const slice = data as SliceHeaderData;

  return (
    <div className="slice-header">
      <div>
        <strong>{slice.name}</strong>
        <span>{slice.startsLifecycle ? 'Lifecycle start' : slice.resultingState ?? 'Slice'}</span>
      </div>
      {slice.tags.length > 0 && (
        <ul>
          {slice.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      )}
    </div>
  );
}
