import { createFileRoute } from '@tanstack/react-router';
import {
  readModelingWorkspace,
  removeModelingWorkspace,
  updateModelingWorkspace
} from '../../../server/modelingWorkspaceRepository';
import { validateWorkspaceInput } from '../../../server/modelingWorkspaceValidation';

export const Route = createFileRoute('/api/modeling/workspaces/$workspaceId')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const workspace = readModelingWorkspace(params.workspaceId);
        return workspace
          ? Response.json({ workspace })
          : Response.json({ error: 'workspace not found' }, { status: 404 });
      },
      PUT: async ({ request, params }) => {
        const body = await request.json() as { name?: unknown; dsl?: unknown };
        const validation = validateWorkspaceInput(body, false);
        if (validation.error) {
          return Response.json({ error: validation.error }, { status: 400 });
        }
        if (validation.name === undefined && validation.dsl === undefined) {
          return Response.json({ error: 'name or dsl is required' }, { status: 400 });
        }

        const workspace = updateModelingWorkspace(params.workspaceId, validation);
        return workspace
          ? Response.json({ workspace })
          : Response.json({ error: 'workspace not found' }, { status: 404 });
      },
      DELETE: ({ params }) => {
        return removeModelingWorkspace(params.workspaceId)
          ? new Response(null, { status: 204 })
          : Response.json({ error: 'workspace not found' }, { status: 404 });
      }
    }
  }
});
