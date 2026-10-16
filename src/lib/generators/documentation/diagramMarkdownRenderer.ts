import type { EmElement, EmModel, EmSlice } from '../../model';
import { humanize } from '../../name';
import { documentFrontMatterLines } from './documentFrontMatter';
import type { DocumentationBundle, DocumentationLanguage } from './documentationModel';

const copy = {
  en: {
    title: 'Diagrams',
    overview: 'Overall Business Journey',
    overviewScope: 'Stages and transitions are declared in the user journey model. Branches can represent alternative or parallel work; arrows do not imply that every stage runs on every path.',
    noOverview: 'No overall user journey is modeled.',
    journeys: 'User Journey Diagrams',
    scope: 'Each diagram starts from a modeled actor action. Results, query views, direct automations, and one subsequent actor action follow explicit model relationships; separate actions are not assumed to happen in sequence. A query view is available for querying, not necessarily displayed on this screen.',
    empty: 'No actor-driven operations are modeled.',
    actor: 'Actor',
    screen: 'Screen',
    nextScreen: 'Next screen',
    nextAction: 'Next available action',
    action: 'Action',
    result: 'Result',
    view: 'Query view',
    automation: 'Automatic step',
    failure: 'Failure'
  },
  'zh-CN': {
    title: '图表文档',
    overview: '总体业务旅程',
    overviewScope: '阶段与衔接关系来自用户旅程建模。分支可表示备选或并行工作，箭头不代表所有路径都会执行每个阶段。',
    noOverview: '尚未建模总体用户旅程。',
    journeys: '用户旅程图',
    scope: '每张图从建模中的角色操作出发。结果、查询视图、直接自动步骤及一个后续人工操作只按明确的模型关系连接；不推断独立操作的先后。查询视图表示数据可查询，不代表当前页面已经展示。',
    empty: '尚未建模由角色发起的操作。',
    actor: '角色',
    screen: '界面',
    nextScreen: '后续界面',
    nextAction: '后续可操作',
    action: '操作',
    result: '结果',
    view: '查询视图',
    automation: '自动步骤',
    failure: '失败'
  }
} satisfies Record<DocumentationLanguage, Record<string, string>>;

interface JourneySlice {
  slice: EmSlice;
  actor: EmElement;
  commands: EmElement[];
}

export const renderDiagramsMarkdown = (
  model: EmModel,
  bundle: DocumentationBundle,
  language: DocumentationLanguage = 'en'
): string => {
  const text = copy[language];
  const lines = [
    `# ${bundle.title} ${text.title}`,
    '',
    ...documentFrontMatterLines(bundle.generatedAt, language)
  ];
  const allSlices = model.contexts.flatMap((context) => [
    ...context.slices,
    ...context.aggregates.flatMap((aggregate) => aggregate.slices)
  ]);
  const slicesById = new Map(allSlices.map((slice) => [slice.id, slice]));
  const elementsById = new Map([
    ...model.contexts.flatMap((context) => context.looseElements ?? []),
    ...allSlices.flatMap((slice) => slice.elements)
  ].map((element) => [element.id, element] as const));
  const overviews = (model.userJourneys ?? []).filter((journey) => !journey.context && journey.stages.length);
  lines.push(
    `## ${text.overview}`,
    '',
    text.overviewScope,
    ''
  );
  if (!overviews.length) lines.push(text.noOverview, '');
  for (const journey of overviews) lines.push(
    `### ${humanize(journey.name)}`,
    '',
    `<!-- em:section id="diagrams.overview.${journey.id}" source="${journey.id}" -->`,
    '```mermaid',
    ...overallJourneyFlowchart(model, journey),
    '```',
    ''
  );
  lines.push(`## ${text.journeys}`, '', text.scope, '');
  let diagramCount = 0;

  for (const context of model.contexts) {
    const contextSlices = [...new Map([
      ...context.slices,
      ...context.aggregates.flatMap((aggregate) => aggregate.slices)
    ].map((slice) => [slice.id, slice])).values()];
    const journeys: JourneySlice[] = contextSlices.flatMap((slice) => {
      const actor = slice.elements.find((element) => element.kind === 'actor');
      const commands = slice.elements.filter((element) => element.kind === 'command');
      return actor && commands.length ? [{ slice, actor, commands }] : [];
    });
    if (!journeys.length) continue;
    lines.push(`### ${humanize(context.name)}`, '');
    for (const journey of journeys) {
      diagramCount += 1;
      lines.push(
        `<!-- em:section id="diagrams.journey.${journey.slice.id}" source="${journey.slice.id}" -->`,
        `#### ${humanize(journey.slice.name)}`,
        '',
        '```mermaid',
        ...journeyFlowchart(model, journey, slicesById, elementsById, text),
        '```',
        ''
      );
    }
  }
  if (!diagramCount) lines.push(text.empty, '');
  return lines.join('\n');
};

const overallJourneyFlowchart = (
  model: EmModel,
  journey: NonNullable<EmModel['userJourneys']>[number]
): string[] => {
  const contextNames = new Map(model.contexts.map((context) => [context.id, context.name]));
  const nodeIds = new Map(journey.stages.map((stage, index) => [stage.id, `S${index + 1}`]));
  return [
    'flowchart LR',
    ...journey.stages.map((stage) => {
      const context = contextNames.get(stage.contextId ?? '') ?? stage.context;
      return `  ${nodeIds.get(stage.id)}["${safeLabel(humanize(stage.name))}<br/>${safeLabel(humanize(context))}"]`;
    }),
    ...journey.transitions.flatMap(({ source, target, condition }) => {
      const from = nodeIds.get(source);
      const to = nodeIds.get(target);
      return from && to
        ? [`  ${from} ${condition ? `-->|${safeLabel(condition).replace(/\|/g, '/')}|` : '-->'} ${to}`]
        : [];
    })
  ];
};

