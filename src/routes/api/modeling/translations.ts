import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import {
  buildModelTranslationCatalog,
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
        const existing = readModelTranslations({ workspaceId, sourceHash, locale });
        const missing = body.regenerate
          ? catalog.sourceTexts
          : catalog.sourceTexts.filter((sourceText) => !existing[sourceText]);

        let generated: ModelTranslations = {};
        let warning: string | undefined;
        let usage: unknown;
        if (missing.length > 0) {
          const result = await requestModelTranslations({ sourceTexts: missing, locale });
          warning = result.warning;
          usage = result.usage;
          if (result.translations && Object.keys(result.translations).length > 0) {
            generated = result.translations;
            upsertModelTranslations({
              workspaceId,
              sourceHash,
              locale,
              translations: result.translations,
              provider: result.provider,
              model: result.model
            });
          }
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
          translations,
          codegen: toCodegenTranslations(locale, translations),
          ...(usage ? { usage } : {}),
          ...(warning ? { warning } : {})
        });
      }
    }
  }
});
