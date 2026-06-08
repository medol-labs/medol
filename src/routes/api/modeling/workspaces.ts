import { createFileRoute } from '@tanstack/react-router';
import {
  createModelingWorkspace,
  listModelingWorkspaces
} from '../../../server/modelingWorkspaceRepository';
import { validateWorkspaceInput } from '../../../server/modelingWorkspaceValidation';

export const Route = createFileRoute('/api/modeling/workspaces')({
  server: {
    handlers: {
      GET: () => Response.json({
        workspaces: listModelingWorkspaces()
      }),
      POST: async ({ request }) => {
        const body = await request.json() as { name?: unknown; dsl?: unknown };
        const validation = validateWorkspaceInput(body, true);
        if (validation.error) {
          return Response.json({ error: validation.error }, { status: 400 });
        }

        return Response.json({
          workspace: createModelingWorkspace({
            name: validation.name as string,
            ...(validation.dsl !== undefined ? { dsl: validation.dsl } : {})
          })
        }, { status: 201 });
      }
    }
  }
});
