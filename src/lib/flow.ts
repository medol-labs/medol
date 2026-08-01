import type { Edge, Node } from '@xyflow/react';
import { EmContext, EmElement, EmModel, EmSlice } from './model';

const sliceLaneOrder: EmElement['kind'][] = [
  'actor',
  'screen',
  'command',
  'event',
  'gwt',
  'readmodel',
  'automation',
  'hotspot'
];

const laneLabels: Partial<Record<EmElement['kind'], string>> = {
  actor: 'ACTOR',
  screen: 'UI',
  command: 'COMMAND',
  event: 'EVENT',
  gwt: 'SPECIFICATION',
  readmodel: 'READ MODEL',
  automation: 'AUTOMATION',
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
    accent: '#2f80ed',
    fill: '#dbeafe'
  },
  event: {
    accent: '#d6a300',
    fill: '#fff4b8'
  },
  readmodel: {
    accent: '#2f9e44',
    fill: '#dff5e3'
  },
  automation: {
    accent: '#475569',
    fill: '#f1f5f9'
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
  lanes: EmElement['kind'][];
  laneHeights: number[];
  height: number;
}

export interface ReactFlowOptions {
  contextId?: string;
  aggregateId?: string;
  conceptId?: string;
  sliceId?: string;
  compactSlices?: boolean;
  showFields?: boolean;
}

const columnWidth = 330;
const columnGap = 36;
const aggregateLabelWidth = 220;
const aggregateGap = 64;
const externalRowHeight = 150;
const laneMinHeight = 112;
const headerHeight = 68;
const conceptHeaderHeight = 64;
const aggregatePadding = 18;
const startX = 32;
const contextPadding = 24;
const contextHeaderHeight = 44;
const compactColumns = 4;
const compactColumnWidth = 250;
const compactColumnGap = 24;
const compactRowHeight = 194;

