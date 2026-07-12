import { useMemo, useState } from 'react';
import { type DslLocationTarget } from '../features/dsl-editor/dslLocation';
import type { ModelSearchItem } from '../features/model-search/modelSearch';
import type {
  EmAggregate,
  EmConcept,
  EmContext,
  EmDomain,
  EmModel,
  EmSlice,
  MedolSourcePosition
} from '../lib/model';
import {
  aggregateIdFromOverviewNodeId,
  conceptIdFromOverviewNodeId,
  contextIdFromOverviewNodeId
} from '../lib/overviewFlow';
import {
  findModelItem,
  resolveActiveAggregate,
  resolveActiveConcept,
  resolveActiveContext
} from './modelSelection';
import type { PreviewMode, PreviewSyncMessage } from './studioTypes';

interface UseStudioSelectionOptions {
  model: EmModel;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
}

export const useStudioSelection = ({
  model,
  previewMode,
  onPreviewModeChange
}: UseStudioSelectionOptions) => {
  const [selectedDomainId, setSelectedDomainId] = useState<string | undefined>();
  const [selectedContextId, setSelectedContextId] = useState<string | undefined>();
  const [selectedAggregateId, setSelectedAggregateId] = useState<string | undefined>();
  const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>();
  const [selectedSliceId, setSelectedSliceId] = useState<string | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [dslFocusTarget, setDslFocusTarget] = useState<DslLocationTarget | undefined>();
  const [dslFocusPosition, setDslFocusPosition] = useState<MedolSourcePosition>();
  const [dslFocusVersion, setDslFocusVersion] = useState(0);

  const activeDomain = model.domains.find((domain) => domain.id === selectedDomainId) ?? model.domains[0];
  const activeContext = resolveActiveContext(model, selectedContextId);
  const activeAggregate = resolveActiveAggregate(activeContext, selectedAggregateId);
  const activeConcept = resolveActiveConcept(activeContext, selectedConceptId);
  const displayContext = selectedContextId ? activeContext : undefined;
  const contextDesignMode = previewMode === 'canvas'
    && Boolean(selectedContextId)
    && !selectedAggregateId
    && !selectedConceptId
    && !selectedSliceId;
  const selectedItem = useMemo(() => findModelItem(model, {
    domainId: selectedDomainId,
    contextId: selectedContextId,
    aggregateId: selectedAggregateId,
    conceptId: selectedConceptId,
    sliceId: selectedSliceId,
    nodeId: selectedNodeId
  }), [model, selectedDomainId, selectedContextId, selectedAggregateId, selectedConceptId, selectedSliceId, selectedNodeId]);

  const resetSelection = () => {
    setSelectedDomainId(undefined);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
  };

  const applySyncedSelection = (message: Partial<PreviewSyncMessage>) => {
    setSelectedDomainId(message.selectedDomainId);
    setSelectedContextId(message.selectedContextId);
    setSelectedAggregateId(message.selectedAggregateId);
    setSelectedConceptId(message.selectedConceptId);
    setSelectedSliceId(message.selectedSliceId);
    setSelectedNodeId(message.selectedNodeId);
  };

  const focusDslTarget = (target: DslLocationTarget | undefined) => {
    setDslFocusPosition(undefined);
    setDslFocusTarget(target);
    setDslFocusVersion((version) => version + 1);
  };

  const focusDslPosition = (position: MedolSourcePosition | undefined) => {
    setDslFocusTarget(undefined);
    setDslFocusPosition(position);
    setDslFocusVersion((version) => version + 1);
  };

  const selectDomain = (domain: EmDomain) => {
    setSelectedDomainId(domain.id);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('global');
    focusDslTarget({ kind: 'domain', name: domain.name });
  };

  const selectContext = (context: EmContext) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
    focusDslTarget({ kind: 'context', name: context.name });
  };

  const selectAggregate = (context: EmContext, aggregate: EmAggregate) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate.id);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
    focusDslTarget(undefined);
  };

  const selectConcept = (context: EmContext, concept: EmConcept) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(concept.id);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
    focusDslTarget({ kind: 'concept', name: concept.name });
  };

  const selectSlice = (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate?.id);
    setSelectedConceptId(aggregate
      ? undefined
      : context.concepts.find((concept) => concept.sliceIds.includes(slice.id))?.id);
    setSelectedSliceId(slice.id);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
    focusDslTarget({ kind: 'slice', name: slice.name });
  };

  const selectSearchItem = (item: ModelSearchItem) => {
    setSelectedDomainId(item.domainId);
    setSelectedContextId(item.contextId);
    setSelectedAggregateId(item.aggregateId);
    setSelectedConceptId(item.conceptId);
    setSelectedSliceId(item.sliceId);
    setSelectedNodeId(item.nodeId);
    focusDslPosition(item.sourceRange?.start);
    onPreviewModeChange(item.kind === 'domain' ? 'global' : 'canvas');
  };

  const selectOverviewGroup = (nodeId: string) => {
    const contextId = contextIdFromOverviewNodeId(nodeId);
    if (contextId) {
      const context = model.contexts.find((candidate) => candidate.id === contextId);
      if (context) selectContext(context);
      return;
    }

    const aggregateId = aggregateIdFromOverviewNodeId(nodeId);
    if (aggregateId) {
      for (const context of model.contexts) {
        const aggregate = context.aggregates.find((candidate) => candidate.id === aggregateId);
        if (!aggregate) continue;
        selectAggregate(context, aggregate);
        return;
      }
    }

    const conceptId = conceptIdFromOverviewNodeId(nodeId);
    if (conceptId) {
      for (const context of model.contexts) {
        const concept = context.concepts.find((candidate) => candidate.id === conceptId);
        if (!concept) continue;
        selectConcept(context, concept);
        return;
      }
    }
  };

  const locateMedolSource = (sourceId: string) => {
    for (const domain of model.domains) {
      if (domain.id === sourceId) {
        selectDomain(domain);
        return;
      }
      for (const context of domain.contexts) {
        if (context.id === sourceId) {
          selectContext(context);
          return;
        }
        for (const concept of context.concepts) {
          if (concept.id === sourceId) {
            selectConcept(context, concept);
            return;
          }
        }
        for (const aggregate of context.aggregates) {
          if (aggregate.id === sourceId) {
            selectAggregate(context, aggregate);
            return;
          }
          for (const slice of aggregate.slices) {
            if (slice.id === sourceId) {
              selectSlice(context, aggregate, slice);
              return;
            }
            const element = slice.elements.find((candidate) => candidate.id === sourceId);
            if (element) {
              selectSlice(context, aggregate, slice);
              setSelectedNodeId(element.id);
              onPreviewModeChange('canvas');
              return;
            }
          }
        }
        for (const slice of context.slices) {
          if (slice.id === sourceId) {
            selectSlice(context, undefined, slice);
            return;
          }
          const element = slice.elements.find((candidate) => candidate.id === sourceId);
          if (element) {
            selectSlice(context, undefined, slice);
            setSelectedNodeId(element.id);
            onPreviewModeChange('canvas');
            return;
          }
        }
      }
    }
  };

  return {
    selectedDomainId,
    selectedContextId,
    selectedAggregateId,
    selectedConceptId,
    selectedSliceId,
    selectedNodeId,
    activeDomain,
    activeContext,
    activeAggregate,
    activeConcept,
    displayContext,
    contextDesignMode,
    selectedItem,
    dslFocusTarget,
    dslFocusPosition,
    dslFocusVersion,
    setSelectedNodeId,
    resetSelection,
    applySyncedSelection,
    focusDslTarget,
    focusDslPosition,
    selectDomain,
    selectContext,
    selectAggregate,
    selectConcept,
    selectSlice,
    selectSearchItem,
    selectOverviewGroup,
    locateMedolSource
  };
};

const findDomainIdForContext = (model: EmModel, contextId: string): string | undefined => {
  return model.domains.find((domain) =>
    domain.contexts.some((candidate) => candidate.id === contextId)
  )?.id;
};
