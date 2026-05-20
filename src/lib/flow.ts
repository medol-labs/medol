import type { Edge, Node } from '@xyflow/react';
import { EmElement, EmModel, EmSlice } from './model';
import { flattenElements } from './dslParser';

const sliceLaneOrder: EmElement['kind'][] = [
  'actor',
  'screen',
  'command',
  'event',
  'transition',
  'gwt',
  'projection',
  'automation',
  'policy',
  'hotspot'
];

const laneLabels: Partial<Record<EmElement['kind'], string>> = {
  actor: 'ACTOR',
  screen: 'UI',
  command: 'COMMAND',
  event: 'EVENT',
  transition: 'STATE',
  gwt: 'SPECIFICATION',
  projection: 'READ MODEL',
  automation: 'AUTOMATION',
  policy: 'POLICY',
  hotspot: 'HOTSPOT',
  integration: 'INTEGRATION'
};

const colors: Record<
  EmElement['kind'],
  { accent: string; fill: string }
> = {
  actor: {
    accent: '#7c3aed',
    fill: '#f3e8ff'
  },
  screen: {
    accent: '#ca8a04',
    fill: '#fef9c3'
  },
  command: {
    accent: '#2563eb',
    fill: '#dbeafe'
  },
  event: {
    accent: '#ea580c',
    fill: '#ffedd5'
  },
  transition: {
    accent: '#0891b2',
    fill: '#cffafe'
  },
  projection: {
    accent: '#16a34a',
    fill: '#dcfce7'
  },
  automation: {
    accent: '#475569',
    fill: '#f1f5f9'
  },
  policy: {
    accent: '#be185d',
    fill: '#fce7f3'
  },
  gwt: {
    accent: '#9333ea',
    fill: '#f3e8ff'
  },
  hotspot: {
    accent: '#dc2626',
    fill: '#fee2e2'
  },
  integration: {
    accent: '#0f766e',
    fill: '#ccfbf1'
  },
  aggregate: {
    accent: '#334155',
    fill: '#f8fafc'
  }
};

interface SliceLayout {
  slice: EmSlice;
  laneHeights: number[];
  height: number;
}

const columnWidth = 330;
const columnGap = 36;
const aggregateLabelWidth = 150;
const aggregateGap = 64;
const externalRowHeight = 150;
const nodeStride = 88;
const laneMinHeight = 112;
const headerHeight = 42;
const aggregatePadding = 18;
const startX = 32;

export const toReactFlow = (model: EmModel): { nodes: Node[]; edges: Edge[] } => {
  const elements = flattenElements(model);
  const nodes: Node[] = [];
  const knownIds = new Set(elements.map((element) => element.id));
  let currentY = 48;

  const looseElements = model.contexts.flatMap((context) => context.looseElements);
  if (looseElements.length > 0) {
    nodes.push({
      id: 'external-integrations',
      type: 'group',
      position: { x: startX, y: currentY },
      data: { label: 'External Integrations' },
      style: {
        width: Math.max(aggregateLabelWidth + looseElements.length * 230, 520),
        height: externalRowHeight,
        borderRadius: 8,
        border: '1px dashed #8fb7b1',
        background: 'rgba(240, 253, 250, 0.68)'
      }
    });

    for (const [index, element] of looseElements.entries()) {
      nodes.push(toNode(element, {
        x: aggregateLabelWidth + index * 220,
        y: 44
      }, 'external-integrations'));
    }

    currentY += externalRowHeight + aggregateGap;
  }

  for (const context of model.contexts) {
    for (const aggregate of context.aggregates) {
      const sliceLayouts = aggregate.slices.map(toSliceLayout);
      const aggregateWidth =
        aggregateLabelWidth +
        Math.max(aggregate.slices.length, 1) * columnWidth +
        Math.max(aggregate.slices.length - 1, 0) * columnGap +
        aggregatePadding * 2;
      const aggregateHeight =
        Math.max(...sliceLayouts.map((layout) => layout.height), headerHeight + laneMinHeight + 30) +
        aggregatePadding * 2;

      nodes.push({
        id: aggregate.id,
        type: 'group',
        position: { x: startX, y: currentY },
        data: { label: aggregate.name },
        style: {
          width: aggregateWidth,
          height: aggregateHeight,
          borderRadius: 8,
          border: '1px solid #c6d3e1',
          background: 'rgba(248, 250, 252, 0.72)'
        }
      });

      nodes.push(toNode({
        id: `${aggregate.id}/label`,
        kind: 'aggregate',
        name: aggregate.name,
        fields: aggregate.states.map((state) => ({
          name: state,
          type: 'state',
          cardinality: 'Single',
          attributes: []
        }))
      }, {
        x: 16,
        y: 54
      }, aggregate.id));

      for (const [sliceIndex, layout] of sliceLayouts.entries()) {
        const sliceX = aggregateLabelWidth + aggregatePadding + sliceIndex * (columnWidth + columnGap);
        addSliceNodes(nodes, layout, aggregate.id, { x: sliceX, y: aggregatePadding });
      }

      currentY += aggregateHeight + aggregateGap;
    }
  }

  const edges: Edge[] = model.edges
    .filter((edgeItem) => knownIds.has(edgeItem.source) && knownIds.has(edgeItem.target))
    .map((edgeItem) => ({
      id: edgeItem.id,
      source: edgeItem.source,
      target: edgeItem.target,
      label: edgeItem.label,
      animated: edgeItem.label === 'emits' || edgeItem.label === 'updates',
      type: 'smoothstep',
      style: {
        stroke: edgeItem.label === 'updates' ? '#f2c9a7' : '#94a3b8',
        strokeDasharray: edgeItem.label === 'updates' ? '4 5' : undefined,
        strokeWidth: edgeItem.label === 'updates' ? 2.2 : 1.8
      },
      labelStyle: { fill: '#334155', fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 }
    }));

  return { nodes, edges };
};

