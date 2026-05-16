import type { NodeProps } from '@xyflow/react';

export function LaneLabel({ data }: NodeProps) {
  return <div className="lane-label">{String(data.label ?? '')}</div>;
}

