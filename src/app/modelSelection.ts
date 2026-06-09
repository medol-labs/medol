import type { EmAggregate, EmContext, EmDomain, EmElement, EmModel, EmSlice } from '../lib/model';

export interface StudioSelection {
  domainId?: string;
  contextId?: string;
  aggregateId?: string;
  sliceId?: string;
  nodeId?: string;
}

export interface SelectedModelItem {
  type: 'domain' | 'context' | 'aggregate' | 'slice' | 'element';
  name: string;
  domain?: EmDomain;
  context?: EmContext;
  aggregate?: EmAggregate;
  slice?: EmSlice;
  element?: EmElement;
}

export const resolveActiveContext = (model: EmModel, contextId?: string): EmContext | undefined => {
  return model.contexts.find((context) => context.id === contextId) ?? model.contexts[0];
};

export const resolveActiveAggregate = (
  context: EmContext | undefined,
  aggregateId?: string
): EmAggregate | undefined => {
  return context?.aggregates.find((aggregate) => aggregate.id === aggregateId);
};

export const findModelItem = (
  model: EmModel,
  selection: StudioSelection
): SelectedModelItem | undefined => {
  for (const domain of model.domains) {
    if (selection.nodeId === domain.id || (selection.domainId === domain.id && !selection.contextId && !selection.nodeId)) {
      return { type: 'domain', name: domain.name, domain };
    }
  }

  for (const context of model.contexts) {
    if (selection.nodeId === context.id || (selection.contextId === context.id && !selection.nodeId && !selection.aggregateId)) {
      return { type: 'context', name: context.name, context };
    }

    for (const aggregate of context.aggregates) {
      if (
        selection.nodeId === aggregate.id ||
        (selection.aggregateId === aggregate.id && !selection.sliceId && !selection.nodeId)
      ) {
        return { type: 'aggregate', name: aggregate.name, context, aggregate };
      }

      if (selection.nodeId === `${aggregate.id}/label`) {
        return { type: 'aggregate', name: aggregate.name, context, aggregate };
      }

      for (const slice of aggregate.slices) {
        if (
          selection.nodeId === slice.id ||
          selection.nodeId === `${slice.id}/header` ||
          selection.nodeId === `${slice.id}/summary` ||
          (selection.sliceId === slice.id && !selection.nodeId)
        ) {
          return { type: 'slice', name: slice.name, context, aggregate, slice };
        }

        const element = slice.elements.find((candidate) => candidate.id === selection.nodeId);
        if (element) {
          return { type: 'element', name: element.name, context, aggregate, slice, element };
        }
      }
    }

    const looseElement = context.looseElements.find((element) => element.id === selection.nodeId);
    if (looseElement) {
      return { type: 'element', name: looseElement.name, context, element: looseElement };
    }
  }

  return undefined;
};
