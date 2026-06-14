import { createFileRoute } from '@tanstack/react-router';
import {
  readModelingDocument,
  removeModelingDocument,
  updateModelingDocument
} from '../../../server/modelingDocumentRepository';
import { validateUpdateDocumentInput } from '../../../server/modelingDocumentValidation';

export const Route = createFileRoute('/api/modeling/document-records/$documentId')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const document = readModelingDocument(params.documentId);
        return document
          ? Response.json({ document })
          : Response.json({ error: 'document not found' }, { status: 404 });
      },
      PUT: async ({ request, params }) => {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateUpdateDocumentInput(body);
        if (!validation.value) {
          return Response.json({ error: validation.error }, { status: 400 });
        }
        const document = updateModelingDocument(params.documentId, validation.value);
        return document
          ? Response.json({ document })
          : Response.json({ error: 'document not found' }, { status: 404 });
      },
      DELETE: ({ params }) => {
        return removeModelingDocument(params.documentId)
          ? new Response(null, { status: 204 })
          : Response.json({ error: 'document not found' }, { status: 404 });
      }
    }
  }
});
