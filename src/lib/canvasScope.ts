import type { EmContext, EmEdge, EmModel } from './model';
import { isBuiltinDefinition } from './modelSource';

export interface CanvasScopeOptions {
  domainId?: string;
  contextId?: string;
  aggregateId?: string;
  conceptId?: string;
  sliceId?: string;
  localContextOnly?: boolean;
  collapsedContextIds?: string[];
}

export const unassignedCanvasId = 'canvas:unassigned';
export const builtinCanvasId = 'canvas:builtins';
export function canvasBoards(model: EmModel) {
  const assigned = new Set(model.domains.flatMap((domain) => domain.contexts.map((context) => context.id)));
  const builtins = model.contexts.filter(isBuiltinDefinition);
  const domains = model.domains.filter((domain) => !isBuiltinDefinition(domain));
  const unassigned = model.contexts.filter((context) => !assigned.has(context.id) && !isBuiltinDefinition(context));
  return [
    ...domains.map((domain) => ({ id: domain.id, name: domain.name, kind: 'domain' as const,
      contexts: model.contexts.filter((context) => !isBuiltinDefinition(context) && domain.contexts.some((item) => item.id === context.id)) })),
    ...((!domains.length && !builtins.length) || unassigned.length ? [{ id: unassignedCanvasId, kind: 'unassigned' as const,
      name: domains.length ? 'Unassigned contexts' : 'Model', contexts: unassigned }] : []),
    ...(builtins.length ? [{ id: builtinCanvasId, name: 'Built-in capabilities', kind: 'builtin' as const, contexts: builtins }] : [])
  ];
}

export function resolveCanvasBoard(model: EmModel, options: Pick<CanvasScopeOptions, 'domainId' | 'contextId'> = {}) {
  const boards = canvasBoards(model);
  if (options.domainId) return boards.find((board) => board.id === options.domainId);
  if (options.contextId) return boards.find((board) => board.contexts.some((context) => context.id === options.contextId));
  return boards[0];
}

const slicesOf = (context: EmContext) => [...context.slices, ...context.aggregates.flatMap((item) => item.slices)];

// These edges visualize explicit field sources; they are not new domain behavior.
export function canvasRelations(model: EmModel): EmEdge[] {
  const records = model.contexts.flatMap((context) => [...context.looseElements,
    ...slicesOf(context).flatMap((slice) => slice.elements)].map((element) => ({ context, element })));
  const projections = records.filter(({ element }) => element.kind === 'readmodel');
  const edges = [...model.edges];
  for (const { element } of records) {
    for (const field of element.fields) {
      for (const path of new Set(field.mapping?.sources ?? [])) {
        const parts = path.split('.');
        const fieldName = parts.pop();
        const ownerName = parts.pop();
        const contextName = parts.join('.');
        const matches = projections.filter((item) => (!contextName || item.context.name === contextName)
          && item.element.name === ownerName && item.element.fields.some((source) => source.name === fieldName));
        // Ambiguous or unresolved references must not invent a connection.
        if (matches.length !== 1) continue;
        edges.push({ id: `canvas/from/${element.id}/${field.name}/${path}`,
          source: matches[0].element.id, target: element.id, label: 'from' });
      }
    }
  }
  return edges;
}

export function scopeCanvasModel(model: EmModel, options: CanvasScopeOptions): EmModel {
  const relations = canvasRelations(model);
  const board = resolveCanvasBoard(model, options);
  const contexts = (board?.contexts ?? []).filter((context) => !options.localContextOnly || context.id === options.contextId).map((context) => {
    if (!options.localContextOnly) return context;
    const sliceIds = new Set(slicesOf(context).filter((slice) => (!options.sliceId || slice.id === options.sliceId)
      && (!options.aggregateId || context.aggregates.some((owner) => owner.id === options.aggregateId && owner.slices.includes(slice)))
      && (!options.conceptId || context.concepts.some((owner) => owner.id === options.conceptId && owner.sliceIds.includes(slice.id))))
      .map((slice) => slice.id));
    return { ...context,
      slices: context.slices.filter((slice) => sliceIds.has(slice.id)),
      aggregates: context.aggregates.map((owner) => ({ ...owner, slices: owner.slices.filter((slice) => sliceIds.has(slice.id)) }))
        .filter((owner) => owner.slices.length),
      concepts: context.concepts.map((owner) => ({ ...owner, sliceIds: owner.sliceIds.filter((id) => sliceIds.has(id)) }))
        .filter((owner) => owner.sliceIds.length)
    };
  });
  const contextByElement = new Map<string, string>();
  for (const context of contexts) {
    for (const element of [...context.looseElements, ...slicesOf(context).flatMap((slice) => slice.elements)]) {
      contextByElement.set(element.id, context.id);
    }
  }
  return { ...model, contexts, edges: relations.filter((edge) => contextByElement.has(edge.source) && contextByElement.has(edge.target)) };
}
