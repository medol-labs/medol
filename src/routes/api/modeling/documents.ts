import { createFileRoute } from '@tanstack/react-router';
import { enhanceDocumentationWithAgent } from '../../../features/documentation/documentationAgent';
import {
  generateDocumentation,
  type DocumentationKind,
  type DocumentationLanguage
} from '../../../lib/generators/documentation';
import { parseEventModelingDsl } from '../../../lib/dslParser';

const documentKinds = new Set<DocumentationKind>([
  'prd',
  'software-design',
  'database-design',
  'process'
]);
const maxDslLength = 2_000_000;
const documentLanguages = new Set<DocumentationLanguage>(['en', 'zh-CN']);

export const Route = createFileRoute('/api/modeling/documents')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json() as {
          dsl?: unknown;
          kind?: unknown;
          language?: unknown;
          enhanceWithAi?: unknown;
        };
        if (typeof body.dsl !== 'string') {
          return Response.json({ error: 'dsl must be a string' }, { status: 400 });
        }
        if (body.dsl.length > maxDslLength) {
          return Response.json({ error: 'dsl is too large' }, { status: 413 });
        }
        if (!isDocumentationKind(body.kind)) {
          return Response.json({ error: 'unsupported document kind' }, { status: 400 });
        }
        if (body.language !== undefined && !isDocumentationLanguage(body.language)) {
          return Response.json({ error: 'unsupported document language' }, { status: 400 });
        }

        const language = body.language ?? 'en';
        const model = parseEventModelingDsl(body.dsl);
        const document = generateDocumentation(model, body.kind, {
          sourceText: body.dsl,
          language
        });
        if (!body.enhanceWithAi) {
          return Response.json({
            ...document,
            enhanced: false
          });
        }

        const enhanced = await enhanceDocumentationWithAgent({
          dsl: body.dsl,
          model,
          document
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
