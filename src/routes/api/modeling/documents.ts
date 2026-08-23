import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import { enhanceDocumentationWithAgent } from '../../../features/documentation/documentationAgent';
import {
  buildModelTranslationCatalogFromUnits,
  buildModelTranslationUnits,
  type ModelTranslations
} from '../../../features/model-i18n/modelTranslation';
import {
  generateDocumentation,
  type DocumentationKind,
  type DocumentationLanguage
} from '../../../lib/generators/documentation';
import { parseMedol } from '../../../lib/dslParser';
import type { EmModel } from '../../../lib/model';
import {
  readModelTranslations,
  readReusableModelTranslations,
  upsertModelTranslations
} from '../../../server/modelTranslationRepository';

const documentKinds = new Set<DocumentationKind>([
  'prd',
  'software-design',
  'database-design',
  'process',
  'test-outline',
  'installation-manual',
  'user-manual'
]);
const maxDslLength = 2_000_000;
const documentLanguages = new Set<DocumentationLanguage>(['en', 'zh-CN']);

export const Route = createFileRoute('/api/modeling/documents')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json() as {
          medol?: unknown;
          dsl?: unknown;
          kind?: unknown;
          language?: unknown;
          enhanceWithAi?: unknown;
          workspaceId?: unknown;
        };
        const medol = typeof body.medol === 'string' ? body.medol : body.dsl;
        if (typeof medol !== 'string') {
          return Response.json({ error: 'medol must be a string' }, { status: 400 });
        }
        if (medol.length > maxDslLength) {
          return Response.json({ error: 'medol is too large' }, { status: 413 });
        }
        if (!isDocumentationKind(body.kind)) {
          return Response.json({ error: 'unsupported document kind' }, { status: 400 });
        }
        if (body.language !== undefined && !isDocumentationLanguage(body.language)) {
          return Response.json({ error: 'unsupported document language' }, { status: 400 });
        }

        const language = body.language ?? 'en';
        const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : undefined;
        const model = parseMedol(medol);
        const sourceHash = hashMedolSource(medol);
        const document = generateDocumentation(model, body.kind, {
          sourceText: medol,
          language
        });
        if (!body.enhanceWithAi) {
          return Response.json({
            ...document,
            enhanced: false
          });
        }

        const enhanced = await enhanceDocumentationWithAgent({
          dsl: medol,
          model,
          document,
          modelTranslations: language === 'zh-CN'
            ? readCurrentModelTranslations({
                model,
                workspaceId,
                sourceHash,
                locale: language
              })
            : undefined
        });
        return Response.json({
          ...document,
          markdown: enhanced.markdown,
          enhanced: enhanced.enhanced,
          ...(enhanced.usage ? { usage: enhanced.usage } : {}),
          ...(enhanced.warning ? { warning: enhanced.warning } : {})
        });
      }
    }
  }
});

const isDocumentationKind = (value: unknown): value is DocumentationKind => {
  return typeof value === 'string' && documentKinds.has(value as DocumentationKind);
};

const isDocumentationLanguage = (value: unknown): value is DocumentationLanguage => {
  return typeof value === 'string' && documentLanguages.has(value as DocumentationLanguage);
};

const readCurrentModelTranslations = (input: {
  model: EmModel;
  workspaceId?: string;
  sourceHash: string;
  locale: DocumentationLanguage;
}): ModelTranslations => {
  const current = readModelTranslations(input);
  const catalog = buildModelTranslationCatalogFromUnits(
    buildModelTranslationUnits(input.model)
  );
  const reusable = readReusableModelTranslations(
    input,
    catalog.sourceTexts.filter((sourceText) => !current[sourceText])
  );
  if (Object.keys(reusable).length === 0) return current;

  upsertModelTranslations({
    workspaceId: input.workspaceId,
    sourceHash: input.sourceHash,
    locale: input.locale,
    translations: reusable,
    provider: 'local',
    model: 'historical-reuse'
  });
  return {
    ...current,
    ...reusable
  };
};
