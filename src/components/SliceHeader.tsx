import type { NodeProps } from '@xyflow/react';
import { OverflowText } from './ui/overflow-text';

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
        <OverflowText as="strong" text={slice.name} />
        <span>{slice.startsLifecycle ? 'Lifecycle start' : slice.resultingState ?? 'Slice'}</span>
      </div>
      {slice.tags.length > 0 && (
        <ul>
          {slice.tags.map((tag) => <OverflowText as="li" key={tag} text={tag} />)}
        </ul>
      )}
    </div>
  );
}
