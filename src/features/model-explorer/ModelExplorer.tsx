import { useState } from 'react';
import type { EmAggregate, EmConcept, EmContext, EmDomain, EmModel, EmSlice } from '../../lib/model';

interface ModelExplorerProps {
  model: EmModel;
  activeDomainId?: string;
  activeContextId?: string;
  activeAggregateId?: string;
  activeConceptId?: string;
  activeSliceId?: string;
  onSelectDomain: (domain: EmDomain) => void;
  onSelectContext: (context: EmContext) => void;
  onSelectAggregate: (context: EmContext, aggregate: EmAggregate) => void;
  onSelectConcept: (context: EmContext, concept: EmConcept) => void;
  onSelectSlice: (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => void;
}

export function ModelExplorer({
  model,
  activeDomainId,
  activeContextId,
  activeAggregateId,
  activeConceptId,
  activeSliceId,
  onSelectDomain,
  onSelectContext,
  onSelectAggregate,
  onSelectConcept,
  onSelectSlice
}: ModelExplorerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const domains = model.domains.length > 0 ? model.domains : [{
    id: 'default-domain',
    name: 'Model',
    contexts: model.contexts
  }];

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
        <p className="eyebrow">Model</p>
        <h2>Explorer</h2>
      </header>
      <div className="explorer-tree">
        {domains.map((domain) => {
          const domainCollapsed = collapsed.has(domain.id);
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
                  onClick={() => onSelectDomain(domain as EmDomain)}
                >
                  <span>{domain.contexts.length} contexts</span>
                  <strong>{domain.name}</strong>
                </button>
              </div>
              {!domainCollapsed && (
                <div className="explorer-contexts">
                  {domain.contexts.map((context) => {
                    const contextCollapsed = collapsed.has(context.id);
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
                            onClick={() => onSelectContext(context)}
                          >
                            <span>Context</span>
                            <strong>{context.name}</strong>
                          </button>
                        </div>
                        {!contextCollapsed && (
                          <div className="explorer-aggregates">
                            {context.aggregates.length > 0 && (
                              <div className="explorer-section-label">Aggregates</div>
                            )}
                            {context.aggregates.map((aggregate) => {
                              const aggregateCollapsed = collapsed.has(aggregate.id);
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
                    onClick={() => onSelectAggregate(context, aggregate)}
                  >
                    <span>{aggregate.slices.length} slices</span>
                    <strong>{aggregate.name}</strong>
                  </button>
                                  </div>
                  {!aggregateCollapsed && aggregate.id === activeAggregateId && (
                    <div className="explorer-slices">
                      {aggregate.slices.map((slice) => (
                        <button
                          key={slice.id}
                          type="button"
                          className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                          onClick={() => onSelectSlice(context, aggregate, slice)}
                        >
                          <span>{slice.resultingState ?? 'Slice'}</span>
                          <strong>{slice.name}</strong>
                        </button>
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
                              <button
                                key={`primary:${slice.id}`}
                                type="button"
                                className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                onClick={() => onSelectSlice(context, undefined, slice)}
                              >
                                <span>
                                  {slice.startsLifecycle ? 'Lifecycle start' : slice.resultingState ?? 'Slice'}
                                  {slice.tags.length > 0 ? ` · ${slice.tags.length} tags` : ''}
                                </span>
                                <strong>{slice.name}</strong>
                              </button>
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
                                      onClick={() => selectConcept(context, concept)}
                                    >
                                      <span>Organizes {slices.length} slices · {concept.states.length} states</span>
                                      <strong>{concept.name}</strong>
                                    </button>
                                  </div>
                                  {!conceptCollapsed && concept.id === activeConceptId && (
                                    <div className="explorer-slices">
                                      {slices.map((slice) => (
                                        <button
                                          key={slice.id}
                                          type="button"
                                          className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                          onClick={() => onSelectSlice(context, undefined, slice)}
                                        >
                                          <span>{slice.tags.length > 0 ? `${slice.tags.length} tags` : slice.resultingState ?? 'Slice'}</span>
                                          <strong>{slice.name}</strong>
                                        </button>
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
