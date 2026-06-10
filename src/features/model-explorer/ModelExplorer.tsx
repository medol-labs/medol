import { useState } from 'react';
import type { EmAggregate, EmContext, EmDomain, EmModel, EmSlice } from '../../lib/model';

interface ModelExplorerProps {
  model: EmModel;
  activeDomainId?: string;
  activeContextId?: string;
  activeAggregateId?: string;
  activeSliceId?: string;
  onSelectDomain: (domain: EmDomain) => void;
  onSelectContext: (context: EmContext) => void;
  onSelectAggregate: (context: EmContext, aggregate: EmAggregate) => void;
  onSelectSlice: (context: EmContext, aggregate: EmAggregate | undefined, slice: EmSlice) => void;
}

export function ModelExplorer({
  model,
  activeDomainId,
  activeContextId,
  activeAggregateId,
  activeSliceId,
  onSelectDomain,
  onSelectContext,
  onSelectAggregate,
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
                                    <button type="button" className="explorer-item explorer-item--nested" onClick={() => toggle(concept.id)}>
                                      <span>Concept · {slices.length} slices</span>
                                      <strong>{concept.name}</strong>
                                    </button>
                                  </div>
                                  {!conceptCollapsed && (
                                    <div className="explorer-slices">
                                      {slices.map((slice) => (
                                        <button
                                          key={slice.id}
                                          type="button"
                                          className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                          onClick={() => onSelectSlice(context, undefined, slice)}
                                        >
                                          <span>{slice.tags.length} tags</span>
                                          <strong>{slice.name}</strong>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {context.slices
                              .filter((slice) => !context.concepts.some((concept) => concept.sliceIds.includes(slice.id)))
                              .map((slice) => (
                                <button
                                  key={slice.id}
                                  type="button"
                                  className={slice.id === activeSliceId ? 'explorer-item explorer-item--slice is-active' : 'explorer-item explorer-item--slice'}
                                  onClick={() => onSelectSlice(context, undefined, slice)}
                                >
                                  <span>Context Slice · {slice.tags.length} tags</span>
                                  <strong>{slice.name}</strong>
                                </button>
                              ))}
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