const toSliceLayout = (slice: EmSlice): SliceLayout => {
  const laneHeights = sliceLaneOrder.map((lane) => {
    const count = slice.elements.filter((element) => element.kind === lane).length;
    return Math.max(laneMinHeight, count * nodeStride + 44);
  });
  const height = headerHeight + laneHeights.reduce((sum, laneHeight) => sum + laneHeight, 0) + 30;
  return { slice, laneHeights, height };
};

const addSliceNodes = (
  nodes: Node[],
  layout: SliceLayout,
  aggregateId: string,
  position: { x: number; y: number }
): void => {
  nodes.push({
    id: layout.slice.id,
    type: 'group',
    parentId: aggregateId,
    extent: 'parent',
    position,
    data: { label: layout.slice.name },
    style: {
      width: columnWidth,
      height: layout.height,
      borderRadius: 0,
      border: '1px solid #b8c8ea',
      background: laneBackground(headerHeight, layout.laneHeights)
    }
  });

  nodes.push({
    id: `${layout.slice.id}/header`,
    type: 'sliceHeader',
    parentId: layout.slice.id,
    extent: 'parent',
    draggable: false,
    selectable: false,
    position: { x: 0, y: 9 },
    data: { label: layout.slice.name }
  });

  let laneTop = headerHeight;
  for (const [laneIndex, lane] of sliceLaneOrder.entries()) {
    nodes.push({
      id: `${layout.slice.id}/lane/${lane}`,
      type: 'laneLabel',
      parentId: layout.slice.id,
      extent: 'parent',
      draggable: false,
      selectable: false,
      position: { x: 0, y: laneTop + 4 },
      data: { label: laneLabels[lane] ?? lane.toUpperCase() }
    });
    laneTop += layout.laneHeights[laneIndex];
  }

  const laneCounts = new Map<EmElement['kind'], number>();
  const laneOffsets = toLaneOffsets(layout.laneHeights, headerHeight);
  for (const element of layout.slice.elements) {
    const lane = Math.max(sliceLaneOrder.indexOf(element.kind), 0);
    const laneCount = laneCounts.get(element.kind) ?? 0;
    laneCounts.set(element.kind, laneCount + 1);
    nodes.push(toNode(element, {
      x: 34,
      y: laneOffsets[lane] + 28 + laneCount * nodeStride
    }, layout.slice.id));
  }
};

const toNode = (element: EmElement, position: { x: number; y: number }, parentId?: string): Node => {
  const color = colors[element.kind];
  return {
    id: element.id,
    type: 'emElement',
    parentId,
    extent: parentId ? 'parent' : undefined,
    position,
    data: {
      kind: element.kind,
      name: element.name,
      fields: element.fields,
      accent: color.accent,
      fill: color.fill
    }
  };
};

const toLaneOffsets = (laneHeights: number[], top: number): number[] => {
  const offsets: number[] = [];
  let current = top;
  for (const laneHeight of laneHeights) {
    offsets.push(current);
    current += laneHeight;
  }
  return offsets;
};

const laneBackground = (top: number, laneHeights: number[]): string => {
  const separators = toLaneOffsets(laneHeights, top)
    .map((position) => `linear-gradient(to bottom, transparent ${position}px, #d3d9e6 ${position}px, #d3d9e6 ${position + 1}px, transparent ${position + 1}px)`)
    .join(', ');

  return [
    separators,
    'linear-gradient(to bottom, rgba(232, 238, 248, 0.95) 0, rgba(232, 238, 248, 0.95) 42px, rgba(248, 250, 252, 0.86) 42px, rgba(248, 250, 252, 0.86) 100%)'
  ].filter(Boolean).join(', ');
};
