import { useEffect, useState } from 'react';
import {
  agentSliceStatusClient,
  toAgentSliceStatusMap,
  type AgentSliceStatusMap
} from '../features/agent-slices/agentSliceStatusClient';
import type { AgentSliceStatus } from '../contracts/agentSliceStatus';
import type { EmAggregate, EmContext, EmSlice } from '../lib/model';

export const useAgentSliceStatuses = (workspaceId: string | undefined) => {
  const [agentSliceStatuses, setAgentSliceStatuses] = useState<AgentSliceStatusMap>({});

  useEffect(() => {
    if (!workspaceId) {
      setAgentSliceStatuses({});
      return;
    }

    const controller = new AbortController();
    void agentSliceStatusClient.list({ workspaceId }, controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setAgentSliceStatuses(toAgentSliceStatusMap(records));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Failed to load agent slice statuses', error);
        setAgentSliceStatuses({});
      });

    return () => controller.abort();
  }, [workspaceId]);

  const updateSliceAgentStatus = (
    context: EmContext,
    aggregate: EmAggregate | undefined,
    slice: EmSlice,
    status: AgentSliceStatus
  ) => {
    if (!workspaceId) return;

    const previousStatus = agentSliceStatuses[slice.id] ?? 'unplanned';
    setAgentSliceStatuses((current) => {
      const next = { ...current };
      if (status === 'unplanned') {
        delete next[slice.id];
      } else {
        next[slice.id] = status;
      }
      return next;
    });

    void agentSliceStatusClient.update({
      workspaceId,
      sliceId: slice.id,
      contextName: context.name,
      ...(aggregate ? { aggregateName: aggregate.name } : {}),
      sliceName: slice.name,
      status
    }).catch((error: unknown) => {
      console.warn('Failed to update agent slice status', error);
      setAgentSliceStatuses((current) => {
        const next = { ...current };
        if (previousStatus === 'unplanned') {
          delete next[slice.id];
        } else {
          next[slice.id] = previousStatus;
        }
        return next;
      });
    });
  };

  return {
    agentSliceStatuses,
    updateSliceAgentStatus
  };
};
