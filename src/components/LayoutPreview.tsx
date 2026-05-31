import type { LayoutModule, LayoutPreviewModel } from '../lib/layoutPreview';

interface LayoutPreviewProps {
  model: LayoutPreviewModel;
}

export function LayoutPreview({ model }: LayoutPreviewProps) {
  return (
    <div className="layout-preview">
      <header className="layout-preview__header">
        <div>
          <p className="eyebrow">Application layout</p>
          <h2>{model.title}</h2>
        </div>
        <div className="layout-preview__summary">
          <span>{model.contexts.length} contexts</span>
          <span>{model.contexts.reduce((total, context) => total + context.modules.length, 0)} modules</span>
        </div>
      </header>

      <div className="layout-preview__body">
        <nav className="layout-preview__nav" aria-label="Application modules">
          {model.contexts.map((context) => (
            <section key={context.id}>
              <strong>{context.title}</strong>
              {context.modules.map((module) => (
                <a key={module.id} href={`#${module.id}`}>{module.title}</a>
              ))}
            </section>
          ))}
        </nav>

        <div className="layout-preview__modules">
          {model.contexts.map((context) => (
            <section className="layout-context" key={context.id}>
              <div className="layout-context__title">
                <span>{context.title}</span>
              </div>
              {context.modules.map((module) => (
                <ModulePreview key={module.id} module={module} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModulePreview({ module }: { module: LayoutModule }) {
  const commands = module.slices.flatMap((slice) => slice.commands);
  const events = module.slices.flatMap((slice) => slice.events);
  const readmodels = module.slices.flatMap((slice) => slice.readmodels);
  const processors = module.slices.flatMap((slice) => slice.processors);

  return (
    <article className="layout-module" id={module.id}>
      <header className="layout-module__header">
        <div>
          <p>{module.aggregate}</p>
          <h3>{module.title}</h3>
        </div>
        {module.states.length > 0 && (
          <ol className="layout-states" aria-label={`${module.title} states`}>
            {module.states.map((state) => (
              <li key={state}>{state}</li>
            ))}
          </ol>
        )}
      </header>

      <div className="layout-module__grid">
        <section className="layout-panel layout-panel--pages">
          <div className="layout-panel__title">
            <span>Pages</span>
            <small>{module.pages.length}</small>
          </div>
          <div className="layout-pages">
            {module.pages.map((page) => (
              <div className="layout-page" key={page.id}>
                <div className="layout-page__chrome">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="layout-page__body">
                  <small>{page.source}</small>
                  <strong>{page.title}</strong>
                  <div className="layout-wireframe">
                    <span className={`layout-wireframe__block layout-wireframe__block--${page.kind}`} />
                    <span />
                    <span />
                  </div>
                  {page.actions.length > 0 && (
                    <div className="layout-page__actions">
                      {page.actions.map((action) => (
                        <span className={action.emphasis ? 'is-emphasis' : undefined} key={action.id}>
                          {action.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="layout-panel">
          <div className="layout-panel__title">
            <span>Interactions</span>
            <small>{module.slices.length}</small>
          </div>
          <div className="layout-flows">
            {module.slices.map((slice) => (
              <div className="layout-flow" key={slice.id}>
                <div className="layout-flow__name">
                  <strong>{slice.title}</strong>
                  {slice.createsAggregate && <span>creates aggregate</span>}
                </div>
                <ActionList title="Command" items={slice.commands} />
                <ActionList title="Event" items={slice.events} />
                <ActionList title="View" items={slice.readmodels} />
                {slice.processors.length > 0 && <ActionList title="Auto" items={slice.processors} />}
                {slice.stateChange && <div className="layout-flow__state">state: {slice.stateChange}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="layout-panel">
          <div className="layout-panel__title">
            <span>Inventory</span>
            <small>{commands.length + events.length + readmodels.length + processors.length}</small>
          </div>
          <div className="layout-inventory">
            <ActionList title="Commands" items={commands} />
            <ActionList title="Events" items={events} />
            <ActionList title="Read models" items={readmodels} />
            {processors.length > 0 && <ActionList title="Processors" items={processors} />}
          </div>
        </section>
      </div>
    </article>
  );
}

function ActionList({ title, items }: { title: string; items: Array<{ id: string; title: string; emphasis?: boolean }> }) {
  return (
    <div className="layout-action-list">
      <span>{title}</span>
      {items.length > 0 ? (
        <div>
          {items.map((item) => (
            <em className={item.emphasis ? 'is-emphasis' : undefined} key={item.id}>{item.title}</em>
          ))}
        </div>
      ) : (
        <small>None</small>
      )}
    </div>
  );
}
