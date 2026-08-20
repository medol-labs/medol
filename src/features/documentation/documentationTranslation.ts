import type {
  EmContext,
  EmElement,
  EmField,
  EmModel,
  EmSlice
} from '../../lib/model';
import { humanize } from '../../lib/name';
import type { ModelTranslations } from '../model-i18n/modelTranslation';

export interface DocumentationTranslationCatalog {
  identifiers: string[];
  narratives: string[];
}

export interface DocumentationTranslations {
  identifiers: Record<string, string>;
  narratives: Record<string, string>;
}

export const buildDocumentationTranslationCatalog = (
  model: EmModel
): DocumentationTranslationCatalog => {
  const identifiers = new Set<string>();
  const narratives = new Set<string>();

  for (const domain of model.domains) identifiers.add(domain.name);
  for (const context of model.contexts) {
    collectContext(context, identifiers, narratives);
  }
  for (const diagnostic of model.diagnostics) narratives.add(diagnostic);

  return {
    identifiers: [...identifiers].filter(Boolean).sort(),
    narratives: [...narratives].filter(Boolean).sort()
  };
};

export const translateDocumentationModel = (
  model: EmModel,
  translations: DocumentationTranslations
): EmModel => {
  const translateIdentifier = (value: string): string => {
    const translated = translations.identifiers[value]?.trim();
    if (!translated || translated === value) return value;
    return `${translated}（${value}）`;
  };
  const translateNarrative = (value: string): string =>
    translations.narratives[value]?.trim() || value;

  const translateField = (field: EmField): EmField => ({
    ...field,
    ...(field.mapping?.rule
      ? {
          mapping: {
            ...field.mapping,
            rule: translateNarrative(field.mapping.rule)
          }
        }
      : {})
  });
  const translateElement = (element: EmElement): EmElement => ({
    ...element,
    name: translateIdentifier(element.name),
    fields: element.fields.map(translateField),
    ...(element.metadata
      ? {
          metadata: Object.fromEntries(
            Object.entries(element.metadata).map(([key, value]) => [
              key,
              !isTranslatableMetadata(key)
                ? value
                : isNarrativeMetadata(key)
                  ? translateNarrative(value)
                  : translateIdentifier(value)
            ])
          )
        }
      : {})
  });
  const translateSlice = (slice: EmSlice): EmSlice => ({
    ...slice,
    name: translateIdentifier(slice.name),
    ...(slice.resultingState
      ? { resultingState: translateIdentifier(slice.resultingState) }
      : {}),
    hotspots: slice.hotspots.map(translateNarrative),
    elements: slice.elements.map(translateElement)
  });
  const translateContext = (context: EmContext): EmContext => ({
    ...context,
    name: translateIdentifier(context.name),
    aggregates: context.aggregates.map((aggregate) => ({
      ...aggregate,
      name: translateIdentifier(aggregate.name),
      states: aggregate.states.map(translateIdentifier),
      slices: aggregate.slices.map(translateSlice)
    })),
    slices: context.slices.map(translateSlice),
    concepts: context.concepts.map((concept) => ({
      ...concept,
      name: translateIdentifier(concept.name),
      states: concept.states.map(translateIdentifier),
      sliceNames: concept.sliceNames.map(translateIdentifier)
    })),
    looseElements: context.looseElements.map(translateElement),
    notes: context.notes.map(translateNarrative),
    risks: context.risks.map(translateNarrative),
    decisions: context.decisions.map(translateNarrative),
    metrics: context.metrics.map(translateNarrative)
  });
  const contexts = model.contexts.map(translateContext);
  const contextsById = new Map(contexts.map((context) => [context.id, context]));

  return {
    ...model,
    contexts,
    domains: model.domains.map((domain) => ({
      ...domain,
      name: translateIdentifier(domain.name),
      contexts: domain.contexts.map((context) =>
        contextsById.get(context.id) ?? translateContext(context)
      )
    })),
    diagnostics: model.diagnostics.map(translateNarrative)
  };
};

export const modelTranslationsToDocumentationTranslations = (
  model: EmModel,
  translations: ModelTranslations
): DocumentationTranslations => {
  const catalog = buildDocumentationTranslationCatalog(model);
  const identifiers = Object.fromEntries(
    catalog.identifiers
      .map((identifier) => [
        identifier,
        lookupModelTranslation(identifier, translations)
      ] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  );
  const narratives = Object.fromEntries(
    catalog.narratives
      .map((narrative) => [
        narrative,
        translations[narrative]?.trim()
      ] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  );

  return { identifiers, narratives };
};

export const translateDocumentationModelWithModelTranslations = (
  model: EmModel,
  translations: ModelTranslations
): EmModel =>
  translateDocumentationModel(
    model,
    modelTranslationsToDocumentationTranslations(model, translations)
  );

export const lookupModelTranslation = (
  value: string,
  translations: ModelTranslations
): string | undefined => {
  const candidates = [
    value,
    humanize(value),
    titleCase(value)
  ];
  for (const candidate of candidates) {
    const translated = translations[candidate]?.trim();
    if (translated && translated !== candidate) return translated;
  }
  return undefined;
};

const collectContext = (
  context: EmContext,
  identifiers: Set<string>,
  narratives: Set<string>
): void => {
  identifiers.add(context.name);
  context.aggregates.forEach((aggregate) => {
    identifiers.add(aggregate.name);
    aggregate.states.forEach((state) => identifiers.add(state));
    aggregate.slices.forEach((slice) => collectSlice(slice, identifiers, narratives));
  });
  context.slices.forEach((slice) => collectSlice(slice, identifiers, narratives));
  context.concepts.forEach((concept) => {
    identifiers.add(concept.name);
    concept.states.forEach((state) => identifiers.add(state));
  });
  context.looseElements.forEach((element) =>
    collectElement(element, identifiers, narratives)
  );
  [
    ...context.notes,
    ...context.risks,
    ...context.decisions,
    ...context.metrics
  ].forEach((value) => narratives.add(value));
};

const collectSlice = (
  slice: EmSlice,
  identifiers: Set<string>,
  narratives: Set<string>
): void => {
  identifiers.add(slice.name);
  if (slice.resultingState) identifiers.add(slice.resultingState);
  slice.hotspots.forEach((value) => narratives.add(value));
  slice.elements.forEach((element) => collectElement(element, identifiers, narratives));
};

const collectElement = (
  element: EmElement,
  identifiers: Set<string>,
  narratives: Set<string>
): void => {
  identifiers.add(element.name);
  for (const field of element.fields) {
    if (field.mapping?.rule) narratives.add(field.mapping.rule);
  }
  for (const [key, value] of Object.entries(element.metadata ?? {})) {
    if (!isTranslatableMetadata(key)) continue;
    (isNarrativeMetadata(key) ? narratives : identifiers).add(value);
  }
};

const isTranslatableMetadata = (key: string): boolean =>
  !/^expression\d+$/.test(key)
  && !key.startsWith('example:')
  && !key.startsWith('givenExample:');

const isNarrativeMetadata = (key: string): boolean =>
  key === 'rule'
  || key === 'thenReject'
  || key === 'thenError'
  || key === 'description';

const titleCase = (value: string): string =>
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
