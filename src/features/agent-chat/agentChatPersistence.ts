import type { UIMessage } from '@tanstack/ai-client';
import type { AgentDslPatch } from './agentTypes';
import type { AgentUsage } from './agentUsage';

const defaultAgentChatId = 'event-modeling-assistant';
const defaultAgentChatThreadId = 'event-modeling-assistant-thread';
const defaultStorageKey = 'event-modeling-toolkit:agent-chat:v1';
const defaultUsageStorageKey = 'event-modeling-toolkit:agent-chat-usage:v1';
const defaultPatchStorageKey = 'event-modeling-toolkit:agent-chat-patches:v1';
const maxPersistedMessages = 100;
const persistDelayMs = 250;

export interface PersistedAgentChatState {
  messages: UIMessage[];
  patches: Record<string, AgentDslPatch>;
  patchStates: Record<string, 'applied' | 'dismissed'>;
}

const persistTimers = new Map<string, number>();
const pendingStateByChatId = new Map<string, PersistedAgentChatState>();
const serverPersistControllers = new Map<string, AbortController>();

export const getAgentChatId = (workspaceId: string): string => {
  return workspaceId === 'default'
    ? defaultAgentChatId
    : `${defaultAgentChatId}:${workspaceId}`;
};

export const getAgentChatThreadId = (workspaceId: string): string => {
  return workspaceId === 'default'
    ? defaultAgentChatThreadId
    : `${defaultAgentChatThreadId}:${workspaceId}`;
};

export const loadAgentChatMessages = (chatId: string): UIMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(storageKey(chatId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveMessage).filter((message): message is UIMessage => Boolean(message));
  } catch {
    return [];
  }
};

export const loadAgentChatPatchState = (
  chatId: string
): Pick<PersistedAgentChatState, 'patches' | 'patchStates'> => {
  if (typeof window === 'undefined') return { patches: {}, patchStates: {} };
  try {
    const stored = window.localStorage.getItem(patchStorageKey(chatId));
    return stored ? parsePatchState(JSON.parse(stored)) : { patches: {}, patchStates: {} };
  } catch {
    return { patches: {}, patchStates: {} };
  }
};

export const loadAgentChatUsage = (chatId: string): Record<string, AgentUsage> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(usageStorageKey(chatId));
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AgentUsage] => isAgentUsage(entry[1]))
    );
  } catch {
    return {};
  }
};

export const persistAgentChatUsage = (
  chatId: string,
  usageByMessageId: Record<string, AgentUsage>
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(usageStorageKey(chatId), JSON.stringify(usageByMessageId));
  } catch {
    // Usage display metadata must not break chat.
  }
};

