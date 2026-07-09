import { FileSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OverflowText } from '../../components/ui/overflow-text';
import { agentSliceStatusValues, type AgentSliceStatus } from '../../contracts/agentSliceStatus';
import type { EmAggregate, EmConcept, EmContext, EmDomain, EmModel, EmSlice } from '../../lib/model';

interface ModelExplorerProps {
  model: EmModel;
  activeDomainId?: string;
  activeContextId?: string;
  activeAggregateId?: string;
  activeConceptId?: string;
  activeSliceId?: string;
  sliceAgentStatuses?: Record<string, AgentSliceStatus>;
  documentSourceRefs: ReadonlySet<string>;
  onSelectDomain: (domain: EmDomain) => void;
  onSelectContext: (context: EmContext) => void;
  onSelectAggregate: (context: EmContext, aggregate: EmAggregate) => void;
  onSelectConcept: (context: EmContext, concept: EmConcept) => void;
  onSelectSlice: (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => void;
  onChangeSliceAgentStatus?: (
    context: EmContext,
    aggregate: EmAggregate | undefined,
    slice: EmSlice,
    status: AgentSliceStatus
  ) => void;
  onLocateDocumentation: (sourceIds: string[]) => void;
  onCollapse?: () => void;
}

export function ModelExplorer({
  model,
  activeDomainId,
  activeContextId,
  activeAggregateId,
  activeConceptId,
  activeSliceId,
  sliceAgentStatuses = {},
  documentSourceRefs,
  onSelectDomain,
  onSelectContext,
  onSelectAggregate,
  onSelectConcept,
  onSelectSlice,
  onChangeSliceAgentStatus,
  onLocateDocumentation,
  onCollapse
}: ModelExplorerProps) {
  const domains = useMemo(() => getExplorerDomains(model), [model]);
  const collapsibleIds = useMemo(() => collectCollapsibleIds(domains), [domains]);
  const knownCollapsibleIdsRef = useRef<Set<string>>(new Set(collapsibleIds));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(collapsibleIds));
  const treeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousKnownIds = knownCollapsibleIdsRef.current;
    const nextKnownIds = new Set(collapsibleIds);

