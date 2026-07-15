import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import {
  buildModelTranslationCatalog,
  buildModelTranslationGroups,
  toCodegenTranslations,
  type ModelTranslations
} from '../../../features/model-i18n/modelTranslation';
import { requestModelTranslations } from '../../../features/model-i18n/modelTranslationProvider';
import { parseMedol } from '../../../lib/dslParser';
import { modelToCodegenModel } from '../../../lib/codegenModel';
import {
  readModelTranslations,
  upsertModelTranslations
} from '../../../server/modelTranslationRepository';

const maxDslLength = 2_000_000;
const defaultTranslationBatchSize = 25;

export const Route = createFileRoute('/api/modeling/translations')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const locale = url.searchParams.get('locale') ?? url.searchParams.get('language');
        const sourceHash = url.searchParams.get('sourceHash');
        const workspaceId = url.searchParams.get('workspaceId') ?? undefined;

        if (!locale) {
          return Response.json({ error: 'locale must be a string' }, { status: 400 });
        }
        if (!sourceHash) {
          return Response.json({ error: 'sourceHash must be a string' }, { status: 400 });
        }

        const translations = readModelTranslations({ workspaceId, sourceHash, locale });
        return Response.json({
          locale,
          sourceHash,
          translated: Object.keys(translations).length,
          translations,
          codegen: toCodegenTranslations(locale, translations)
        });
      },
      POST: async ({ request }) => {
        const body = await request.json() as {
          medol?: unknown;
          dsl?: unknown;
          workspaceId?: unknown;
          locale?: unknown;
          language?: unknown;
          regenerate?: unknown;
        };
        const medol = typeof body.medol === 'string' ? body.medol : body.dsl;
        if (typeof medol !== 'string') {
          return Response.json({ error: 'medol must be a string' }, { status: 400 });
        }
        if (medol.length > maxDslLength) {
          return Response.json({ error: 'medol is too large' }, { status: 413 });
        }

        const locale = typeof body.locale === 'string'
          ? body.locale
          : typeof body.language === 'string'
            ? body.language
            : undefined;
        if (!locale) {
          return Response.json({ error: 'locale must be a string' }, { status: 400 });
        }

        const model = parseMedol(medol);
        if (model.diagnostics.length > 0) {
          return Response.json({ error: 'MEDOL validation failed', diagnostics: model.diagnostics }, { status: 400 });
        }

        const sourceHash = hashMedolSource(medol);
        const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : undefined;
        const codegenModel = modelToCodegenModel(model);
        const catalog = buildModelTranslationCatalog(codegenModel);
        const groups = buildModelTranslationGroups(codegenModel);
        const existing = readModelTranslations({ workspaceId, sourceHash, locale });
        const missingSourceTexts = body.regenerate
          ? catalog.sourceTexts
          : catalog.sourceTexts.filter((sourceText) => !existing[sourceText]);
        const missingSet = new Set(missingSourceTexts);
        const pendingGroups = groups
          .map((group) => ({
            name: group.name,
            sourceTexts: group.sourceTexts.filter((sourceText) => missingSet.has(sourceText))
          }))
          .filter((group) => group.sourceTexts.length > 0);

        let generated: ModelTranslations = {};
        let warning: string | undefined;
        let failedGroup: string | undefined;
        let usage: unknown;
        if (pendingGroups.length > 0) {
          translationLoop:
          for (const [groupIndex, group] of pendingGroups.entries()) {
            const batches = chunk(group.sourceTexts, translationBatchSize());
            for (const [batchIndex, batch] of batches.entries()) {
              const result = await requestModelTranslations({ sourceTexts: batch, locale });
              usage = result.usage ?? usage;
              if (result.translations && Object.keys(result.translations).length > 0) {
                generated = {
                  ...generated,
                  ...result.translations
                };
                upsertModelTranslations({
                  workspaceId,
                  sourceHash,
                  locale,
                  translations: result.translations,
                  provider: result.provider,
                  model: result.model
                });
              }
              if (result.warning) {
                warning = result.warning;
                failedGroup = group.name;
                console.warn('[model-i18n] Model translation completed with warning', {
                  locale,
                  requested: missingSourceTexts.length,
                  group: group.name,
                  groupIndex: groupIndex + 1,
                  groups: pendingGroups.length,
                  batch: batchIndex + 1,
                  batches: batches.length,
                  batchSize: batch.length,
                  generated: Object.keys(generated).length,
                  warning
                });
                break translationLoop;
              }
            }
            console.info('[model-i18n] Model translation group completed', {
              locale,
              group: group.name,
              groupIndex: groupIndex + 1,
              groups: pendingGroups.length,
              translated: group.sourceTexts.length,
              generated: Object.keys(generated).length
            });
          }
        }

        if (!warning && pendingGroups.length > 0) {
          console.info('[model-i18n] Model translation completed', {
            locale,
            requested: missingSourceTexts.length,
            groups: pendingGroups.length,
            generated: Object.keys(generated).length
          });
        }

        const translations = {
          ...existing,
          ...generated
        };

        return Response.json({
          locale,
          sourceHash,
          total: catalog.sourceTexts.length,
          translated: Object.keys(translations).length,
          missing: catalog.sourceTexts.filter((sourceText) => !translations[sourceText]),
          pendingGroups: groups
            .map((group) => ({
              name: group.name,
              missing: group.sourceTexts.filter((sourceText) => !translations[sourceText]).length,
              total: group.sourceTexts.length
            }))
            .filter((group) => group.missing > 0),
          translations,
          codegen: toCodegenTranslations(locale, translations),
          ...(usage ? { usage } : {}),
          ...(failedGroup ? { failedGroup } : {}),
          ...(warning ? { warning } : {})
        });
      }
    }
  }
});

function translationBatchSize(): number {
  const raw = typeof process === 'undefined'
    ? undefined
    : process.env.MODEL_TRANSLATION_BATCH_SIZE;
  const value = raw ? Number.parseInt(raw, 10) : defaultTranslationBatchSize;
  return Number.isFinite(value) && value > 0 ? value : defaultTranslationBatchSize;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