export const toReactFlow = (model: EmModel, options: ReactFlowOptions = {}): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  let currentY = 48;
  const contexts = model.contexts
    .filter((context) => !options.contextId || context.id === options.contextId)
    .map((context) => ({
      ...context,
      aggregates: toCanvasGroups(context)
        .filter((group) =>
          (!options.aggregateId || group.id === options.aggregateId)
          && (!options.conceptId || group.id === options.conceptId)
        )
        .map((aggregate) => ({
          ...aggregate,
          slices: aggregate.slices.filter((slice) => !options.sliceId || slice.id === options.sliceId)
        }))
    }));

  const looseElements = contexts.flatMap((context) => context.looseElements);
  if (looseElements.length > 0) {
    nodes.push({
      id: 'external-integrations',
      type: 'group',
      position: { x: startX, y: currentY },
      draggable: false,
      selectable: false,
      data: { label: 'External Integrations' },
      style: {
        width: Math.max(aggregateLabelWidth + looseElements.length * 230, 520),
        height: externalRowHeight,
        borderRadius: 8,
        border: '1px dashed #8fb7b1',
        background: 'rgba(240, 253, 250, 0.68)',
        pointerEvents: 'none'
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

  if (options.compactSlices) {
    for (const context of contexts) {
      const aggregateLayouts = context.aggregates.map((aggregate) => ({
        aggregate,
        ...compactAggregateSize(aggregate.slices.length, aggregate)
      }));
      const contextWidth = Math.max(...aggregateLayouts.map((layout) => layout.width), 520) + contextPadding * 2;
      const contextHeight =
        contextHeaderHeight +
        contextPadding * 2 +
        aggregateLayouts.reduce((sum, layout) => sum + layout.height, 0) +
        Math.max(aggregateLayouts.length - 1, 0) * aggregateGap;

      nodes.push({
        id: context.id,
        type: 'group',
        position: { x: startX, y: currentY },
        draggable: false,
        selectable: false,
        data: { label: context.name },
        style: {
          width: contextWidth,
          height: contextHeight,
          borderRadius: 8,
          border: '1px solid #b8c8ea',
          background: 'rgba(239, 246, 255, 0.52)',
          pointerEvents: 'none'
        }
      });

      nodes.push({
        id: `${context.id}/header`,
        type: 'laneLabel',
        parentId: context.id,
        extent: 'parent',
        draggable: false,
        selectable: false,
        position: { x: 0, y: 14 },
        data: { label: `CONTEXT / ${context.name}` },
        style: {
          width: contextWidth
        }
      });

      let aggregateY = contextHeaderHeight + contextPadding;
      for (const layout of aggregateLayouts) {
        addCompactAggregateNodes(nodes, layout.aggregate, context.id, {
          x: contextPadding,
          y: aggregateY
        });
        aggregateY += layout.height + aggregateGap;
      }

      currentY += contextHeight + aggregateGap;
    }
  } else {
  for (const context of contexts) {
    for (const aggregate of context.aggregates) {
      const sliceLayouts = toAggregateSliceLayouts(aggregate.slices, options.showFields ?? false);
      const aggregateWidth =
        groupLabelWidth(aggregate) +
        Math.max(aggregate.slices.length, 1) * columnWidth +
        Math.max(aggregate.slices.length - 1, 0) * columnGap +
        aggregatePadding * 2;
      const aggregateHeight =
        Math.max(...sliceLayouts.map((layout) => layout.height), headerHeight + laneMinHeight + 30) +
        aggregatePadding * 2 +
        groupTopOffset(aggregate);

      nodes.push({
        id: aggregate.id,
        type: 'group',
        position: { x: startX, y: currentY },
        draggable: false,
        selectable: false,
        data: { label: aggregate.name },
        style: {
          width: aggregateWidth,
          height: aggregateHeight,
          borderRadius: 8,
          border: aggregate.kind === 'concept' ? '1px solid #8fb7b1' : '1px solid #c6d3e1',
          background: aggregate.kind === 'concept'
            ? 'rgba(240, 253, 250, 0.68)'
            : 'rgba(248, 250, 252, 0.72)',
          pointerEvents: 'none'
        }
      });

      addGroupIdentityNode(nodes, aggregate, aggregateWidth);

      for (const [sliceIndex, layout] of sliceLayouts.entries()) {
        const sliceX = groupLabelWidth(aggregate) + aggregatePadding + sliceIndex * (columnWidth + columnGap);
        addSliceNodes(nodes, layout, aggregate.id, {
          x: sliceX,
          y: aggregatePadding + groupTopOffset(aggregate)
        }, options.showFields ?? false);
      }

      currentY += aggregateHeight + aggregateGap;
    }
  }
  }

  const visibleElementIds = new Set(nodes.filter((node) => node.type === 'emElement').map((node) => node.id));
  const visibleSummaryIds = new Set(nodes.filter((node) => node.type === 'sliceSummary').map((node) => node.id));
  const edges: Edge[] = model.edges
    .filter((edgeItem) => visibleElementIds.has(edgeItem.source) && visibleElementIds.has(edgeItem.target))
    .map((edgeItem) => {
      const visual = toEdgeVisual(edgeItem.label);
      return {
        id: edgeItem.id,
        source: edgeItem.source,
        target: edgeItem.target,
        label: edgeItem.label,
        animated: false,
        type: 'smoothstep',
        style: {
          stroke: visual.stroke,
          strokeDasharray: visual.strokeDasharray,
          strokeWidth: visual.strokeWidth
        },
        labelStyle: { fill: visual.labelColor, fontSize: 11, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 }
      };
    });

  if (options.compactSlices) {
    for (const context of contexts) {
      for (const aggregate of context.aggregates) {
        for (let index = 0; index < aggregate.slices.length - 1; index += 1) {
          const source = `${aggregate.slices[index].id}/summary`;
          const target = `${aggregate.slices[index + 1].id}/summary`;
          if (!visibleSummaryIds.has(source) || !visibleSummaryIds.has(target)) continue;
          edges.push({
            id: `timeline/${source}->${target}`,
            source,
            target,
            label: 'then',
            animated: false,
            type: 'smoothstep',
            style: {
              stroke: '#94a3b8',
              strokeDasharray: '5 5',
              strokeWidth: 1.8
            },
            labelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 700 },
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.88 }
          });
        }
      }
    }
  }

  return { nodes, edges };
};

interface CanvasGroup {
  id: string;
  name: string;
  kind: 'aggregate' | 'concept' | 'context';
  states: string[];
  slices: EmSlice[];
}

const toCanvasGroups = (context: EmContext): CanvasGroup[] => {
  const assignedSliceIds = new Set<string>();
  const conceptGroups = context.concepts.map((concept) => {
    const slices = context.slices.filter((slice) => {
      if (!concept.sliceIds.includes(slice.id) || assignedSliceIds.has(slice.id)) return false;
      assignedSliceIds.add(slice.id);
      return true;
    });
    return {
      id: concept.id,
      name: concept.name,
      kind: 'concept' as const,
      states: concept.states,
      slices
    };
  }).filter((group) => group.slices.length > 0);
  const unboundedSlices = context.slices.filter((slice) => !assignedSliceIds.has(slice.id));

  return [
    ...context.aggregates.map((aggregate) => ({ ...aggregate, kind: 'aggregate' as const })),
    ...conceptGroups,
    ...(unboundedSlices.length > 0 ? [{
      id: `${context.id}/context-slices`,
      name: 'Context Slices',
      kind: 'context' as const,
      states: [],
      slices: unboundedSlices
    }] : [])
  ];
};

const addCompactAggregateNodes = (
  nodes: Node[],
  aggregate: CanvasGroup,
  parentId: string,
  position: { x: number; y: number }
): void => {
  const { width: aggregateWidth, height: aggregateHeight } = compactAggregateSize(aggregate.slices.length, aggregate);

  nodes.push({
    id: aggregate.id,
    type: 'group',
    parentId,
    extent: 'parent',
    position,
    draggable: false,
    selectable: false,
    data: { label: aggregate.name },
    style: {
      width: aggregateWidth,
      height: aggregateHeight,
      borderRadius: 8,
      border: aggregate.kind === 'concept' ? '1px solid #8fb7b1' : '1px solid #c6d3e1',
      background: aggregate.kind === 'concept'
        ? 'rgba(240, 253, 250, 0.68)'
        : 'rgba(248, 250, 252, 0.78)',
      pointerEvents: 'none'
    }
  });

  addGroupIdentityNode(nodes, aggregate, aggregateWidth);

  for (const [sliceIndex, slice] of aggregate.slices.entries()) {
    nodes.push(toSliceSummaryNode(slice, {
      x: groupLabelWidth(aggregate) + aggregatePadding + (sliceIndex % compactColumns) * (compactColumnWidth + compactColumnGap),
      y: (aggregate.kind === 'concept' ? aggregatePadding + conceptHeaderHeight : 54)
        + Math.floor(sliceIndex / compactColumns) * compactRowHeight
    }, aggregate.id));
  }
};

const groupLabelWidth = (group: CanvasGroup): number =>
  group.kind === 'concept' ? 0 : aggregateLabelWidth;

const groupTopOffset = (group: CanvasGroup): number =>
  group.kind === 'concept' ? conceptHeaderHeight : 0;

const addGroupIdentityNode = (
  nodes: Node[],
  group: CanvasGroup,
  groupWidth: number
): void => {
  if (group.kind === 'concept') {
    nodes.push({
      id: `${group.id}/label`,
      type: 'conceptHeader',
      parentId: group.id,
      extent: 'parent',
      position: { x: aggregatePadding, y: 12 },
      draggable: false,
      selectable: false,
      data: {
        name: group.name,
        states: group.states,
        sliceCount: group.slices.length
      },
      style: {
        width: groupWidth - aggregatePadding * 2,
        height: 48
      }
    });
    return;
  }

  nodes.push(toNode({
    id: `${group.id}/label`,
    kind: 'aggregate',
    name: group.name,
    fields: group.states.map((state) => ({
      name: state,
      type: 'state',
      cardinality: 'Single',
      attributes: []
    })),
    metadata: {
      groupKind: group.kind
    }
  }, {
    x: 16,
    y: 54
  }, group.id));
};

const formatSliceTags = (slice: EmSlice): string[] =>
  slice.tags.map((tag) => tag.expression ? `${tag.name} = ${tag.expression}` : tag.name);

const compactAggregateSize = (sliceCount: number, group?: CanvasGroup): { width: number; height: number } => {
  const columns = Math.min(Math.max(sliceCount, 1), compactColumns);
  const rows = Math.max(Math.ceil(sliceCount / compactColumns), 1);
  return {
    width:
      (group ? groupLabelWidth(group) : aggregateLabelWidth) +
      columns * compactColumnWidth +
      Math.max(columns - 1, 0) * compactColumnGap +
      aggregatePadding * 2,
    height: Math.max(250, 54 + rows * compactRowHeight + 24 + (group ? groupTopOffset(group) : 0))
  };
};

const toSliceSummaryNode = (slice: EmSlice, position: { x: number; y: number }, parentId: string): Node => {
  const elements = slice.elements;
  return {
    id: `${slice.id}/summary`,
    type: 'sliceSummary',
    parentId,
    extent: 'parent',
    position,
    data: {
      name: slice.name,
      resultingState: slice.resultingState,
      startsLifecycle: slice.startsLifecycle,
      tags: formatSliceTags(slice),
      metrics: {
        commands: elements.filter((element) => element.kind === 'command').length,
        events: elements.filter((element) => element.kind === 'event').length,
        rejects: elements.filter((element) => element.kind === 'gwt' && element.metadata?.thenReject).length,
        readmodels: elements.filter((element) => element.kind === 'readmodel').length,
        automations: elements.filter((element) => element.kind === 'automation' || element.kind === 'gwt').length,
        hotspots: elements.filter((element) => element.kind === 'hotspot').length + slice.hotspots.length
      }
    },
    style: {
      width: 220,
      height: 166
    }
  };
};

const toEdgeVisual = (label?: string): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  labelColor: string;
} => {
  if (label === 'emits') {
    return { stroke: '#ea580c', strokeWidth: 2.4, labelColor: '#9a3412' };
  }
  if (label === 'rejects') {
    return { stroke: '#dc2626', strokeWidth: 2.2, labelColor: '#991b1b' };
  }
  if (label === 'updates') {
    return { stroke: '#16a34a', strokeWidth: 2.2, strokeDasharray: '5 5', labelColor: '#166534' };
  }
  if (label === 'invokes') {
    return { stroke: '#2563eb', strokeWidth: 2, labelColor: '#1d4ed8' };
  }
  if (label === 'triggers' || label === 'reactsTo') {
    return { stroke: '#be185d', strokeWidth: 2, strokeDasharray: '8 5', labelColor: '#9d174d' };
  }
  if (label === 'given' || label === 'when' || label === 'then') {
    return { stroke: '#9333ea', strokeWidth: 1.8, strokeDasharray: '3 5', labelColor: '#7e22ce' };
  }
  return { stroke: '#94a3b8', strokeWidth: 1.8, labelColor: '#334155' };
};

