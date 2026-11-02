import { createFileRoute } from '@tanstack/react-router';
import { archiveByteLimit, exportWorkspaceArchive, importWorkspaceArchive } from '../../../server/workspaceArchive';

export const Route = createFileRoute('/api/modeling/workspace-archive')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const reader = request.body?.getReader();
          if (!reader) return Response.json({ error: 'Archive body is required.' }, { status: 400 });
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > archiveByteLimit) {
              await reader.cancel();
              return Response.json({ error: 'Workspace archive exceeds 64 MiB.' }, { status: 413 });
            }
            chunks.push(value);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const workspaceId = new URL(request.url).searchParams.get('workspaceId');
          if (workspaceId) {
            if (typeof body.dsl !== 'string') return Response.json({ error: 'Model source is required.' }, { status: 400 });
            const archive = exportWorkspaceArchive(workspaceId, body.dsl);
            return archive ? Response.json(archive) : Response.json({ error: 'Workspace not found.' }, { status: 404 });
          }
          return Response.json({ workspace: importWorkspaceArchive(body) }, { status: 201 });
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CORRUPT') {
            return Response.json({
              error: 'The workspace database is damaged. Back up the database files and recover them before transferring this workspace.'
            }, { status: 500 });
          }
          if (error instanceof SyntaxError || (error instanceof Error && /archive/i.test(error.message))) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          console.error('[workspace-archive]', error);
          return Response.json({ error: 'Workspace transfer failed.' }, { status: 500 });
        }
      }
    }
  }
});
