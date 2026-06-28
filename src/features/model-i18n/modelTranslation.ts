import type { CodegenField, CodegenModel } from '../../lib/codegenModel';

export interface ModelTranslationCatalog {
  sourceTexts: string[];
}

export type ModelTranslations = Record<string, string>;

export const buildModelTranslationCatalog = (
  codegenModel: CodegenModel
): ModelTranslationCatalog => {
  const texts = new Set<string>();
  const add = (value: string | undefined): void => {
    const text = value?.trim();
    if (text) texts.add(text);
  };
  const addField = (field: CodegenField): void => {
    const label = titleCase(field.name);
    add(label);
    add(`Enter ${label}`);
    add(`Select ${label}`);
    add(`${label} is required`);
  };

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

  add(codegenModel.domain);
  codegenModel.contexts.forEach((context) => {
    add(context.title);
    context.notes.forEach(add);
    context.risks.forEach(add);
    context.decisions.forEach(add);
    context.metrics.forEach(add);
  });
  codegenModel.valueTypes.forEach((valueType) => {
    add(valueType.title);
    valueType.fields.forEach(addField);
    valueType.values.forEach(add);
  });
  codegenModel.aggregates.forEach((aggregate) => {
    add(aggregate.title);
    aggregate.states.forEach(add);
  });
  codegenModel.concepts.forEach((concept) => {
    add(concept.title);
    concept.states.forEach(add);
  });
  codegenModel.actors.forEach((actor) => add(actor.title));
  codegenModel.slices.forEach((slice) => {
    add(slice.title);
    add(slice.chapter);
    slice.hotspots.forEach(add);
    [...slice.commands, ...slice.events, ...slice.readmodels, ...slice.screens, ...slice.processors]
      .forEach((element) => {
        add(element.title);
        element.fields.forEach(addField);
      });
    slice.specifications.forEach((specification) => {
      add(specification.title);
      add(specification.specification);
      add(specification.rule);
      specification.expressions.forEach(add);
      specification.given.forEach((item) => add(item.title));
      specification.when.forEach((item) => add(item.title));
      if (Array.isArray(specification.then)) {
        specification.then.forEach((item) => add(item.title));
      } else {
        add(specification.then.title);
        add(specification.then.description);
      }
    });
  });

  return {
    sourceTexts: [...texts].sort((left, right) => left.localeCompare(right))
  };
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
