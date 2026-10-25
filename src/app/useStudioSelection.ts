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
  resolveActiveConcept
} from './modelSelection';
import type { PreviewMode, PreviewSyncMessage } from './studioTypes';
import { canvasBoards, resolveCanvasBoard, unassignedCanvasId } from '../lib/canvasScope';
import { canLocateInEditor } from '../lib/modelSource';

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
  const [localContextOnly, setLocalContextOnly] = useState(false);
  const [collapsedContextIds, setCollapsedContextIds] = useState<string[]>([]);
  const [dslFocusTarget, setDslFocusTarget] = useState<DslLocationTarget | undefined>();
  const [dslFocusPosition, setDslFocusPosition] = useState<MedolSourcePosition>();
  const [dslFocusVersion, setDslFocusVersion] = useState(0);

  const boards = useMemo(() => canvasBoards(model), [model]);
  const canvasBoard = resolveCanvasBoard(model, {
    domainId: boards.some((board) => board.id === selectedDomainId) ? selectedDomainId : undefined,
    contextId: model.contexts.some((context) => context.id === selectedContextId) ? selectedContextId : undefined
  });
  const activeDomain = model.domains.find((domain) => domain.id === canvasBoard?.id);
  const activeContext = canvasBoard?.contexts.find((context) => context.id === selectedContextId) ?? canvasBoard?.contexts[0];
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
    setLocalContextOnly(false);
    setCollapsedContextIds([]);
    setSelectedDomainId(undefined);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
  };

  const applySyncedSelection = (message: Partial<PreviewSyncMessage>) => {
    if (typeof message.localContextOnly === 'boolean') setLocalContextOnly(message.localContextOnly);
    if (Array.isArray(message.collapsedContextIds)) setCollapsedContextIds(message.collapsedContextIds.filter((id) => typeof id === 'string'));
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
    setLocalContextOnly(false);
    const board = boards.find((item) => item.id === domain.id) ?? boards.find((item) => item.contexts.some((context) => domain.contexts.some((candidate) => candidate.id === context.id)));
    setSelectedDomainId(board?.id ?? domain.id);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
    focusDslTarget(canLocateInEditor(domain.sourceRange) ? { kind: 'domain', name: domain.name } : undefined);
  };

  const selectCanvasDomain = (domainId: string) => {
    setLocalContextOnly(false);
    setSelectedDomainId(domainId);
    setSelectedContextId(undefined);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    onPreviewModeChange('canvas');
  };

  const selectContext = (context: EmContext) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    if (previewMode !== 'analysis') onPreviewModeChange('canvas');
    focusDslTarget(canLocateInEditor(context.sourceRange) ? { kind: 'context', name: context.name } : undefined);
  };

  const selectAggregate = (context: EmContext, aggregate: EmAggregate) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(aggregate.id);
    setSelectedConceptId(undefined);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    if (previewMode !== 'analysis') onPreviewModeChange('canvas');
    focusDslTarget(undefined);
  };

  const selectConcept = (context: EmContext, concept: EmConcept) => {
    setSelectedDomainId(findDomainIdForContext(model, context.id));
    setSelectedContextId(context.id);
    setSelectedAggregateId(undefined);
    setSelectedConceptId(concept.id);
    setSelectedSliceId(undefined);
    setSelectedNodeId(undefined);
    if (previewMode !== 'analysis') onPreviewModeChange('canvas');
    focusDslTarget(canLocateInEditor(concept.sourceRange) ? { kind: 'concept', name: concept.name } : undefined);
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
    if (previewMode !== 'analysis') onPreviewModeChange('canvas');
    focusDslTarget(canLocateInEditor(slice.sourceRange) ? { kind: 'slice', name: slice.name } : undefined);
  };

  const selectSearchItem = (item: ModelSearchItem) => {
    if (item.kind === 'domain') {
      const domain = model.domains.find((candidate) => candidate.id === item.domainId);
      if (domain) selectDomain(domain);
      return;
    }
    setSelectedDomainId(item.contextId ? findDomainIdForContext(model, item.contextId) : item.domainId);
    setSelectedContextId(item.contextId);
    setSelectedAggregateId(item.aggregateId);
    setSelectedConceptId(item.conceptId);
    setSelectedSliceId(item.sliceId);
    setSelectedNodeId(item.nodeId);
    focusDslPosition(canLocateInEditor(item.sourceRange) ? item.sourceRange?.start : undefined);
    onPreviewModeChange('canvas');
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
    const item = findModelItem(model, { nodeId: sourceId });
    if (!item) return;
    if (item.type === 'domain' && item.domain) {
      selectDomain(item.domain);
    } else if (item.context) {
      if (item.type === 'concept' && item.concept) selectConcept(item.context, item.concept);
      else if (item.type === 'aggregate' && item.aggregate) selectAggregate(item.context, item.aggregate);
      else if (item.slice) selectSlice(item.context, item.aggregate, item.slice);
      else selectContext(item.context);
      if (item.element) {
        setSelectedNodeId(item.element.id);
        onPreviewModeChange('canvas');
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
    localContextOnly,
    setLocalContextOnly,
    collapsedContextIds,
    setCollapsedContextIds,
    canvasBoards: boards,
    canvasBoard,
    selectCanvasDomain,
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
  return canvasBoards(model).find((domain) =>
    domain.contexts.some((candidate) => candidate.id === contextId)
  )?.id ?? unassignedCanvasId;
};