export const loadAgentChatStateFromServer = async (chatId: string): Promise<PersistedAgentChatState> => {
  try {
    const response = await fetch(historyUrl(chatId), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return emptyPersistedState();
    const body = await response.json() as Record<string, unknown>;
    return {
      messages: Array.isArray(body.messages)
        ? body.messages.map(reviveMessage).filter((message): message is UIMessage => Boolean(message))
        : [],
      ...parsePatchState(body)
    };
  } catch {
    return emptyPersistedState();
  }
};

export const persistAgentChatState = (chatId: string, state: PersistedAgentChatState): void => {
  if (typeof window === 'undefined') return;
  pendingStateByChatId.set(chatId, {
    ...state,
    messages: state.messages.slice(-maxPersistedMessages)
  });

  const currentTimer = persistTimers.get(chatId);
  if (currentTimer) window.clearTimeout(currentTimer);
  persistTimers.set(chatId, window.setTimeout(() => flushPendingState(chatId), persistDelayMs));
};

export const clearPersistedAgentChat = (chatId: string): void => {
  if (typeof window === 'undefined') return;
  const timer = persistTimers.get(chatId);
  if (timer) window.clearTimeout(timer);
  persistTimers.delete(chatId);
  pendingStateByChatId.delete(chatId);
  serverPersistControllers.get(chatId)?.abort();
  serverPersistControllers.delete(chatId);
  window.localStorage.removeItem(storageKey(chatId));
  window.localStorage.removeItem(usageStorageKey(chatId));
  window.localStorage.removeItem(patchStorageKey(chatId));
  void fetch(historyUrl(chatId), { method: 'DELETE' }).catch(() => undefined);
};

const flushPendingState = (chatId: string): void => {
  persistTimers.delete(chatId);
  if (typeof window === 'undefined') return;
  const state = pendingStateByChatId.get(chatId);
  if (!state) return;

  try {
    window.localStorage.setItem(storageKey(chatId), JSON.stringify(state.messages));
    window.localStorage.setItem(patchStorageKey(chatId), JSON.stringify({
      patches: state.patches,
      patchStates: state.patchStates
    }));
  } catch {
    // Persistence is best-effort; storage limits must not break chat.
  } finally {
    pendingStateByChatId.delete(chatId);
  }

  void persistStateToServer(chatId, state);
};

const persistStateToServer = async (chatId: string, state: PersistedAgentChatState): Promise<void> => {
  serverPersistControllers.get(chatId)?.abort();
  const controller = new AbortController();
  serverPersistControllers.set(chatId, controller);

  try {
    await fetch(historyUrl(chatId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      signal: controller.signal
    });
  } catch {
    // localStorage remains the offline fallback.
  } finally {
    if (serverPersistControllers.get(chatId) === controller) {
      serverPersistControllers.delete(chatId);
    }
  }
};

const historyUrl = (chatId: string): string => `/api/agent/history?chatId=${encodeURIComponent(chatId)}`;

const storageKey = (chatId: string): string => (
  chatId === defaultAgentChatId ? defaultStorageKey : `${defaultStorageKey}:${chatId}`
);

const usageStorageKey = (chatId: string): string => (
  chatId === defaultAgentChatId ? defaultUsageStorageKey : `${defaultUsageStorageKey}:${chatId}`
);

const patchStorageKey = (chatId: string): string => (
  chatId === defaultAgentChatId ? defaultPatchStorageKey : `${defaultPatchStorageKey}:${chatId}`
);

const reviveMessage = (value: unknown): UIMessage | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.id !== 'string'
    || (value.role !== 'system' && value.role !== 'user' && value.role !== 'assistant')
    || !Array.isArray(value.parts)
  ) {
    return undefined;
  }

  return {
    id: value.id,
    role: value.role,
    parts: value.parts as UIMessage['parts'],
    ...(typeof value.createdAt === 'string' || typeof value.createdAt === 'number'
      ? { createdAt: new Date(value.createdAt) }
      : {})
  };
};

const parsePatchState = (
  value: unknown
): Pick<PersistedAgentChatState, 'patches' | 'patchStates'> => {
  if (!isRecord(value)) return { patches: {}, patchStates: {} };
  return {
    patches: isRecord(value.patches)
      ? Object.fromEntries(
          Object.entries(value.patches).filter((entry): entry is [string, AgentDslPatch] => isAgentDslPatch(entry[1]))
        )
      : {},
    patchStates: isRecord(value.patchStates)
      ? Object.fromEntries(
          Object.entries(value.patchStates).filter(
            (entry): entry is [string, 'applied' | 'dismissed'] => entry[1] === 'applied' || entry[1] === 'dismissed'
          )
        )
      : {}
  };
};

const isAgentDslPatch = (value: unknown): value is AgentDslPatch => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.summary === 'string'
    && typeof value.nextDsl === 'string'
    && Array.isArray(value.operations);
};

const isAgentUsage = (value: unknown): value is AgentUsage => {
  if (!isRecord(value)) return false;
  return typeof value.provider === 'string'
    && typeof value.model === 'string'
    && typeof value.requestCount === 'number';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const emptyPersistedState = (): PersistedAgentChatState => ({
  messages: [],
  patches: {},
  patchStates: {}
});