    setCollapsed((previous) => {
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        if (nextKnownIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      for (const id of nextKnownIds) {
        if (!previousKnownIds.has(id)) {
          next.add(id);
          changed = true;
        }
      }

      return changed ? next : previous;
    });

    knownCollapsibleIdsRef.current = nextKnownIds;
  }, [collapsibleIds]);

  const toggle = (id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    const activeIds = [activeDomainId, activeContextId, activeAggregateId, activeConceptId].filter(
      (id): id is string => Boolean(id)
    );
    if (!activeIds.length) return;
    setCollapsed((previous) => {
      if (!activeIds.some((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      for (const id of activeIds) next.delete(id);
      return next;
    });
  }, [activeAggregateId, activeConceptId, activeContextId, activeDomainId, activeSliceId]);

  useEffect(() => {
    const activeId = activeSliceId ?? activeConceptId ?? activeAggregateId ?? activeContextId ?? activeDomainId;
    if (!activeId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[data-explorer-id]') ?? [])
        .find((element) => element.dataset.explorerId === activeId);
      target?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeAggregateId, activeConceptId, activeContextId, activeDomainId, activeSliceId]);

  const selectConcept = (context: EmContext, concept: EmConcept) => {
    setCollapsed((previous) => {
      if (!previous.has(concept.id)) return previous;
      const next = new Set(previous);
      next.delete(concept.id);
      return next;
    });
    onSelectConcept(context, concept);
  };

  return (
    <aside className="explorer-pane">
      <header className="pane-header">
        <div>
          <p className="eyebrow">Model</p>
          <h2>Explorer</h2>
        </div>
        {onCollapse && (
          <button type="button" className="collapse-button" onClick={onCollapse}>Hide</button>
        )}
      </header>
      <div className="explorer-tree" ref={treeRef}>
        {domains.map((domain) => {
          const domainCollapsed = collapsed.has(domain.id);
          const domainSourceIds = [
            domain.id,
            ...domain.contexts.flatMap(contextSourceIds)
          ];
          return (
            <section key={domain.id} className="explorer-domain">
              <div className="explorer-row">
                <button
                  type="button"
                  className="explorer-toggle"
                  aria-label={domainCollapsed ? `Expand ${domain.name}` : `Collapse ${domain.name}`}
                  onClick={() => toggle(domain.id)}
                >
                  {domainCollapsed ? '+' : '-'}
                </button>
                <button
                  type="button"
                  className={domain.id === activeDomainId ? 'explorer-item is-active' : 'explorer-item'}
                  data-explorer-id={domain.id}
                  onClick={() => onSelectDomain(domain as EmDomain)}
                >
                  <span>{domain.contexts.length} contexts</span>
                  <OverflowText as="strong" text={domain.name} />
                </button>
                <DocumentationLocator
                  sourceIds={domainSourceIds}
                  availableRefs={documentSourceRefs}
                  onLocate={onLocateDocumentation}
                />
              </div>
              {!domainCollapsed && (
                <div className="explorer-contexts">
                  {domain.contexts.map((context) => {
                    const contextCollapsed = collapsed.has(context.id);
                    const sourceIds = contextSourceIds(context);
                    return (
                      <section key={context.id} className="explorer-context">
                        <div className="explorer-row">
                          <button
                            type="button"
                            className="explorer-toggle"
                            aria-label={contextCollapsed ? `Expand ${context.name}` : `Collapse ${context.name}`}
                            onClick={() => toggle(context.id)}
                          >
                            {contextCollapsed ? '+' : '-'}
                          </button>
                          <button
                            type="button"
                            className={context.id === activeContextId ? 'explorer-item is-active' : 'explorer-item'}
                            data-explorer-id={context.id}
                            onClick={() => onSelectContext(context)}
                          >
                            <span>Context</span>
                            <OverflowText as="strong" text={context.name} />
                          </button>
                          <DocumentationLocator
                            sourceIds={sourceIds}
                            availableRefs={documentSourceRefs}
                            onLocate={onLocateDocumentation}
                          />
                        </div>
                        {!contextCollapsed && (
                          <div className="explorer-aggregates">
                            {context.aggregates.length > 0 && (
                              <div className="explorer-section-label">Aggregates</div>
                            )}
                            {context.aggregates.map((aggregate) => {
                              const aggregateCollapsed = collapsed.has(aggregate.id);
                              const aggregateSourceIds = [
                                aggregate.id,
                                ...aggregate.slices.map((slice) => slice.id)
                              ];
                              return (
                                <div key={aggregate.id} className="explorer-aggregate">
                                  <div className="explorer-row">
                                    <button
                                      type="button"
                                      className="explorer-toggle"
                                      aria-label={aggregateCollapsed ? `Expand ${aggregate.name}` : `Collapse ${aggregate.name}`}
                                      onClick={() => toggle(aggregate.id)}
                                    >
                                      {aggregateCollapsed ? '+' : '-'}
                                    </button>
                  <button
                    type="button"
                    className={aggregate.id === activeAggregateId && !activeSliceId ? 'explorer-item explorer-item--nested is-active' : 'explorer-item explorer-item--nested'}
                    data-explorer-id={aggregate.id}
                    onClick={() => onSelectAggregate(context, aggregate)}
                  >
                    <span>{aggregate.slices.length} slices</span>
                    <OverflowText as="strong" text={aggregate.name} />
                  </button>
                                    <DocumentationLocator
                                      sourceIds={aggregateSourceIds}
                                      availableRefs={documentSourceRefs}
                                      onLocate={onLocateDocumentation}
                                    />
                                  </div>
                  {!aggregateCollapsed && aggregate.id === activeAggregateId && (
                    <div className="explorer-slices">
                      {aggregate.slices.map((slice) => (
                        <div key={slice.id} className="explorer-row explorer-row--leaf">
                          <button
                            type="button"
                            className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                            data-explorer-id={slice.id}
                            onClick={() => onSelectSlice(context, aggregate, slice)}
                          >
                            <span>{slice.resultingState ?? 'Slice'}</span>
                            <OverflowText as="strong" text={slice.name} />
                          </button>
                          <SliceAgentStatusSelect
                            value={sliceAgentStatuses[slice.id] ?? 'unplanned'}
                            onChange={(status) => onChangeSliceAgentStatus?.(context, aggregate, slice, status)}
                          />
                          <DocumentationLocator
                            sourceIds={[slice.id, aggregate.id, context.id]}
                            availableRefs={documentSourceRefs}
                            onLocate={onLocateDocumentation}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                              );
                            })}
                            {context.slices.length > 0 && (
                              <div className="explorer-section-label">Slices</div>
                            )}
                            {context.slices.map((slice) => (
                              <div key={`primary:${slice.id}`} className="explorer-row explorer-row--leaf">
                                <button
                                  type="button"
                                  className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                  data-explorer-id={slice.id}
                                  onClick={() => onSelectSlice(context, undefined, slice)}
                                >
                                  <span>
                                    {slice.startsLifecycle ? 'Lifecycle start' : slice.resultingState ?? 'Slice'}
                                    {slice.tags.length > 0 ? ` · ${slice.tags.length} tags` : ''}
                                  </span>
                                  <OverflowText as="strong" text={slice.name} />
                                </button>
                                <SliceAgentStatusSelect
                                  value={sliceAgentStatuses[slice.id] ?? 'unplanned'}
                                  onChange={(status) => onChangeSliceAgentStatus?.(context, undefined, slice, status)}
                                />
                                <DocumentationLocator
                                  sourceIds={[
                                    slice.id,
                                    ...context.concepts
                                      .filter((concept) => concept.sliceIds.includes(slice.id))
                                      .map((concept) => concept.id),
                                    context.id
                                  ]}
                                  availableRefs={documentSourceRefs}
                                  onLocate={onLocateDocumentation}
                                />
                              </div>
                            ))}
                            {context.concepts.length > 0 && (
                              <div className="explorer-section-label">Concepts</div>
                            )}
                            {context.concepts.map((concept) => {
                              const conceptCollapsed = collapsed.has(concept.id);
                              const slices = context.slices.filter((slice) => concept.sliceIds.includes(slice.id));
                              return (
                                <div key={concept.id} className="explorer-aggregate">
                                  <div className="explorer-row">
                                    <button
                                      type="button"
                                      className="explorer-toggle"
                                      aria-label={conceptCollapsed ? `Expand ${concept.name}` : `Collapse ${concept.name}`}
                                      onClick={() => toggle(concept.id)}
                                    >
                                      {conceptCollapsed ? '+' : '-'}
                                    </button>
                                    <button
                                      type="button"
                                      className={concept.id === activeConceptId && !activeSliceId
                                        ? 'explorer-item explorer-item--nested is-active'
                                        : 'explorer-item explorer-item--nested'}
                                      data-explorer-id={concept.id}
                                      onClick={() => selectConcept(context, concept)}
                                    >
                                      <span>Organizes {slices.length} slices · {concept.states.length} states</span>
                                        <OverflowText as="strong" text={concept.name} />
                                      </button>
                                      <DocumentationLocator
                                        sourceIds={[concept.id, ...concept.sliceIds]}
                                        availableRefs={documentSourceRefs}
                                        onLocate={onLocateDocumentation}
                                      />
                                    </div>
                                  {!conceptCollapsed && concept.id === activeConceptId && (
                                    <div className="explorer-slices">
                                      {slices.map((slice) => (
                                        <div key={slice.id} className="explorer-row explorer-row--leaf">
                                          <button
                                            type="button"
                                            className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                            data-explorer-id={slice.id}
                                            onClick={() => onSelectSlice(context, undefined, slice)}
                                          >
                                            <span>{slice.tags.length > 0 ? `${slice.tags.length} tags` : slice.resultingState ?? 'Slice'}</span>
                                            <OverflowText as="strong" text={slice.name} />
                                          </button>
                                          <SliceAgentStatusSelect
                                            value={sliceAgentStatuses[slice.id] ?? 'unplanned'}
                                            onChange={(status) => onChangeSliceAgentStatus?.(context, undefined, slice, status)}
                                          />
                                          <DocumentationLocator
                                            sourceIds={[slice.id, concept.id, context.id]}
                                            availableRefs={documentSourceRefs}
                                            onLocate={onLocateDocumentation}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

const contextSourceIds = (context: EmContext): string[] => [
  context.id,
  ...context.aggregates.flatMap((aggregate) => [
    aggregate.id,
    ...aggregate.slices.map((slice) => slice.id)
  ]),
  ...context.slices.map((slice) => slice.id),
  ...context.concepts.map((concept) => concept.id)
];

type ExplorerDomain = Pick<EmDomain, 'id' | 'name' | 'contexts'>;

const getExplorerDomains = (model: EmModel): ExplorerDomain[] => (
  model.domains.length > 0
    ? model.domains
    : [{
      id: 'default-domain',
      name: 'Model',
      contexts: model.contexts
    }]
);

const collectCollapsibleIds = (domains: ExplorerDomain[]): string[] => (
  domains.flatMap((domain) => [
    domain.id,
    ...domain.contexts.flatMap((context) => [
      context.id,
      ...context.aggregates.map((aggregate) => aggregate.id),
      ...context.concepts.map((concept) => concept.id)
    ])
  ])
);

function SliceAgentStatusSelect({
  value,
  onChange
}: {
  value: AgentSliceStatus;
  onChange: (status: AgentSliceStatus) => void;
}) {
  return (
    <select
      className={`explorer-agent-status explorer-agent-status--${value}`}
      value={value}
      aria-label="Agent implementation status"
      title="Agent implementation status"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.currentTarget.value as AgentSliceStatus)}
    >
      {agentSliceStatusValues.map((status) => (
        <option key={status} value={status}>{agentSliceStatusLabel(status)}</option>
      ))}
    </select>
  );
}

const agentSliceStatusLabel = (status: AgentSliceStatus): string => {
  if (status === 'unplanned') return 'None';
  if (status === 'planned') return 'Plan';
  if (status === 'running') return 'Run';
  if (status === 'implemented') return 'Done';
  if (status === 'verified') return 'OK';
  if (status === 'blocked') return 'Block';
  return 'Manual';
};

function DocumentationLocator({
  sourceIds,
  availableRefs,
  onLocate
}: {
  sourceIds: string[];
  availableRefs: ReadonlySet<string>;
  onLocate: (sourceIds: string[]) => void;
}) {
  const matchingSourceIds = sourceIds.filter((sourceId) => availableRefs.has(sourceId));
  return (
    <button
      type="button"
      className={`explorer-document-link ${matchingSourceIds.length ? 'has-reference' : 'has-no-reference'}`}
      title={matchingSourceIds.length
        ? 'Locate this model item in generated documents'
        : 'No linked document section yet; open Documents for guidance'}
      aria-label={matchingSourceIds.length
        ? 'Locate in generated documents'
        : 'Open document location guidance'}
      onClick={() => onLocate(matchingSourceIds.length ? matchingSourceIds : sourceIds)}
    >
      <FileSearch aria-hidden="true" />
    </button>
  );
}
