import type { CodegenField, CodegenModel } from '../../lib/codegenModel';

export interface ModelTranslationCatalog {
  sourceTexts: string[];
}

export interface ModelTranslationGroup {
  name: string;
  sourceTexts: string[];
}

export type ModelTranslations = Record<string, string>;

export const buildModelTranslationCatalog = (
  codegenModel: CodegenModel
): ModelTranslationCatalog => {
  const groups = buildModelTranslationGroups(codegenModel);
  const texts = new Set<string>();
  groups.forEach((group) => group.sourceTexts.forEach((sourceText) => texts.add(sourceText)));

  return {
    sourceTexts: [...texts].sort((left, right) => left.localeCompare(right))
  };
};

export const buildModelTranslationGroups = (
  codegenModel: CodegenModel
): ModelTranslationGroup[] => {
  const global = createCollector();
  const contextCollectors = new Map(
    codegenModel.contexts.map((context) => [context.name, createCollector()])
  );
  const collectorForContext = (contextName: string | undefined) =>
    contextName ? contextCollectors.get(contextName) ?? global : global;

  addCommonTexts(global.add);

  global.add(codegenModel.domain);
  codegenModel.actors.forEach((actor) => global.add(actor.title));

  codegenModel.contexts.forEach((context) => {
    const collector = collectorForContext(context.name);
    collector.add(context.title);
    context.notes.forEach(collector.add);
    context.risks.forEach(collector.add);
    context.decisions.forEach(collector.add);
    context.metrics.forEach(collector.add);
  });

  codegenModel.valueTypes.forEach((valueType) => {
    const collector = collectorForContext(valueType.context);
    collector.add(valueType.title);
    valueType.fields.forEach((field) => addField(field, collector.add));
    valueType.values.forEach(collector.add);
  });

  codegenModel.aggregates.forEach((aggregate) => {
    const collector = collectorForContext(aggregate.context);
    collector.add(aggregate.title);
    aggregate.states.forEach(collector.add);
  });

  codegenModel.concepts.forEach((concept) => {
    const collector = collectorForContext(concept.context);
    collector.add(concept.title);
    concept.states.forEach(collector.add);
  });

  codegenModel.slices.forEach((slice) => {
    const collector = collectorForContext(slice.context);
    collector.add(slice.title);
    collector.add(slice.chapter);
    slice.hotspots.forEach(collector.add);
    [...slice.commands, ...slice.events, ...slice.readmodels, ...slice.screens, ...slice.processors]
      .forEach((element) => {
        collector.add(element.title);
        element.fields.forEach((field) => addField(field, collector.add));
      });
    slice.specifications.forEach((specification) => {
      collector.add(specification.title);
      collector.add(specification.specification);
      collector.add(specification.rule);
      specification.expressions.forEach(collector.add);
      specification.given.forEach((item) => collector.add(item.title));
      specification.when.forEach((item) => collector.add(item.title));
      if (Array.isArray(specification.then)) {
        specification.then.forEach((item) => collector.add(item.title));
      } else {
        collector.add(specification.then.title);
        collector.add(specification.then.description);
      }
    });
  });

  return [
    { name: 'Common', sourceTexts: global.sourceTexts() },
    ...codegenModel.contexts.map((context) => ({
      name: context.title,
      sourceTexts: collectorForContext(context.name).sourceTexts()
    }))
  ].filter((group) => group.sourceTexts.length > 0);
};

const createCollector = () => {
  const texts = new Set<string>();
  const add = (value: string | undefined): void => {
    const text = value?.trim();
    if (text) texts.add(text);
  };

  return {
    add,
    sourceTexts: () => [...texts].sort((left, right) => left.localeCompare(right))
  };
};

const addCommonTexts = (add: (value: string | undefined) => void): void => {
  add('Dashboard');
  add('Submit');
  add('Submitting...');
  add('Cancel');
  add('Add');
  add('Actions');
  add('Select all');
  add('Select row');
  add('Asc');
  add('Desc');
  add('Reset');
  add('Hide');
  add('True');
  add('False');
};

const addField = (
  field: CodegenField,
  add: (value: string | undefined) => void
): void => {
  const label = titleCase(field.name);
  add(label);
  add(`Enter ${label}`);
  add(`Select ${label}`);
  add(`${label} is required`);
};

export const toCodegenTranslations = (
  locale: string,
  translations: ModelTranslations
): { locales: string[]; defaultLocale: string; translations: Record<string, ModelTranslations> } => ({
  locales: [locale],
  defaultLocale: locale,
  translations: {
    [locale]: translations
  }
});

export const withCodegenTranslations = (
  codegenModel: CodegenModel,
  locale: string,
  translations: ModelTranslations
): CodegenModel => ({
  ...codegenModel,
  ...toCodegenTranslations(locale, translations)
});

const titleCase = (value: string): string =>
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
