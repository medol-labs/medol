import { createFileRoute } from '@tanstack/react-router';
import {
  DocumentExportError,
  exportMarkdownToWord,
  validateExportWordInput,
  wordMimeType
} from '../../../server/modelingDocumentExport';

export const Route = createFileRoute('/api/modeling/document-export')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateExportWordInput(body);
        if (!validation.value) {
          return Response.json({ error: validation.error }, { status: 400 });
        }

        try {
          const exported = await exportMarkdownToWord(validation.value);
          const body = new ArrayBuffer(exported.content.byteLength);
          new Uint8Array(body).set(exported.content);
          return new Response(body, {
            headers: {
              'Content-Type': wordMimeType,
              'Content-Disposition': contentDisposition(exported.filename),
              'Content-Length': String(exported.content.byteLength)
            }
          });
        } catch (error) {
          if (error instanceof DocumentExportError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ error: message }, { status: 500 });
        }
      }
    }
  }
});

const contentDisposition = (filename: string): string => {
  const fallback = filename.replace(/[^\w.-]+/g, '-');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};
