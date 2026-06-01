import type { LayoutAction, LayoutModule, LayoutPage, LayoutPreviewModel } from '../lib/layoutPreview';

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
                <ModuleNav key={module.id} module={module} />
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

function ModuleNav({ module }: { module: LayoutModule }) {
  const listPages = module.pages.filter((page) => page.kind === 'list');
  const attachedCommandIds = new Set(listPages.flatMap((page) => page.actions.map((action) => action.id)));
  const commands = uniqueActions(module.slices.flatMap((slice) => slice.commands));
  const standaloneCommands = commands.filter((command) => !attachedCommandIds.has(command.id));

  return (
    <div className="layout-preview__nav-module">
      <a className="layout-preview__nav-module-link" href={`#${module.id}`}>{module.title}</a>
      {listPages.length > 0 && (
        <div className="layout-preview__nav-lists">
          {listPages.map((page) => (
            <ListNavItem key={page.id} page={page} />
          ))}
        </div>
      )}
      {standaloneCommands.length > 0 && (
        <div className="layout-preview__nav-group">
          <span>Other commands</span>
          {standaloneCommands.map((command) => (
            <a key={command.id} href={`#${command.id}`}>
              <small>{command.uiType ?? (command.emphasis ? 'create' : 'cmd')}</small>
              {command.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ListNavItem({ page }: { page: LayoutPage }) {
  const commands = page.actions.filter((action): action is LayoutAction & { kind: 'command' } => action.kind === 'command');

  return (
    <div className="layout-preview__nav-list">
      <a className="layout-preview__nav-list-link" href={`#${page.id}`}>
        <small>list</small>
        {page.title}
      </a>
      {commands.length > 0 && (
        <div className="layout-preview__nav-group">
          <span>Commands</span>
          {commands.map((command) => (
            <a key={command.id} href={`#${command.id}`}>
              <small>{command.uiType ?? (command.emphasis ? 'create' : 'cmd')}</small>
              {command.title}
            </a>
          ))}
        </div>
      )}
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
              <div className="layout-page" id={page.id} key={page.id}>
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
                          {action.uiType && <small>{action.uiType}</small>}
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
                <ActionList title="Command" kind="command" items={slice.commands} anchorItems />
                <ActionList title="Event" kind="event" items={slice.events} />
                <ActionList title="View" kind="readmodel" items={slice.readmodels} />
                {slice.processors.length > 0 && <ActionList title="Auto" kind="processor" items={slice.processors} />}
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
            <ActionList title="Commands" kind="command" items={commands} />
            <ActionList title="Events" kind="event" items={events} />
            <ActionList title="Read models" kind="readmodel" items={readmodels} />
            {processors.length > 0 && <ActionList title="Processors" kind="processor" items={processors} />}
          </div>
        </section>
      </div>
    </article>
  );
}

function ActionList({
  title,
  kind,
  items,
  anchorItems = false
}: {
  title: string;
  kind: 'command' | 'event' | 'readmodel' | 'processor';
  items: Array<{ id: string; title: string; emphasis?: boolean; uiType?: string }>;
  anchorItems?: boolean;
}) {
  return (
    <div className="layout-action-list">
      <span>{title}</span>
      {items.length > 0 ? (
        <div>
          {items.map((item) => (
            <em className={`${item.emphasis ? 'is-emphasis ' : ''}is-${kind}`} id={anchorItems ? item.id : undefined} key={item.id}>
              {item.title}
              {item.uiType && <small>{item.uiType}</small>}
            </em>
          ))}
        </div>
      ) : (
        <small>None</small>
      )}
    </div>
  );
}

const uniqueActions = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
