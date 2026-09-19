import type { CodegenField, CodegenModel } from '../../lib/codegenModel';
import type {
  EmContext,
  EmElement,
  EmField,
  EmModel,
  EmSlice
} from '../../lib/model';
import { humanize } from '../../lib/name';

export interface ModelTranslationCatalog {
  sourceTexts: string[];
}

export interface ModelTranslationGroup {
  name: string;
  sourceTexts: string[];
}

export type ModelTranslationUnitKind = 'common' | 'context' | 'slice';

export interface ModelTranslationUnit {
  id: string;
  kind: ModelTranslationUnitKind;
  name: string;
  contextName?: string;
  sourceRefs: string[];
  sourceTexts: string[];
}

export interface ModelTranslationUnitSummary {
  id: string;
  kind: ModelTranslationUnitKind;
  name: string;
  missing: number;
  total: number;
  sourceRefs: string[];
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

export const buildModelTranslationUnits = (
  model: EmModel
): ModelTranslationUnit[] => {
  const common = createCollector();
  const domainRefs = (model.domains ?? []).map((domain) => domain.id);
  addCommonTexts(common.add);
  (model.domains ?? []).forEach((domain) => {
    addIdentifier(domain.name, common.add);
    (domain.deployments ?? []).forEach((deployment) => addIdentifier(deployment.name, common.add));
  });
  (model.deployments ?? []).forEach((deployment) => addIdentifier(deployment.name, common.add));
  (model.contexts ?? []).forEach((context) => {
    allContextSlicesWithOwners(context).forEach(({ slice }) => {
      slice.elements
        .filter((element) => element.kind === 'actor')
        .forEach((actor) => addIdentifier(actor.name, common.add));
    });
  });

  const units: ModelTranslationUnit[] = [{
    id: 'common',
    kind: 'common',
    name: 'Common',
    sourceRefs: domainRefs,
    sourceTexts: common.sourceTexts()
  }];

  for (const context of model.contexts ?? []) {
    const contextCollector = createCollector();
    addContextGeneralTexts(context, contextCollector.add);
    units.push({
      id: `context:${context.id}`,
      kind: 'context',
      name: humanize(context.name),
      contextName: context.name,
      sourceRefs: [
        context.id,
    ...(context.aggregates ?? []).map((aggregate) => aggregate.id),
    ...(context.concepts ?? []).map((concept) => concept.id),
    ...(context.valueTypes ?? []).map((valueType) => valueType.id),
    ...(context.externalSystems ?? []).map((externalSystem) => externalSystem.id)
      ],
      sourceTexts: contextCollector.sourceTexts()
    });

    for (const { slice } of allContextSlicesWithOwners(context)) {
      const sliceCollector = createCollector();
      addSliceTexts(slice, sliceCollector.add);
      units.push({
        id: `slice:${slice.id}`,
        kind: 'slice',
        name: humanize(slice.name),
        contextName: context.name,
        sourceRefs: [slice.id],
        sourceTexts: sliceCollector.sourceTexts()
      });
    }
  }

  return units.filter((unit) => unit.sourceTexts.length > 0);
};

export const buildModelTranslationCatalogFromUnits = (
  units: ModelTranslationUnit[]
): ModelTranslationCatalog => ({
  sourceTexts: [
    ...new Set(units.flatMap((unit) => unit.sourceTexts))
  ].sort((left, right) => left.localeCompare(right))
});

export const summarizeModelTranslationUnits = (
  units: ModelTranslationUnit[],
  translations: ModelTranslations
): ModelTranslationUnitSummary[] => units
  .map((unit) => ({
    id: unit.id,
    kind: unit.kind,
    name: unit.name,
    sourceRefs: unit.sourceRefs,
    total: unit.sourceTexts.length,
    missing: unit.sourceTexts.filter((sourceText) => !translations[sourceText]).length
  }))
  .filter((unit) => unit.missing > 0);

export const renderModelTranslationMarkdown = (input: {
  model: EmModel;
  locale: string;
  sourceHash: string;
  translations: ModelTranslations;
}): string => {
  const units = buildModelTranslationUnits(input.model);
  const title = input.locale === 'zh-CN'
    ? '模型国际化术语表'
    : 'Model Translation Glossary';
  const text = input.locale === 'zh-CN'
    ? {
        sourceHash: '源模型哈希',
        summary: '翻译进度',
        total: '总条目',
        translated: '已翻译',
        missing: '缺失',
        source: '原文',
        translation: '译文',
        status: '状态',
        done: '已翻译',
        pending: '待翻译',
        common: '全局术语',
        context: '上下文术语',
        slice: 'Slice 术语'
      }
    : {
        sourceHash: 'Source hash',
        summary: 'Translation Progress',
        total: 'Total',
        translated: 'Translated',
        missing: 'Missing',
        source: 'Source',
        translation: 'Translation',
        status: 'Status',
        done: 'Translated',
        pending: 'Pending',
        common: 'Common Terms',
        context: 'Context Terms',
        slice: 'Slice Terms'
      };
  const total = buildModelTranslationCatalogFromUnits(units).sourceTexts.length;
  const translated = Object.keys(input.translations).length;
  const lines = [
    `# ${title}`,
    '',
    `- ${text.sourceHash}: ${input.sourceHash}`,
    `- ${text.total}: ${total}`,
    `- ${text.translated}: ${Math.min(translated, total)}`,
    `- ${text.missing}: ${Math.max(0, total - translated)}`,
    ''
  ];

  for (const unit of units) {
    lines.push(sectionMarker(unit));
    const heading = unit.kind === 'common'
      ? text.common
      : unit.kind === 'context'
        ? `${text.context}: ${unit.name}`
        : `${text.slice}: ${unit.name}`;
    lines.push(`## ${heading}`);
    if (unit.contextName && unit.kind === 'slice') {
      lines.push('');
      lines.push(`- Context: ${humanize(unit.contextName)}`);
    }
    lines.push('');
    lines.push(`| ${text.source} | ${text.translation} | ${text.status} |`);
    lines.push('| --- | --- | --- |');
    unit.sourceTexts.forEach((sourceText) => {
      const translation = input.translations[sourceText]?.trim();
      lines.push(`| ${cell(sourceText)} | ${cell(translation || '-')} | ${translation ? text.done : text.pending} |`);
    });
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
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
  field: Pick<CodegenField, 'name'> | Pick<EmField, 'name'>,
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
    [locale]: normalizeModelTranslations(locale, translations)
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

export const parseModelTranslationMarkdown = (markdown: string): ModelTranslations => {
  const translations: ModelTranslations = {};
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    if (/^\|\s*-+\s*\|/u.test(trimmed)) continue;

    const cells = splitMarkdownTableRow(trimmed).map((value) => decodeMarkdownTableCell(value.trim()));
    const [source, translation] = cells;
    if (!source || !translation) continue;
    if (isTranslationHeader(source, translation)) continue;
    if (translation === '-') continue;

    translations[source] = translation;
  }
  return translations;
};

const titleCase = (value: string): string =>
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeModelTranslations = (
  locale: string,
  translations: ModelTranslations
): ModelTranslations => {
  if (locale !== 'zh-CN') return translations;
  return Object.fromEntries(
    Object.entries(translations).map(([source, translation]) => [
      source,
      normalizeZhCnModelTranslation(source, translation)
    ])
  );
};

const normalizeZhCnModelTranslation = (
  source: string,
  translation: string
): string => {
  const trimmed = translation.trim();
  const exact = exactZhCnContextualTranslation(source);
  if (exact) return exact;
  if (!/feature schema/i.test(source)) return trimmed;

  let normalized = trimmed
    .replace(/特征模式/g, '特征架构')
    .replace(/功能架构/g, '特征架构');

  if (/^agent feature schema catalog(s)?$/i.test(source)) {
    normalized = normalized.replace(/^(?:代理)?特征架构目录/u, '运行时代理特征架构目录');
  }

  return normalized;
};

const exactZhCnContextualTranslation = (source: string): string | undefined => {
  const normalized = source.trim().toLowerCase();
  const exactTranslations: Record<string, string> = {
    'feature schema': '特征架构',
    'feature schemas': '特征架构',
    'feature schema catalog': '特征架构目录',
    'feature schema catalogs': '特征架构目录',
    'agent feature schema catalog': '运行时代理特征架构目录',
    'agent feature schema catalogs': '运行时代理特征架构目录'
  };
  return exactTranslations[normalized];
};

const addIdentifier = (
  value: string | undefined,
  add: (value: string | undefined) => void
): void => {
  if (!value) return;
  add(humanize(value));
};

const addContextGeneralTexts = (
  context: EmContext,
  add: (value: string | undefined) => void
): void => {
  addIdentifier(context.name, add);
  [
    ...(context.notes ?? []),
    ...(context.risks ?? []),
    ...(context.decisions ?? []),
    ...(context.metrics ?? [])
  ].forEach(add);
  (context.valueTypes ?? []).forEach((valueType) => {
    addIdentifier(valueType.name, add);
    (valueType.values ?? []).forEach((value) => addIdentifier(value, add));
    (valueType.fields ?? []).forEach((field) => {
      addField(field, add);
      if (field.mapping?.rule) add(field.mapping.rule);
    });
  });
  (context.aggregates ?? []).forEach((aggregate) => {
    addIdentifier(aggregate.name, add);
    (aggregate.states ?? []).forEach((state) => addIdentifier(state, add));
  });
  (context.concepts ?? []).forEach((concept) => {
    addIdentifier(concept.name, add);
    (concept.states ?? []).forEach((state) => addIdentifier(state, add));
    (concept.sliceNames ?? []).forEach((sliceName) => addIdentifier(sliceName, add));
  });
  (context.externalSystems ?? []).forEach((externalSystem) => {
    addIdentifier(externalSystem.name, add);
    addIdentifier(externalSystem.kind, add);
    addIdentifier(externalSystem.protocol, add);
    (externalSystem.capabilities ?? []).forEach((capability) => addIdentifier(capability.name, add));
  });
  (context.looseElements ?? []).forEach((element) => addElementTexts(element, add));
};

const addSliceTexts = (
  slice: EmSlice,
  add: (value: string | undefined) => void
): void => {
  addIdentifier(slice.name, add);
  addIdentifier(slice.resultingState, add);
  (slice.hotspots ?? []).forEach(add);
  (slice.elements ?? []).forEach((element) => addElementTexts(element, add));
};

const addElementTexts = (
  element: EmElement,
  add: (value: string | undefined) => void
): void => {
  addIdentifier(element.name, add);
  (element.fields ?? []).forEach((field) => {
    addField(field, add);
    if (field.mapping?.rule) add(field.mapping.rule);
  });
  for (const [key, value] of Object.entries(element.metadata ?? {})) {
    if (!isTranslatableMetadata(key)) continue;
    if (isNarrativeMetadata(key)) add(value);
    else addIdentifier(value, add);
  }
};

const allContextSlicesWithOwners = (
  context: EmContext
): Array<{ slice: EmSlice }> => [
  ...(context.aggregates ?? []).flatMap((aggregate) =>
    (aggregate.slices ?? []).map((slice) => ({ slice }))
  ),
  ...(context.slices ?? []).map((slice) => ({ slice }))
];

const isTranslatableMetadata = (key: string): boolean =>
  !/^expression\d+$/.test(key)
  && !key.startsWith('example:')
  && !key.startsWith('givenExample:');

const isNarrativeMetadata = (key: string): boolean =>
  key === 'rule'
  || key === 'specification'
  || key === 'thenReject'
  || key === 'thenError'
  || key === 'description';

const sectionMarker = (unit: ModelTranslationUnit): string => {
  const id = `model-i18n.${unit.kind}.${slug(unit.id)}`;
  if (unit.sourceRefs.length === 1) {
    return `<!-- em:section id="${id}" source="${unit.sourceRefs[0]}" -->`;
  }
  return `<!-- em:section id="${id}" sources="${unit.sourceRefs.join(' ')}" -->`;
};

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'unit';

const cell = (value: string): string =>
  String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');

const splitMarkdownTableRow = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  const body = line.slice(1, -1);

  for (const char of body) {
    if (escaped) {
      current += char === '|' ? char : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (escaped) {
    current += '\\';
  }
  cells.push(current);
  return cells;
};

const decodeMarkdownTableCell = (value: string): string =>
  value.replace(/<br\s*\/?>/giu, '\n').replace(/\\\|/g, '|').trim();

const isTranslationHeader = (source: string, translation: string): boolean => {
  const normalizedSource = source.toLowerCase();
  const normalizedTranslation = translation.toLowerCase();
  return (normalizedSource === 'source' || source === '原文')
    && (normalizedTranslation === 'translation' || translation === '译文');
};