const journeyFlowchart = (
  model: EmModel,
  journey: JourneySlice,
  slicesById: Map<string, EmSlice>,
  elementsById: Map<string, EmElement>,
  text: typeof copy.en
): string[] => {
  const nodes = new Map<string, { id: string; label: string }>();
  const links = new Set<string>();
  const outgoing = (source: string, label: string): EmElement[] => model.edges
    .filter((edge) => edge.source === source && edge.label === label)
    .map((edge) => elementsById.get(edge.target))
    .filter((element): element is EmElement => Boolean(element));
  const node = (key: string, label: string): string => {
    const existing = nodes.get(key);
    if (existing) return existing.id;
    const id = `J${nodes.size + 1}`;
    nodes.set(key, { id, label });
    return id;
  };
  const link = (source: string, target: string): void => {
    links.add(`${source} --> ${target}`);
  };
  const actorNode = node(journey.actor.id, `${text.actor}: ${humanize(journey.actor.name)}`);
  const screen = journey.slice.elements.find((element) => element.kind === 'screen');
  const entryNode = screen
    ? node(screen.id, `${text.screen}: ${humanize(screen.name)}`)
    : actorNode;
  if (screen) link(actorNode, entryNode);

  const addEvent = (
    event: EmElement,
    sourceNode: string,
    includeAutomation: boolean,
    includeNextAction: boolean
  ): void => {
    const eventNode = node(event.id, `${text.result}: ${humanize(event.name)}`);
    link(sourceNode, eventNode);
    for (const view of outgoing(event.id, 'updates').filter((element) => element.kind === 'readmodel')) {
      link(eventNode, node(view.id, `${text.view}: ${humanize(view.name)}`));
    }
    if (includeAutomation) for (const automation of model.edges
      .filter((edge) => edge.source === event.id && (edge.label === 'triggers' || edge.label === 'reactsTo'))
      .map((edge) => elementsById.get(edge.target))
      .filter((element): element is EmElement => element?.kind === 'automation')) {
      const condition = automation.metadata?.condition;
      const label = `${text.automation}: ${humanize(automation.name)}${condition ? ` (${condition})` : ''}`;
      const automationNode = node(automation.id, label);
      link(eventNode, automationNode);
      for (const command of outgoing(automation.id, 'emits').filter((element) => element.kind === 'command')) {
        const commandNode = node(command.id, `${text.action}: ${humanize(command.name)}`);
        link(automationNode, commandNode);
        for (const result of commandEvents(command, slicesById, outgoing)) {
          addEvent(result, commandNode, false, false);
        }
      }
    }
    if (!includeNextAction) return;
    for (const command of outgoing(event.id, 'reactsTo').filter((element) => element.kind === 'command')) {
      const nextSlice = command.sliceId ? slicesById.get(command.sliceId) : undefined;
      const nextActor = nextSlice?.elements.find((element) => element.kind === 'actor');
      if (!nextSlice || !nextActor || nextSlice.id === journey.slice.id) continue;
      let previousNode = node(`next:${command.id}`, `${text.nextAction}: ${humanize(nextActor.name)}`);
      link(eventNode, previousNode);
      const nextScreen = nextSlice.elements.find((element) => element.kind === 'screen');
      if (nextScreen) {
        const screenNode = node(nextScreen.id, `${text.nextScreen}: ${humanize(nextScreen.name)}`);
        link(previousNode, screenNode);
        previousNode = screenNode;
      }
      const commandNode = node(command.id, `${text.action}: ${humanize(command.name)}`);
      link(previousNode, commandNode);
      for (const result of commandEvents(command, slicesById, outgoing)) {
        addEvent(result, commandNode, false, false);
      }
    }
  };

  for (const command of journey.commands) {
    const commandNode = node(command.id, `${text.action}: ${humanize(command.name)}`);
    link(entryNode, commandNode);
    for (const event of commandEvents(command, slicesById, outgoing)) {
      addEvent(event, commandNode, true, true);
    }
    for (const specification of journey.slice.elements.filter((element) => element.kind === 'gwt')) {
      if (specification.metadata?.when && specification.metadata.when !== command.name) continue;
      const failure = specification.metadata?.thenError ?? specification.metadata?.thenReject;
      if (failure) link(commandNode, node(specification.id, `${text.failure}: ${failure}`));
    }
  }

  return [
    'flowchart LR',
    ...[...nodes.values()].map(({ id, label }) => `  ${id}["${safeLabel(label)}"]`),
    ...[...links].map((edge) => `  ${edge}`)
  ];
};

const commandEvents = (
  command: EmElement,
  slicesById: Map<string, EmSlice>,
  outgoing: (source: string, label: string) => EmElement[]
): EmElement[] => {
  const direct = outgoing(command.id, 'emits').filter((element) => element.kind === 'event');
  const slice = command.sliceId ? slicesById.get(command.sliceId) : undefined;
  if (!slice || slice.elements.filter((element) => element.kind === 'command').length !== 1) return direct;
  return [...new Map([...direct, ...slice.elements.filter((element) => element.kind === 'event')]
    .map((element) => [element.id, element])).values()];
};

const safeLabel = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
