import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import {
  buildModelTranslationCatalogFromUnits,
  buildModelTranslationUnits,
  renderModelTranslationMarkdown,
  summarizeModelTranslationUnits,
  toCodegenTranslations,
  type ModelTranslations
} from '../../../features/model-i18n/modelTranslation';
import { requestModelTranslations } from '../../../features/model-i18n/modelTranslationProvider';
import { parseMedol } from '../../../lib/dslParser';
import {
  upsertModelTranslations
} from '../../../server/modelTranslationRepository';
import { readResolvedModelTranslations } from '../../../server/modelTranslationResolver';
import { readModelingWorkspace } from '../../../server/modelingWorkspaceRepository';

const maxDslLength = 2_000_000;
const defaultTranslationBatchSize = 25;
const defaultTranslationUnitLimit = 1000;
const glossaryEntryLimit = 120;

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

        const sourceTexts = readWorkspaceTranslationSourceTexts(workspaceId);
        const resolved = readResolvedModelTranslations(
          { workspaceId, sourceHash, locale },
          sourceTexts
        );
        const translations = resolved.translations;
        return Response.json({
          locale,
          sourceHash,
          translated: Object.keys(translations).length,
          reused: resolved.reused,
          document: resolved.document,
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
          unitId?: unknown;
          unitLimit?: unknown;
          includeMarkdown?: unknown;
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
        const units = buildModelTranslationUnits(model);
        const catalog = buildModelTranslationCatalogFromUnits(units);
        const resolvedExisting = readResolvedModelTranslations(
          { workspaceId, sourceHash, locale },
          catalog.sourceTexts,
          {
            includeReusable: !body.regenerate,
            includeDocuments: !body.regenerate
          }
        );
        const existing = resolvedExisting.translations;
        const reused = body.regenerate ? 0 : resolvedExisting.reused;
        const missingSourceTexts = body.regenerate
          ? catalog.sourceTexts
          : catalog.sourceTexts.filter((sourceText) => !existing[sourceText]);
        const missingSet = new Set(missingSourceTexts);
        const requestedUnitId = typeof body.unitId === 'string' && body.unitId.trim()
          ? body.unitId.trim()
          : undefined;
        const pendingUnits = units
          .map((unit) => ({
            ...unit,
            sourceTexts: unit.sourceTexts.filter((sourceText) => missingSet.has(sourceText))
          }))
          .filter((unit) => unit.sourceTexts.length > 0)
          .filter((unit) => !requestedUnitId || unit.id === requestedUnitId);
        const unitLimit = nonNegativeInteger(body.unitLimit) ?? defaultTranslationUnitLimit;
        const includeMarkdown = body.includeMarkdown !== false;
        const unitsToProcess = pendingUnits.slice(0, unitLimit);

        let generated: ModelTranslations = {};
        let warning: string | undefined;
        let failedUnit: string | undefined;
        let usage: unknown;
        const processedUnits: Array<{
          id: string;
          kind: string;
          name: string;
          translated: number;
          total: number;
        }> = [];
        if (unitsToProcess.length > 0) {
          translationLoop:
          for (const [unitIndex, unit] of unitsToProcess.entries()) {
            const batches = chunk(unit.sourceTexts, translationBatchSize());
            let unitTranslated = 0;
            for (const [batchIndex, batch] of batches.entries()) {
              const translationsForGlossary = {
                ...existing,
                ...generated
              };
              const result = await requestModelTranslations({
                sourceTexts: batch,
                locale,
                glossary: glossaryFromTranslations(translationsForGlossary),
                scope: {
                  kind: unit.kind,
                  name: unit.name,
                  ...(unit.contextName ? { contextName: unit.contextName } : {})
                }
              });
              usage = result.usage ?? usage;
              if (result.translations && Object.keys(result.translations).length > 0) {
                generated = {
                  ...generated,
                  ...result.translations
                };
                unitTranslated += Object.keys(result.translations).length;
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
                failedUnit = unit.name;
                console.warn('[model-i18n] Model translation completed with warning', {
                  locale,
                  requested: missingSourceTexts.length,
                  unit: unit.name,
                  unitIndex: unitIndex + 1,
                  units: unitsToProcess.length,
                  batch: batchIndex + 1,
                  batches: batches.length,
                  batchSize: batch.length,
                  generated: Object.keys(generated).length,
                  warning
                });
                break translationLoop;
              }
            }
            processedUnits.push({
              id: unit.id,
              kind: unit.kind,
              name: unit.name,
              translated: unitTranslated,
              total: unit.sourceTexts.length
            });
            console.info('[model-i18n] Model translation group completed', {
              locale,
              unit: unit.name,
              unitIndex: unitIndex + 1,
              units: unitsToProcess.length,
              translated: unitTranslated,
              generated: Object.keys(generated).length
            });
          }
        }

        if (!warning && unitsToProcess.length > 0) {
          console.info('[model-i18n] Model translation completed', {
            locale,
            requested: missingSourceTexts.length,
            units: unitsToProcess.length,
            generated: Object.keys(generated).length,
            reused
          });
        }

        const translations = {
          ...existing,
          ...generated
        };
        const pendingUnitSummaries = summarizeModelTranslationUnits(units, translations);
        const markdown = includeMarkdown
          ? renderModelTranslationMarkdown({
              model,
              locale,
              sourceHash,
              translations
            })
          : undefined;

        return Response.json({
          locale,
          sourceHash,
          total: catalog.sourceTexts.length,
          translated: Object.keys(translations).length,
          reused,
          document: resolvedExisting.document,
          missing: catalog.sourceTexts.filter((sourceText) => !translations[sourceText]),
          pendingGroups: pendingUnitSummaries,
          pendingUnits: pendingUnitSummaries,
          processedUnits,
          translations,
          codegen: toCodegenTranslations(locale, translations),
          title: locale === 'zh-CN' ? '模型国际化术语表' : 'Model Translation Glossary',
          ...(markdown ? { markdown } : {}),
          ...(usage ? { usage } : {}),
          ...(failedUnit ? { failedGroup: failedUnit, failedUnit } : {}),
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

const readWorkspaceTranslationSourceTexts = (workspaceId: string | undefined): string[] => {
  if (!workspaceId) return [];
  const workspace = readModelingWorkspace(workspaceId);
  if (!workspace?.dsl) return [];
  const model = parseMedol(workspace.dsl);
  if (model.diagnostics.length > 0) return [];
  return buildModelTranslationCatalogFromUnits(buildModelTranslationUnits(model)).sourceTexts;
};

function nonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function glossaryFromTranslations(translations: ModelTranslations): ModelTranslations {
  return Object.fromEntries(
    Object.entries(translations)
      .filter(([, value]) => value.trim().length > 0)
      .slice(-glossaryEntryLimit)
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
