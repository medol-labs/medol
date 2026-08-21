import { flattenElements } from '../../dslParser';
import type { EmContext, EmElement, EmField, EmModel, EmSlice } from '../../model';
import { humanize, toDslId } from '../../name';
import type {
  PrdActor,
  PrdAggregate,
  PrdAutomation,
  PrdDataDictionaryItem,
  PrdDocument,
  PrdElementSummary,
  PrdField,
  PrdGenerationResult,
  PrdSpecification,
  PrdSlice,
  PrdSourceRef,
  PrdTrace,
  PrdTraceSection
} from './prdModel';
import { coveredSpecificationExpressions } from '../../specificationCoverage';

const generatorId = 'prd-markdown';
const generatorVersion = '0.1.0';

export interface PrdGenerateOptions {
  sourceText?: string;
  generatedAt?: string;
}

export const generatePrd = (model: EmModel, options: PrdGenerateOptions = {}): PrdGenerationResult => {
  const context = model.contexts[0];
  const titleSource = model.domains.length === 1
    ? model.domains[0].name
    : model.domains.length > 1
      ? 'Event Modeling Workspace'
      : context?.name ?? 'Product Requirements';
  const title = humanize(titleSource);
  const documentId = `prd:${toDslId(titleSource)}`;
  const document = buildPrdDocument(model, documentId, title);
  const trace = buildTrace(model, document, options);

  return { document, trace };
};

const buildPrdDocument = (model: EmModel, id: string, title: string): PrdDocument => {
  const contexts = model.contexts;
  const primaryContext = contexts[0];
  const notes = contexts.flatMap((context) => context.notes);
  const risks = contexts.flatMap((context) => context.risks);
  const decisions = contexts.flatMap((context) => context.decisions);
  const metrics = contexts.flatMap((context) => context.metrics);
  const slices = contexts.flatMap((context) =>
    [
      ...context.aggregates.flatMap((aggregate) =>
        aggregate.slices.map((slice) => toPrdSlice(slice, aggregate.name, context.name))
      ),
      ...context.slices.map((slice) => toPrdSlice(
        slice,
        context.concepts.filter((concept) => concept.sliceIds.includes(slice.id)).map((concept) => concept.name).join(', ') || 'Context',
        context.name
      ))
    ]
  );

  return {
    id,
    title,
    ...(model.domains.length === 1 ? { domain: model.domains[0].name } : {}),
    context: contexts.map((context) => context.name).join(', ') || primaryContext?.name || 'EventModel',
    overview: buildOverview(model, primaryContext),
    notes,
    actors: collectActors(model),
    aggregates: contexts.flatMap((context) =>
      [
        ...context.aggregates.map<PrdAggregate>((aggregate) => ({
          id: aggregate.id,
          name: aggregate.name,
          type: 'aggregate',
          context: context.name,
          states: aggregate.states,
          sourceRefs: [aggregate.id]
        })),
        ...context.concepts.map<PrdAggregate>((concept) => ({
          id: concept.id,
          name: concept.name,
          type: 'concept',
          context: context.name,
          states: concept.states,
          sourceRefs: [concept.id]
        }))
      ]
    ),
    slices,
    dataDictionary: collectDataDictionary(model),
    automations: collectAutomations(model),
    risks,
    decisions,
    metrics,
    openQuestions: collectOpenQuestions(model, slices)
  };
};

const buildOverview = (model: EmModel, context: EmContext | undefined): string => {
  const domainNames = model.domains.map((domain) => humanize(domain.name));
  const contextNames = model.contexts.map((item) => humanize(item.name));
  if (domainNames.length) {
    return `${domainNames.join(', ')} covers ${contextNames.join(', ') || humanize(context?.name ?? 'the modeled context')} and defines the product capabilities, operating roles, data views, business rules, and delivery acceptance scope required for implementation.`;
  }
  return `${contextNames.join(', ') || humanize(context?.name ?? 'the modeled context')} defines the product capabilities, operating roles, data views, business rules, and delivery acceptance scope required for implementation.`;
};

