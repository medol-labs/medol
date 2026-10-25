import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Scan } from 'lucide-react';
import { OverflowText } from './ui/overflow-text';

export function ContextHeader({ data }: NodeProps) {
  const name = String(data.name ?? '');
  const collapsed = Boolean(data.collapsed);
  return <section className="canvas-context-header">
    <Handle type="target" position={Position.Left} />
    <button type="button" className="nodrag nopan" aria-label={`${collapsed ? 'Expand' : 'Collapse'} context ${name}`}
      title={collapsed ? 'Expand context' : 'Collapse context'} disabled={!data.onToggle} onClick={(event) => {
        event.stopPropagation();
        (data.onToggle as (() => void) | undefined)?.();
      }}>{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
    <div><small>{data.builtin ? 'BUILT-IN / READ ONLY' : 'CONTEXT'}</small><OverflowText as="strong" text={name} /></div>
    <span>{String(data.sliceCount)} slices</span>
    <button type="button" className="nodrag nopan" aria-label={`Open local view ${name}`} title="Open local view" onClick={(event) => {
      event.stopPropagation();
      (data.onOpen as (() => void) | undefined)?.();
    }}><Scan size={16} /></button>
    <Handle type="source" position={Position.Right} />
  </section>;
}
