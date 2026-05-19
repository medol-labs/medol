import type { Edge, Node } from '@xyflow/react';
import { EmElement, EmModel } from './model';
import { flattenElements } from './dslParser';

const sliceLaneOrder: EmElement['kind'][] = [
  'screen',
  'command',
  'event',
  'gwt',
  'projection',
  'automation',
  'policy',
  'hotspot'
];

const laneLabels: Partial<Record<EmElement['kind'], string>> = {
  screen: 'UI',
  command: 'INTERACTION',
  event: 'AGGREGATE',
  gwt: 'BUSINESS RULE',
  projection: 'READ MODEL',
  automation: 'AUTOMATION',
  policy: 'POLICY',
  hotspot: 'HOTSPOT'
};

const colors: Record<
  EmElement['kind'],
  { accent: string; fill: string }
> = {
  // Actor / User
  actor: {
    accent: '#7c3aed',
    fill: '#f3e8ff'
  },

  // UI / Screen (官方通常偏黄)
  screen: {
    accent: '#ca8a04',
    fill: '#fef9c3'
  },

  // Command (经典蓝)
  command: {
    accent: '#2563eb',
    fill: '#dbeafe'
  },

  // Event (官方 Event Modeling 核心橙色)
  event: {
    accent: '#ea580c',
    fill: '#ffedd5'
  },

  // Read Model / Projection (经典绿色)
  projection: {
    accent: '#16a34a',
    fill: '#dcfce7'
  },

  // Automation / External automation
  automation: {
    accent: '#475569',
    fill: '#f1f5f9'
  },

  // Policy / Rule
  policy: {
    accent: '#be185d',
    fill: '#fce7f3'
  },

  // Given / When / Then
  gwt: {
    accent: '#9333ea',
    fill: '#f3e8ff'
  },

  // Hotspot / Problem / Risk
  hotspot: {
    accent: '#dc2626',
    fill: '#fee2e2'
  },

  // Aggregate / Swimlane
  aggregate: {
    accent: '#334155',
    fill: '#f8fafc'
  }
};

export const toReactFlow = (model: EmModel): { nodes: Node[]; edges: Edge[] } => {
  const elements = flattenElements(model);
  const nodes: Node[] = [];
  const knownIds = new Set(elements.map((element) => element.id));
  const slices = model.contexts.flatMap((context) =>
    context.aggregates.flatMap((aggregate) =>
      aggregate.slices.map((slice) => ({ context, aggregate, slice }))
    )
  );

  const columnWidth = 330;
  const columnGap = 36;
  const laneHeight = 150;
  const headerHeight = 42;

  for (const [sliceIndex, group] of slices.entries()) {
    const height = headerHeight + sliceLaneOrder.length * laneHeight + 30;
    nodes.push({
      id: group.slice.id,
      type: 'group',
      position: { x: 32 + sliceIndex * (columnWidth + columnGap), y: 48 },
      data: { label: group.slice.name },
      style: {
        width: columnWidth,
        height,
        borderRadius: 0,
        border: '1px solid #b8c8ea',
        background: laneBackground(headerHeight, laneHeight)
      }
    });
    nodes.push({
      id: `${group.slice.id}/header`,
      type: 'sliceHeader',
      parentId: group.slice.id,
      extent: 'parent',
      draggable: false,
      selectable: false,
      position: { x: 0, y: 9 },
      data: { label: group.slice.name }
    });

    for (const [laneIndex, lane] of sliceLaneOrder.entries()) {
      nodes.push({
        id: `${group.slice.id}/lane/${lane}`,
        type: 'laneLabel',
        parentId: group.slice.id,
        extent: 'parent',
        draggable: false,
        selectable: false,
        position: { x: 0, y: headerHeight + laneIndex * laneHeight + 4 },
        data: { label: laneLabels[lane] ?? lane.toUpperCase() }
      });
    }

    const laneCounts = new Map<EmElement['kind'], number>();
    for (const element of group.slice.elements.filter((item) => item.kind !== 'actor')) {
      const lane = Math.max(sliceLaneOrder.indexOf(element.kind), 0);
      const laneCount = laneCounts.get(element.kind) ?? 0;
      laneCounts.set(element.kind, laneCount + 1);
      nodes.push(toNode(element, {
        x: 34,
        y: headerHeight + 28 + lane * laneHeight + laneCount * 82
      }, group.slice.id));
    }
  }

  const looseElements = model.contexts.flatMap((context) => context.looseElements);
  for (const [index, element] of looseElements.entries()) {
    nodes.push(toNode(element, {
      x: 48 + (index % 5) * 230,
      y: 40 + Math.floor(index / 5) * 160
    }));
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

const laneBackground = (headerHeight: number, laneHeight: number): string => {
  const separators = sliceLaneOrder
    .map((_, index) => headerHeight + index * laneHeight)
    .map((position) => `linear-gradient(to bottom, transparent ${position}px, #d3d9e6 ${position}px, #d3d9e6 ${position + 1}px, transparent ${position + 1}px)`)
    .join(', ');

  return [
    separators,
    'linear-gradient(to bottom, rgba(232, 238, 248, 0.95) 0, rgba(232, 238, 248, 0.95) 42px, rgba(248, 250, 252, 0.86) 42px, rgba(248, 250, 252, 0.86) 100%)'
  ].filter(Boolean).join(', ');
};
