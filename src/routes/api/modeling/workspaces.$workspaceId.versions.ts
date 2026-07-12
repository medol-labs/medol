import { createFileRoute } from '@tanstack/react-router';
import {
  createModelingWorkspaceVersion,
  listModelingWorkspaceVersions,
  readModelingWorkspace
} from '../../../server/modelingWorkspaceRepository';
import { validateWorkspaceVersionInput } from '../../../server/modelingWorkspaceVersionValidation';

export const Route = createFileRoute('/api/modeling/workspaces/$workspaceId/versions')({
  server: {
    handlers: {
      GET: ({ params }) => {
        if (!readModelingWorkspace(params.workspaceId)) {
          return Response.json({ error: 'workspace not found' }, { status: 404 });
        }

        return Response.json({
          versions: listModelingWorkspaceVersions(params.workspaceId)
        });
      },
      POST: async ({ request, params }) => {
        const body = await request.json() as {
          message?: unknown;
          dsl?: unknown;
          author?: unknown;
          releaseChannel?: unknown;
          releaseLabel?: unknown;
          releaseNotes?: unknown;
        };
        const validation = validateWorkspaceVersionInput(body);
        if (validation.error) {
          return Response.json({ error: validation.error }, { status: 400 });
        }

        const result = createModelingWorkspaceVersion(params.workspaceId, validation);
        return result
          ? Response.json(result, { status: 201 })
          : Response.json({ error: 'workspace not found' }, { status: 404 });
      }
    }
  }
});
