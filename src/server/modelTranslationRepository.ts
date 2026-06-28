import type { ModelTranslations } from '../features/model-i18n/modelTranslation';
import { database } from './database';

interface TranslationRow {
  source_text: string;
  translated_text: string;
}

export interface TranslationScope {
  workspaceId?: string;
  sourceHash: string;
  locale: string;
}

export interface UpsertModelTranslationsInput extends TranslationScope {
  translations: ModelTranslations;
  provider?: string;
  model?: string;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS model_translations (
    workspace_id TEXT NOT NULL DEFAULT '',
    source_hash TEXT NOT NULL,
    locale TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, source_hash, locale, source_text)
  );

  CREATE INDEX IF NOT EXISTS model_translations_source_locale
  ON model_translations(source_hash, locale);
`);

const selectTranslations = database.prepare(`
  SELECT source_text, translated_text
  FROM model_translations
  WHERE workspace_id = ? AND source_hash = ? AND locale = ?
  ORDER BY source_text ASC
`);

const upsertTranslation = database.prepare(`
  INSERT INTO model_translations (
    workspace_id, source_hash, locale, source_text, translated_text, provider, model, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(workspace_id, source_hash, locale, source_text)
  DO UPDATE SET
    translated_text = excluded.translated_text,
    provider = excluded.provider,
    model = excluded.model,
    updated_at = CURRENT_TIMESTAMP
`);

export const readModelTranslations = (scope: TranslationScope): ModelTranslations => {
  const rows = selectTranslations.all(
    normalizeWorkspaceId(scope.workspaceId),
    scope.sourceHash,
    scope.locale
  ) as TranslationRow[];
  return Object.fromEntries(rows.map((row) => [row.source_text, row.translated_text]));
};

export const upsertModelTranslations = (
  input: UpsertModelTranslationsInput
): void => {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const transaction = database.transaction(() => {
    Object.entries(input.translations)
      .filter(([, value]) => value.trim().length > 0)
      .forEach(([sourceText, translatedText]) => {
        upsertTranslation.run(
          workspaceId,
          input.sourceHash,
          input.locale,
          sourceText,
          translatedText,
          input.provider ?? null,
          input.model ?? null
        );
      });
  });
  transaction();
};

const normalizeWorkspaceId = (workspaceId: string | undefined): string =>
  workspaceId?.trim() ?? '';