const toPrdSlice = (slice: EmSlice, aggregate: string, context: string): PrdSlice => {
  const actor = slice.elements.find((element) => element.kind === 'actor');
  const ui = slice.elements.find((element) => element.kind === 'screen');
  const command = slice.elements.find((element) => element.kind === 'command');
  const event = slice.elements.find((element) => element.kind === 'event');
  const readmodels = slice.elements.filter((element) => element.kind === 'readmodel');
  const specifications = slice.elements.filter((element) => element.kind === 'gwt');

  return {
    id: slice.id,
    name: slice.name,
    context,
    aggregate,
    ...(actor ? { actor: actor.name } : {}),
    ...(ui ? { ui: ui.name } : {}),
    ...(ui?.ui?.type ? { uiType: ui.ui.type } : {}),
    operation: inferOperation(slice, command, readmodels.length > 0),
    ...(command ? { command: toElementSummary(command) } : {}),
    ...(event ? { event: toElementSummary(event) } : {}),
    readModelNames: readmodels.map((readmodel) => readmodel.name),
    ...(slice.resultingState ? { resultingState: slice.resultingState } : {}),
    startsLifecycle: Boolean(slice.startsLifecycle),
    businessRules: specifications.map((specification) => humanize(specification.name)),
    specifications: specifications.map(toPrdSpecification),
    dependencies: slice.elements.flatMap((element) =>
      Object.entries(element.metadata ?? {})
        .filter(([key]) => key === 'on' || key === 'emits' || key === 'when' || key === 'then' || /^given\d+$/.test(key))
        .map(([key, value]) => `${key}: ${value}`)
    ),
    hotspots: slice.hotspots,
    sourceRefs: [slice.id, ...slice.elements.map((element) => element.id)]
  };
};

const inferOperation = (
  slice: EmSlice,
  command: EmElement | undefined,
  hasReadModel: boolean
): PrdSlice['operation'] => {
  if (!command && hasReadModel) return 'read';
  if (!command) return 'automation';
  if (slice.startsLifecycle || /^(create|register|define|declare|append|record|start)/i.test(command.name)) {
    return 'create';
  }
  if (/^(delete|remove)/i.test(command.name)) return 'delete';
  if (/^(update|edit|change|configure|set|rename|resume|reactivate|activate|deactivate|approve|reject|revoke|retire|cancel|expire|suspend|promote|complete|submit|verify|validate|trust|lock|pause|rollback)/i.test(command.name)) {
    return 'update';
  }
  return 'action';
};

const toPrdSpecification = (element: EmElement): PrdSpecification => {
  const metadata = element.metadata ?? {};
  const expressions = Object.entries(metadata)
    .filter(([key]) => /^expression\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(10)) - Number(right.slice(10)))
    .map(([, expression]) => expression);
  return {
    name: element.name,
    ...(metadata.specification ? { specification: metadata.specification } : {}),
    ...(metadata.rule ? { rule: metadata.rule } : {}),
    expressions,
    validates: coveredSpecificationExpressions({ expressions, metadata }),
    given: Object.entries(metadata)
      .filter(([key]) => /^given\d+$/.test(key))
      .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
      .map(([, value]) => value),
    ...(metadata.when ? { when: metadata.when } : {}),
    ...(metadata.then ? { then: metadata.then } : {}),
    ...(metadata.thenReject ? { reject: metadata.thenReject } : {}),
    ...(metadata.thenError ? { error: metadata.thenError } : {}),
    examples: Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => key.startsWith('example:'))
        .map(([key, value]) => [key.slice('example:'.length), value])
    )
  };
};

const toElementSummary = (element: EmElement): PrdElementSummary => ({
  id: element.id,
  kind: element.kind,
  name: element.name,
  fields: element.fields.map(toPrdField)
});

const toPrdField = (field: EmField): PrdField => ({
  name: field.name,
  type: field.type,
  cardinality: field.cardinality ?? 'Single',
  attributes: field.attributes,
  ...(field.example ? { example: field.example } : {}),
  ...(field.mapping ? { mapping: formatMapping(field) } : {})
});

const formatMapping = (field: EmField): string | undefined => {
  if (!field.mapping) return undefined;
  const source = field.mapping.sources.length ? ` from ${field.mapping.sources.join(', ')}` : '';
  const rule = field.mapping.rule ? ` rule: ${field.mapping.rule}` : '';
  return `${field.mapping.kind}${source}${rule}`.trim();
};

const collectActors = (model: EmModel): PrdActor[] => {
  const actors = new Map<string, PrdActor>();
  for (const element of flattenElements(model)) {
    if (element.kind !== 'actor') continue;
    const existing = actors.get(element.name);
    if (existing) {
      existing.sourceRefs.push(element.id);
      continue;
    }
    actors.set(element.name, {
      id: `actor:${element.name}`,
      name: element.name,
      sourceRefs: [element.id]
    });
  }
  return [...actors.values()];
};

const collectDataDictionary = (model: EmModel): PrdDataDictionaryItem[] =>
  flattenElements(model).flatMap((element) =>
    element.fields.map((field) => ({
      ...toPrdField(field),
      owner: element.name,
      ownerKind: element.kind,
      sourceRef: element.id
    }))
  );

