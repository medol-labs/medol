import type { Node } from '@xyflow/react';

export const getFlowBounds = (nodes: Node[]): { x: number; y: number; width: number; height: number } => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const absolutePositionCache = new Map<string, { x: number; y: number }>();

  const getAbsolutePosition = (node: Node): { x: number; y: number } => {
    const cached = absolutePositionCache.get(node.id);
    if (cached) return cached;

    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const parentPosition = parent ? getAbsolutePosition(parent) : { x: 0, y: 0 };
    const position = {
      x: parentPosition.x + node.position.x,
      y: parentPosition.y + node.position.y
    };
    absolutePositionCache.set(node.id, position);
    return position;
  };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const position = getAbsolutePosition(node);
    const width = getNodeDimension(node, 'width');
    const height = getNodeDimension(node, 'height');
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 1280, height: 720 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

const getNodeDimension = (node: Node, key: 'width' | 'height'): number => {
  const styleValue = node.style?.[key];
  if (typeof styleValue === 'number') return styleValue;
  if (typeof styleValue === 'string') {
    const parsed = Number.parseFloat(styleValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  const measured = node.measured?.[key];
  if (typeof measured === 'number') return measured;
  return key === 'width' ? 190 : 66;
};
