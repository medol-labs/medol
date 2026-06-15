import { createFileRoute } from '@tanstack/react-router';
import {
  createModelingDocument,
  listModelingDocuments
} from '../../../server/modelingDocumentRepository';
import { validateCreateDocumentInput } from '../../../server/modelingDocumentValidation';

export const Route = createFileRoute('/api/modeling/document-records')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const workspaceId = new URL(request.url).searchParams.get('workspaceId')?.trim();
        if (!workspaceId) {
          return Response.json({ error: 'workspaceId is required' }, { status: 400 });
        }
        return Response.json({ documents: listModelingDocuments(workspaceId) });
      },
      POST: async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateCreateDocumentInput(body);
        if (!validation.value) {
          return Response.json({ error: validation.error }, { status: 400 });
        }
        const document = createModelingDocument(validation.value);
        return Response.json({
          document
        }, { status: document.mergeSummary?.created ? 201 : 200 });
      }
    }
  }
});