const collectAutomations = (model: EmModel): PrdAutomation[] =>
  flattenElements(model)
    .filter((element) => element.kind === 'automation' || element.kind === 'integration')
    .map((element) => ({
      id: element.id,
      name: element.name,
      kind: element.kind,
      sourceRefs: [element.id],
      metadata: element.metadata ?? {}
    }));

const collectOpenQuestions = (model: EmModel, slices: PrdSlice[]): string[] => {
  const questions: string[] = [];
  for (const diagnostic of model.diagnostics) {
    questions.push(`Resolve MEDOL diagnostic: ${diagnostic}`);
  }
  const missingSpecifications = new Map<string, string[]>();
  for (const slice of slices) {
    if (!slice.command && !slice.readModelNames.length && !slice.event) {
      questions.push(`Clarify the product behavior for ${humanize(slice.name)}.`);
    }
    if (slice.command && !slice.event && !slice.readModelNames.length) {
      questions.push(`Confirm the expected result event or read model for ${humanize(slice.name)}.`);
    }
    if (!slice.businessRules.length && slice.command) {
      const names = missingSpecifications.get(slice.context) ?? [];
      names.push(humanize(slice.name));
      missingSpecifications.set(slice.context, names);
    }
  }
  for (const [context, names] of missingSpecifications) {
    const examples = names.slice(0, 4).join(', ');
    const remainder = names.length > 4 ? ` and ${names.length - 4} more` : '';
    questions.push(`${humanize(context)} has ${names.length} operations without explicit acceptance criteria: ${examples}${remainder}.`);
  }
  return questions;
};

const buildTrace = (model: EmModel, document: PrdDocument, options: PrdGenerateOptions): PrdTrace => {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sections: PrdTraceSection[] = [
    section('prd.section.overview', 'Product Overview', 'overview', collectContextRefs(model), ['overview']),
    section('prd.section.actors', 'Actors', 'actors', document.actors.flatMap((actor) => actor.sourceRefs).map(sourceRef), ['actors']),
    section('prd.section.aggregates', 'Core Business Objects', 'aggregates', document.aggregates.flatMap((aggregate) => aggregate.sourceRefs).map(sourceRef), ['aggregates']),
    ...document.slices.map((slice) =>
      section(`prd.section.slice.${slice.name}`, humanize(slice.name), 'feature', slice.sourceRefs.map(sourceRef), [
        'userStory',
        'businessRules',
        'acceptanceCriteria'
      ])
    ),
    section('prd.section.dataDictionary', 'Data Dictionary', 'dataDictionary', document.dataDictionary.map((item) => sourceRef(item.sourceRef)), ['fields']),
    section('prd.section.automations', 'Automation, Policies, And Integrations', 'automation', document.automations.flatMap((item) => item.sourceRefs).map(sourceRef), ['automations']),
    section('prd.section.risks', 'Risks And Decisions', 'risks', collectContextRefs(model), ['risks', 'decisions', 'metrics']),
    section('prd.section.openQuestions', 'Open Questions', 'openQuestions', collectContextRefs(model), ['openQuestions'])
  ];

  return {
    documentId: document.id,
    dslHash: `fnv1a:${hashText(options.sourceText ?? JSON.stringify(model))}`,
    generatedAt,
    generator: {
      id: generatorId,
      version: generatorVersion
    },
    sections
  };
};

const section = (
  sectionId: string,
  title: string,
  kind: string,
  sourceRefs: PrdSourceRef[],
  blockIds: string[]
): PrdTraceSection => ({
  sectionId,
  title,
  kind,
  sourceRefs: dedupeSourceRefs(sourceRefs),
  generatedBlocks: blockIds.map((blockId) => ({
    blockId,
    source: 'generator',
    sourceRefs: dedupeSourceRefs(sourceRefs).map((ref) => ref.dslId)
  }))
});

const collectContextRefs = (model: EmModel): PrdSourceRef[] =>
  model.contexts.map((context) => sourceRef(context.id));

const sourceRef = (dslId: string): PrdSourceRef => {
  const parts = dslId.split('/').filter(Boolean);
  const kind = parts.length >= 2 ? parts[parts.length - 2] : 'model';
  const name = parts[parts.length - 1] ?? dslId;
  return {
    dslId,
    kind,
    name,
    path: parts.filter((_, index) => index % 2 === 1)
  };
};

const dedupeSourceRefs = (refs: PrdSourceRef[]): PrdSourceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.dslId)) return false;
    seen.add(ref.dslId);
    return true;
  });
};

const hashText = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
