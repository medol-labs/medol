import type { CodegenElement, CodegenModel, CodegenSlice, CodegenUiType } from './codegenModel';

export interface LayoutPreviewModel {
  title: string;
  contexts: LayoutContext[];
}

export interface LayoutContext {
  id: string;
  title: string;
  modules: LayoutModule[];
}

export interface LayoutModule {
  id: string;
  title: string;
  aggregate: string;
  states: string[];
  slices: LayoutSlice[];
  pages: LayoutPage[];
}

export interface LayoutSlice {
  id: string;
  title: string;
  commands: LayoutAction[];
  events: LayoutAction[];
  readmodels: LayoutAction[];
  processors: LayoutAction[];
  createsAggregate: boolean;
  stateChange?: string;
}

export interface LayoutPage {
  id: string;
  title: string;
  kind: 'list' | 'detail' | 'command' | 'automation';
  source: string;
  actions: LayoutAction[];
}

export interface LayoutAction {
  id: string;
  title: string;
  kind: 'command' | 'event' | 'readmodel' | 'processor';
  emphasis?: boolean;
  uiType?: CodegenUiType;
}

export const toLayoutPreviewModel = (model: CodegenModel): LayoutPreviewModel => ({
  title: model.domain ?? 'Event Modeled Application',
  contexts: model.contexts.map((context) => ({
    id: context.id,
    title: context.title,
    modules: context.aggregates.map((aggregate) => {
      const aggregateSlices = model.slices.filter(
        (slice) => slice.context === context.name && slice.aggregate.name === aggregate.name
      );
      const states = model.aggregates.find((item) => item.name === aggregate.name)?.states ?? [];

      return {
        id: aggregate.id,
        title: aggregate.title,
        aggregate: aggregate.name,
        states,
        slices: aggregateSlices.map(toLayoutSlice),
        pages: toLayoutPages(aggregateSlices)
      };
    })
  }))
});

const toLayoutSlice = (slice: CodegenSlice): LayoutSlice => ({
  id: slice.id,
  title: slice.title,
  commands: slice.commands.map((command) => toAction(command, 'command')),
  events: slice.events.map((event) => toAction(event, 'event')),
  readmodels: slice.readmodels.map((readmodel) => toAction(readmodel, 'readmodel')),
  processors: slice.processors.map((processor) => toAction(processor, 'processor')),
  createsAggregate: slice.commands.some((command) => command.createsAggregate),
  ...(slice.stateChange ? { stateChange: slice.stateChange.to } : {})
});

const toLayoutPages = (slices: CodegenSlice[]): LayoutPage[] => {
  const pages: LayoutPage[] = [];
  const readmodels = uniqueElements(slices.flatMap((slice) => slice.readmodels));
  const screens = uniqueElements(slices.flatMap((slice) => slice.screens));
  const commands = uniqueElements(slices.flatMap((slice) => slice.commands));
  const processors = uniqueElements(slices.flatMap((slice) => slice.processors));

  for (const screen of screens) {
    const actions = relatedCommands(screen, slices);
    pages.push({
      id: `screen-${screen.id}`,
      title: screen.title,
      kind: toPageKind(screen.ui?.type),
      source: screen.ui?.type ? `UI ${screen.ui.type}` : 'Screen',
      actions: actions.length > 0 ? actions : timelineCommands(screen, slices)
    });
  }

  for (const readmodel of readmodels) {
    if (hasExplicitReadmodelPage(readmodel, slices)) continue;
    const actions = relatedCommands(readmodel, slices);
    pages.push({
      id: `readmodel-${readmodel.id}`,
      title: readmodel.title,
      kind: readmodel.listElement ? 'list' : 'detail',
      source: readmodel.listElement ? 'Read model list' : 'Read model detail',
      actions: actions.length > 0 ? actions : timelineCommands(readmodel, slices)
    });
  }

  for (const command of commands) {
    if (pages.some((page) => page.actions.some((action) => action.id === command.id))) continue;
    pages.push({
      id: `command-${command.id}`,
      title: command.title,
      kind: 'command',
      source: command.createsAggregate ? 'Create flow' : 'Command form',
      actions: [toAction(command, 'command', command.createsAggregate)]
    });
  }

  for (const processor of processors) {
    pages.push({
      id: `processor-${processor.id}`,
      title: processor.title,
      kind: 'automation',
      source: 'Automated workflow',
      actions: [toAction(processor, 'processor')]
    });
  }

  return pages.length > 0 ? pages : slices.map((slice) => ({
    id: `slice-${slice.id}`,
    title: slice.title,
    kind: 'command',
    source: 'Interaction flow',
    actions: slice.commands.map((command) => toAction(command, 'command', command.createsAggregate))
  }));
};

const hasExplicitReadmodelPage = (readmodel: CodegenElement, slices: CodegenSlice[]): boolean => {
  const owner = slices.find((slice) => slice.readmodels.some((item) => item.id === readmodel.id));
  return owner?.screens.some((screen) => screen.ui?.type === 'list' || screen.ui?.type === 'detail') ?? false;
};

const relatedCommands = (element: CodegenElement, slices: CodegenSlice[]): LayoutAction[] => {
  const inboundIds = new Set(
    element.dependencies
      .filter((dependency) => dependency.direction === 'INBOUND')
      .map((dependency) => dependency.id)
  );
  const commands = slices
    .flatMap((slice) => slice.commands)
    .filter((command) => inboundIds.has(command.id));

  if (commands.length > 0) {
    return commands.map((command) => toAction(command, 'command', command.createsAggregate));
  }

  return slices
    .filter((slice) => slice.readmodels.some((readmodel) => readmodel.id === element.id) || slice.screens.some((screen) => screen.id === element.id))
    .flatMap((slice) => slice.commands.map((command) => toAction(command, 'command', command.createsAggregate)));
};

const timelineCommands = (element: CodegenElement, slices: CodegenSlice[]): LayoutAction[] => {
  const ownerIndex = slices.findIndex((slice) =>
    slice.readmodels.some((readmodel) => readmodel.id === element.id) || slice.screens.some((screen) => screen.id === element.id)
  );
  if (ownerIndex < 0) return [];

  return uniqueElements(slices.slice(0, ownerIndex).flatMap((slice) => slice.commands))
    .map((command) => toAction(command, 'command', command.createsAggregate));
};

const toPageKind = (uiType?: CodegenUiType): LayoutPage['kind'] => {
  if (uiType === 'list') return 'list';
  if (uiType === 'background') return 'automation';
  if (uiType === 'form' || uiType === 'dialog' || uiType === 'drawer' || uiType === 'confirm' || uiType === 'wizard' || uiType === 'inline') {
    return 'command';
  }
  return 'detail';
};

const uniqueElements = (elements: CodegenElement[]): CodegenElement[] => {
  const seen = new Set<string>();
  return elements.filter((element) => {
    if (seen.has(element.id)) return false;
    seen.add(element.id);
    return true;
  });
};

const toAction = (
  element: CodegenElement,
  kind: LayoutAction['kind'],
  emphasis = false
): LayoutAction => ({
  id: element.id,
  title: element.title,
  kind,
  ...(emphasis ? { emphasis } : {}),
  ...(element.ui?.type ? { uiType: element.ui.type } : {})
});
