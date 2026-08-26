import {
  parseModelTranslationMarkdown,
  type ModelTranslations
} from '../features/model-i18n/modelTranslation';
import {
  listModelingDocuments,
  readModelingDocument
} from './modelingDocumentRepository';
import {
  readModelTranslations,
  readReusableModelTranslations,
  upsertModelTranslations,
  type TranslationScope
} from './modelTranslationRepository';

export interface ResolvedModelTranslations {
  translations: ModelTranslations;
  current: number;
  reused: number;
  document: number;
}

export const readResolvedModelTranslations = (
  scope: TranslationScope,
  sourceTexts: string[] = [],
  options: {
    includeReusable?: boolean;
    includeDocuments?: boolean;
    persistResolved?: boolean;
  } = {}
): ResolvedModelTranslations => {
  const includeReusable = options.includeReusable ?? true;
  const includeDocuments = options.includeDocuments ?? true;
  const persistResolved = options.persistResolved ?? true;
  const current = filterTranslations(readModelTranslations(scope), sourceTexts);
  const reusable = includeReusable && sourceTexts.length > 0
    ? readReusableModelTranslations(
        scope,
        sourceTexts.filter((sourceText) => !current[sourceText])
      )
    : {};
  const documentTranslations = includeDocuments
    ? filterTranslations(readModelTranslationDocuments(scope), sourceTexts)
    : {};
  const translations = {
    ...reusable,
    ...current,
    ...documentTranslations
  };

  if (persistResolved) {
    const reusableToPersist = missingFrom(current, reusable);
    if (Object.keys(reusableToPersist).length > 0) {
      upsertModelTranslations({
        ...scope,
        translations: reusableToPersist,
        provider: 'local',
        model: 'historical-reuse'
      });
    }

    const documentToPersist = changedFrom({ ...current, ...reusable }, documentTranslations);
    if (Object.keys(documentToPersist).length > 0) {
      upsertModelTranslations({
        ...scope,
        translations: documentToPersist,
        provider: 'local',
        model: 'model-translations-document'
      });
    }
  }

  return {
    translations,
    current: Object.keys(current).length,
    reused: Object.keys(reusable).length,
    document: Object.keys(documentTranslations).length
  };
};

const readModelTranslationDocuments = (scope: TranslationScope): ModelTranslations => {
  if (!scope.workspaceId) return {};
  const documents = listModelingDocuments(scope.workspaceId)
    .filter((document) => document.kind === 'model-translations')
    .filter((document) => document.language === scope.locale)
    .sort((left, right) => documentRank(left.sourceHash, scope.sourceHash) - documentRank(right.sourceHash, scope.sourceHash)
      || left.updatedAt.localeCompare(right.updatedAt));

  const translations: ModelTranslations = {};
  for (const summary of documents) {
    const document = readModelingDocument(summary.id);
    if (!document?.markdown) continue;
    Object.assign(translations, parseModelTranslationMarkdown(document.markdown));
  }
  return translations;
};

const documentRank = (documentSourceHash: string | undefined, sourceHash: string): number => {
  if (documentSourceHash === sourceHash) return 2;
  if (documentSourceHash) return 1;
  return 0;
};

const filterTranslations = (
  translations: ModelTranslations,
  sourceTexts: string[]
): ModelTranslations => {
  if (sourceTexts.length === 0) return translations;
  const allowed = new Set(sourceTexts);
  return Object.fromEntries(
    Object.entries(translations).filter(([sourceText]) => allowed.has(sourceText))
  );
};

const missingFrom = (
  base: ModelTranslations,
  next: ModelTranslations
): ModelTranslations =>
  Object.fromEntries(Object.entries(next).filter(([sourceText]) => !base[sourceText]));

const changedFrom = (
  base: ModelTranslations,
  next: ModelTranslations
): ModelTranslations =>
  Object.fromEntries(
    Object.entries(next).filter(([sourceText, translation]) => base[sourceText] !== translation)
  );
