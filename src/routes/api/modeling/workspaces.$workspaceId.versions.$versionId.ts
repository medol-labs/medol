import { createFileRoute } from '@tanstack/react-router';
import {
  readModelingWorkspaceVersion,
  restoreModelingWorkspaceVersion
} from '../../../server/modelingWorkspaceRepository';

export const Route = createFileRoute('/api/modeling/workspaces/$workspaceId/versions/$versionId')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const version = readModelingWorkspaceVersion(params.workspaceId, params.versionId);
        return version
          ? Response.json({ version })
          : Response.json({ error: 'workspace version not found' }, { status: 404 });
      },
      POST: async ({ request, params }) => {
        const body = await request.json().catch(() => ({})) as { action?: unknown };
        if (body.action !== 'restore') {
          return Response.json({ error: 'unsupported version action' }, { status: 400 });
        }

        const workspace = restoreModelingWorkspaceVersion(params.workspaceId, params.versionId);
        return workspace
          ? Response.json({ workspace })
          : Response.json({ error: 'workspace version not found' }, { status: 404 });
      }
    }
  }
});
