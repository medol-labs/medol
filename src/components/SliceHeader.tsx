import type { NodeProps } from '@xyflow/react';

export function SliceHeader({ data }: NodeProps) {
  return <div className="slice-header">{String(data.label ?? '')}</div>;
}

