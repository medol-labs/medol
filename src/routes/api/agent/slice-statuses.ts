import { createFileRoute } from '@tanstack/react-router';
import {
  isAgentSliceStatus,
  type UpdateAgentSliceStatusInput
} from '../../../contracts/agentSliceStatus';
import {
  listAgentSliceStatuses,
  updateAgentSliceStatus
} from '../../../server/agentSliceStatusRepository';

export const Route = createFileRoute('/api/agent/slice-statuses')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get('workspaceId')?.trim();
        const status = url.searchParams.get('status')?.trim();

        if (!workspaceId) {
          return Response.json({ error: 'workspaceId is required' }, { status: 400 });
        }
        if (status && !isAgentSliceStatus(status)) {
          return Response.json({ error: 'unsupported slice status' }, { status: 400 });
        }
        const agentStatus = isAgentSliceStatus(status) ? status : undefined;

        return Response.json({
          slices: listAgentSliceStatuses({
            workspaceId,
            ...(agentStatus ? { status: agentStatus } : {})
          })
        });
      },
      PATCH: async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateUpdateInput(body);
        if ('error' in validation) {
          return Response.json({ error: validation.error }, { status: 400 });
        }

        const slice = updateAgentSliceStatus(validation);
        return Response.json({ slice });
      }
    }
  }
});

const validateUpdateInput = (
  body: Record<string, unknown>
): UpdateAgentSliceStatusInput | { error: string } => {
  const workspaceId = text(body.workspaceId);
  const sliceId = text(body.sliceId);
  const contextName = text(body.contextName);
  const sliceName = text(body.sliceName);
  const aggregateName = text(body.aggregateName);
  const status = text(body.status);

  if (!workspaceId) return { error: 'workspaceId is required' };
  if (!sliceId) return { error: 'sliceId is required' };
  if (!contextName) return { error: 'contextName is required' };
  if (!sliceName) return { error: 'sliceName is required' };
  if (!isAgentSliceStatus(status)) return { error: 'unsupported slice status' };

  return {
    workspaceId,
    sliceId,
    contextName,
    sliceName,
    ...(aggregateName ? { aggregateName } : {}),
    status
  };
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
