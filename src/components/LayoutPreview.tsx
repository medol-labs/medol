import {
  Bell,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  MoreHorizontal,
  Search
} from 'lucide-react';
import type { LayoutAction, LayoutModule, LayoutPage, LayoutPreviewModel } from '../lib/layoutPreview';
import { OverflowText } from './ui/overflow-text';

interface LayoutPreviewProps {
  model: LayoutPreviewModel;
}

export function LayoutPreview({ model }: LayoutPreviewProps) {
  const pageCount = model.contexts.reduce(
    (total, context) => total + context.modules.reduce((count, module) => count + module.pages.length, 0),
    0
  );

  return (
    <div className="layout-preview">
      <header className="layout-preview__topbar">
        <div className="layout-preview__brand">
          <span>{model.title.slice(0, 1).toUpperCase()}</span>
          <OverflowText as="strong" text={model.title} />
        </div>
        <label className="layout-preview__search">
          <Search size={14} />
          <span>Search application</span>
        </label>
        <div className="layout-preview__account">
          <button type="button" aria-label="Notifications"><Bell size={16} /></button>
          <CircleUserRound size={22} />
        </div>
      </header>

      <div className="layout-preview__body">
        <nav className="layout-preview__nav" aria-label="Application pages">
          <a className="layout-preview__nav-home" href="#layout-home">
            <LayoutDashboard size={15} />
            Overview
          </a>
          {model.contexts.map((context) => (
            <section key={context.id}>
              <OverflowText as="strong" text={context.title} />
              {context.modules.map((module) => (
                <ModuleNav key={module.id} module={module} />
              ))}
            </section>
          ))}
        </nav>

        <main className="layout-preview__workspace" id="layout-home">
          <div className="layout-preview__page-heading">
            <div>
              <p>Application preview</p>
              <h2>Workspace overview</h2>
            </div>
            <div className="layout-preview__summary">
              <span>{model.contexts.length} contexts</span>
              <span>{pageCount} pages</span>
            </div>
          </div>

          {model.contexts.map((context) => (
            <section className="layout-context" key={context.id}>
              <div className="layout-context__title">
                <span>{context.title}</span>
              </div>
              {context.modules.map((module) => (
                <ModulePreview key={module.id} module={module} contextTitle={context.title} />
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function ModuleNav({ module }: { module: LayoutModule }) {
  const navigablePages = module.pages.filter((page) => page.kind === 'list' || page.kind === 'detail');

  return (
    <div className="layout-preview__nav-module">
      <OverflowText className="layout-preview__nav-module-title" text={module.title} />
      {navigablePages.map((page) => (
        <a key={page.id} href={`#${page.id}`}>
          <OverflowText text={page.title} />
          <ChevronRight size={12} />
        </a>
      ))}
    </div>
  );
}

function ModulePreview({ module, contextTitle }: { module: LayoutModule; contextTitle: string }) {
  const commands = uniqueActions(module.slices.flatMap((slice) => slice.commands));

  return (
    <article className="layout-module" id={module.id}>
      <header className="layout-module__header">
        <div>
          <p>{contextTitle} / {module.aggregate}</p>
          <OverflowText as="h3" text={module.title} />
        </div>
        <div className="layout-module__operations">
          {commands.slice(0, 4).map((command) => (
            <button
              className={command.emphasis ? 'is-primary' : undefined}
              key={command.id}
              type="button"
              title={command.title}
            >
              {command.title}
            </button>
          ))}
          {commands.length > 4 && (
            <button className="is-icon" type="button" aria-label="More commands">
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
      </header>

      {module.states.length > 0 && (
        <div className="layout-module__states">
          <span>Lifecycle</span>
          {module.states.map((state, index) => <em key={`${state}:${index}`}>{state}</em>)}
        </div>
      )}

      <div className="layout-pages">
        {module.pages.map((page) => (
          <PagePreview key={page.id} page={page} />
        ))}
      </div>
    </article>
  );
}

function PagePreview({ page }: { page: LayoutPage }) {
  return (
    <section className={`layout-page layout-page--${page.kind}`} id={page.id}>
      <header className="layout-page__header">
        <div>
          <OverflowText as="small" text={page.source} />
          <OverflowText as="strong" text={page.title} />
        </div>
        <div className="layout-page__actions">
          {page.actions.slice(0, 3).map((action) => (
            <button
              className={action.emphasis ? 'is-primary' : undefined}
              key={action.id}
              type="button"
              title={action.title}
            >
              {action.title}
            </button>
          ))}
        </div>
      </header>
      <PageBody kind={page.kind} />
    </section>
  );
}

function PageBody({ kind }: { kind: LayoutPage['kind'] }) {
  if (kind === 'list') {
    return (
      <div className="layout-page__list">
        <div className="layout-page__list-tools">
          <span><Search size={13} /> Search records</span>
          <button type="button">Filter</button>
        </div>
        <div className="layout-page__table">
          <div className="is-header"><span>Name</span><span>Status</span><span>Updated</span><span /></div>
          {[0, 1, 2].map((row) => (
            <div key={row}><span /><span><i /></span><span /></div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'command') {
    return (
      <div className="layout-page__form">
        {[0, 1, 2, 3].map((field) => (
          <label key={field}><span>Field label</span><i /></label>
        ))}
        <div><button type="button">Cancel</button><button className="is-primary" type="button">Submit</button></div>
      </div>
    );
  }

  if (kind === 'automation') {
    return (
      <div className="layout-page__automation">
        <span>Active workflow</span>
        <div><i /><i /><i /></div>
        <small>Runs automatically when its trigger is received.</small>
      </div>
    );
  }

  return (
    <div className="layout-page__detail">
      {[0, 1, 2, 3].map((item) => (
        <div key={item}><small>Attribute</small><span /></div>
      ))}
    </div>
  );
}

const uniqueActions = <T extends LayoutAction>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
