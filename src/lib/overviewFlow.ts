import type { Edge, Node } from '@xyflow/react';
import type { EmAggregate, EmContext, EmElement, EmModel } from './model';

interface ElementOwner {
  context: EmContext;
  aggregate?: EmAggregate;
  element: EmElement;
}

const contextWidth = 584;
const contextPadding = 22;
const contextGap = 54;
const cardWidth = 250;
const cardHeight = 148;
const cardGap = 22;
const cardsPerRow = 2;
const contextHeaderHeight = 112;

export const toOverviewFlow = (model: EmModel): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const owners = collectElementOwners(model);
  let currentX = 32;

  for (const context of model.contexts) {
    const overviewItems = [
      ...context.aggregates.map((aggregate) => ({
        id: overviewAggregateNodeId(aggregate.id),
        kind: 'aggregate' as const,
        title: aggregate.name,
        metrics: aggregateMetrics(aggregate)
      })),
      ...context.concepts.map((concept) => {
        const slices = context.slices.filter((slice) => concept.sliceIds.includes(slice.id));
        return {
          id: `overview/concept/${concept.id}`,
          kind: 'concept' as const,
          title: concept.name,
          metrics: sliceMetrics(slices)
        };
      })
    ];
    const rowCount = Math.max(Math.ceil(overviewItems.length / cardsPerRow), 1);
    const contextHeight =
      contextPadding * 2 +
      contextHeaderHeight +
      rowCount * cardHeight +
      Math.max(rowCount - 1, 0) * cardGap;

    nodes.push({
      id: context.id,
      type: 'group',
      position: { x: currentX, y: 42 },
      draggable: false,
      selectable: false,
      data: { label: context.name },
      style: {
        width: contextWidth,
        height: contextHeight,
        border: '1px solid #c6d3e1',
        borderRadius: 8,
        background: 'rgba(248, 250, 252, 0.78)',
        pointerEvents: 'none'
      }
    });

    nodes.push({
      id: `${context.id}/overview`,
      type: 'contextOverview',
      parentId: context.id,
      extent: 'parent',
      position: { x: contextPadding, y: contextPadding },
      draggable: false,
      selectable: false,
      data: {
        title: context.name,
        note: context.notes[0],
        aggregates: context.aggregates.length,
        concepts: context.concepts.length,
        slices: context.slices.length + context.aggregates.reduce((total, aggregate) => total + aggregate.slices.length, 0),
        integrations: context.looseElements.filter((element) => element.kind === 'integration').length,
        risks: context.risks.length
      },
      style: {
        width: contextWidth - contextPadding * 2,
        height: contextHeaderHeight - 14
      }
    });

    for (const [index, item] of overviewItems.entries()) {
      const row = Math.floor(index / cardsPerRow);
      const column = index % cardsPerRow;
      nodes.push({
        id: item.id,
        type: 'overviewNode',
        parentId: context.id,
        extent: 'parent',
        position: {
          x: contextPadding + column * (cardWidth + cardGap),
          y: contextPadding + contextHeaderHeight + row * (cardHeight + cardGap)
        },
        data: {
          kind: item.kind,
          title: item.title,
          contextName: context.name,
          metrics: item.metrics
        },
        style: {
          width: cardWidth,
          height: cardHeight
        }
      });
    }

    currentX += contextWidth + contextGap;
  }

  const edgeKeys = new Set<string>();
  const edges: Edge[] = [];
  for (const edgeItem of model.edges) {
    const source = owners.get(edgeItem.source);
    const target = owners.get(edgeItem.target);
    if (!source?.aggregate || !target?.aggregate) continue;
    if (source.aggregate.id === target.aggregate.id) continue;

    const sourceId = overviewAggregateNodeId(source.aggregate.id);
    const targetId = overviewAggregateNodeId(target.aggregate.id);
    const key = `${sourceId}->${targetId}:${edgeItem.label ?? ''}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({
      id: `overview/${key}`,
      source: sourceId,
      target: targetId,
      label: edgeItem.label,
      type: 'smoothstep',
      animated: false,
      style: overviewEdgeStyle(edgeItem.label),
      labelStyle: { fill: '#334155', fontSize: 11, fontWeight: 700 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.88 }
    });
  }

  return { nodes, edges };
};

const sliceMetrics = (slices: EmAggregate['slices']): Record<string, number> => {
  const elements = slices.flatMap((slice) => slice.elements);
  return {
    slices: slices.length,
    commands: elements.filter((element) => element.kind === 'command').length,
    events: elements.filter((element) => element.kind === 'event').length,
    rejects: elements.filter((element) => element.kind === 'gwt' && element.metadata?.thenReject).length,
    readmodels: elements.filter((element) => element.kind === 'readmodel').length,
    hotspots: elements.filter((element) => element.kind === 'hotspot').length + slices.flatMap((slice) => slice.hotspots).length
  };
};

export const overviewAggregateNodeId = (aggregateId: string): string => `overview/aggregate/${aggregateId}`;

export const aggregateIdFromOverviewNodeId = (nodeId: string): string | undefined => {
  return nodeId.startsWith('overview/aggregate/') ? nodeId.slice('overview/aggregate/'.length) : undefined;
};

const aggregateMetrics = (aggregate: EmAggregate): Record<string, number> => {
  const elements = aggregate.slices.flatMap((slice) => slice.elements);
  return {
    slices: aggregate.slices.length,
    commands: elements.filter((element) => element.kind === 'command').length,
    events: elements.filter((element) => element.kind === 'event').length,
    rejects: elements.filter((element) => element.kind === 'gwt' && element.metadata?.thenReject).length,
    readmodels: elements.filter((element) => element.kind === 'readmodel').length,
    hotspots: elements.filter((element) => element.kind === 'hotspot').length + aggregate.slices.flatMap((slice) => slice.hotspots).length
  };
};

const collectElementOwners = (model: EmModel): Map<string, ElementOwner> => {
  const owners = new Map<string, ElementOwner>();
  for (const context of model.contexts) {
    for (const aggregate of context.aggregates) {
      for (const slice of aggregate.slices) {
        for (const element of slice.elements) {
          owners.set(element.id, { context, aggregate, element });
        }
      }
    }
    for (const slice of context.slices) {
      for (const element of slice.elements) {
        owners.set(element.id, { context, element });
      }
    }

    for (const element of context.looseElements) {
      owners.set(element.id, { context, element });
    }
  }

  return owners;
};

const overviewEdgeStyle = (label?: string): Edge['style'] => {
  if (label === 'updates') return { stroke: '#16a34a', strokeWidth: 2.2, strokeDasharray: '5 5' };
  if (label === 'issues' || label === 'triggers' || label === 'reactsTo') return { stroke: '#be185d', strokeWidth: 2.1, strokeDasharray: '8 5' };
  if (label === 'emits') return { stroke: '#ea580c', strokeWidth: 2.2 };
  return { stroke: '#94a3b8', strokeWidth: 1.8 };
};