const toAggregateSliceLayouts = (slices: EmSlice[], showFields: boolean): SliceLayout[] => {
  const lanes = sliceLaneOrder.filter((lane) =>
    slices.some((slice) => slice.elements.some((element) => element.kind === lane))
  );
  const laneHeights = lanes.map((lane) => {
    const maxContentHeight = Math.max(
      ...slices.map((slice) => {
        const elements = slice.elements.filter((element) => element.kind === lane);
        return elements.reduce(
          (total, element) => total + elementHeight(element, showFields) + 14,
          0
        );
      }),
      laneMinHeight - 44
    );
    return Math.max(laneMinHeight, maxContentHeight + 44);
  });
  const height = headerHeight + laneHeights.reduce((sum, laneHeight) => sum + laneHeight, 0) + 30;
  return slices.map((slice) => ({ slice, lanes, laneHeights, height }));
};

const addSliceNodes = (
  nodes: Node[],
  layout: SliceLayout,
  aggregateId: string,
  position: { x: number; y: number },
  showFields: boolean
): void => {
  nodes.push({
    id: layout.slice.id,
    type: 'group',
    parentId: aggregateId,
    extent: 'parent',
    position,
    draggable: false,
    selectable: false,
    data: { label: layout.slice.name },
    style: {
      width: columnWidth,
      height: layout.height,
      borderRadius: 0,
      border: '1px solid #b8c8ea',
      background: laneBackground(headerHeight, layout.laneHeights),
      pointerEvents: 'none'
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
    data: {
      name: layout.slice.name,
      resultingState: layout.slice.resultingState,
      startsLifecycle: layout.slice.startsLifecycle,
      tags: formatSliceTags(layout.slice)
    }
  });

  let laneTop = headerHeight;
  for (const [laneIndex, lane] of layout.lanes.entries()) {
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

  const lanePositions = new Map<EmElement['kind'], number>();
  const laneOffsets = toLaneOffsets(layout.laneHeights, headerHeight);
  for (const element of layout.slice.elements) {
    const lane = layout.lanes.indexOf(element.kind);
    if (lane < 0) continue;
    const lanePosition = lanePositions.get(element.kind) ?? 0;
    lanePositions.set(element.kind, lanePosition + elementHeight(element, showFields) + 14);
    nodes.push(toNode(element, {
      x: 34,
      y: laneOffsets[lane] + 28 + lanePosition
    }, layout.slice.id, showFields));
  }
};

const toNode = (
  element: EmElement,
  position: { x: number; y: number },
  parentId?: string,
  showFields = false
): Node => {
  const color = colors[element.kind];
  const resolvedShowFields = showFields || Boolean(element.metadata?.groupKind);
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
      showFields: resolvedShowFields,
      ...(element.metadata?.thenReject ? { outcome: `Reject: ${element.metadata.thenReject}` } : {}),
      ...(element.metadata?.thenError ? { outcome: `Error: ${element.metadata.thenError}` } : {}),
      ...(element.kind === 'gwt' ? {
        details: [
          ...(element.metadata?.specification ? [`Spec: ${element.metadata.specification}`] : []),
          ...Object.entries(element.metadata ?? {})
            .filter(([key]) => /^expression\d+$/.test(key))
            .sort(([left], [right]) => Number(left.slice(10)) - Number(right.slice(10)))
            .map(([, expression]) => expression)
        ]
      } : {}),
      ...(element.metadata?.groupKind === 'concept' ? { kindLabel: 'Concept' } : {}),
      ...(element.metadata?.groupKind === 'context' ? { kindLabel: 'Context' } : {}),
      accent: color.accent,
      fill: color.fill
    },
    style: resolvedShowFields ? { minHeight: elementHeight(element, true) } : undefined
  };
};

const elementHeight = (element: EmElement, showFields: boolean): number => {
  if (element.kind === 'gwt' && (element.metadata?.thenReject || element.metadata?.thenError || element.metadata?.specification)) return 142;
  if (!showFields || element.fields.length === 0) return 76;
  return 58 + element.fields.length * 20 + 18;
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
