import type { UIMessage } from '@tanstack/ai-client';
import type { AgentUsage } from './agentUsage';

const defaultAgentChatId = 'event-modeling-assistant';
const defaultAgentChatThreadId = 'event-modeling-assistant-thread';
const defaultStorageKey = 'event-modeling-toolkit:agent-chat:v1';
const defaultUsageStorageKey = 'event-modeling-toolkit:agent-chat-usage:v1';
const maxPersistedMessages = 100;
const persistDelayMs = 250;

const persistTimers = new Map<string, number>();
const pendingMessagesByChatId = new Map<string, UIMessage[]>();
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

export const loadAgentChatUsage = (chatId: string): Record<string, AgentUsage> => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(usageStorageKey(chatId));
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, AgentUsage] => isAgentUsage(entry[1]))
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

export const loadAgentChatMessagesFromServer = async (chatId: string): Promise<UIMessage[]> => {
  try {
    const response = await fetch(historyUrl(chatId), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return [];
    const body = await response.json() as { messages?: unknown };
    if (!Array.isArray(body.messages)) return [];
    return body.messages.map(reviveMessage).filter((message): message is UIMessage => Boolean(message));
  } catch {
    return [];
  }
};

export const persistAgentChatMessages = (chatId: string, messages: UIMessage[]): void => {
  if (typeof window === 'undefined') return;
  pendingMessagesByChatId.set(chatId, messages.slice(-maxPersistedMessages));

  const currentTimer = persistTimers.get(chatId);
  if (currentTimer) window.clearTimeout(currentTimer);
  persistTimers.set(
    chatId,
    window.setTimeout(() => flushPendingMessages(chatId), persistDelayMs)
  );
};

export const clearPersistedAgentChat = (chatId: string): void => {
  if (typeof window === 'undefined') return;
  const timer = persistTimers.get(chatId);
  if (timer) window.clearTimeout(timer);
  persistTimers.delete(chatId);
  pendingMessagesByChatId.delete(chatId);
  serverPersistControllers.get(chatId)?.abort();
  serverPersistControllers.delete(chatId);
  window.localStorage.removeItem(storageKey(chatId));
  window.localStorage.removeItem(usageStorageKey(chatId));
  void fetch(historyUrl(chatId), { method: 'DELETE' }).catch(() => undefined);
};

const flushPendingMessages = (chatId: string): void => {
  persistTimers.delete(chatId);
  if (typeof window === 'undefined') return;
  const messages = pendingMessagesByChatId.get(chatId);
  if (!messages) return;

  try {
    window.localStorage.setItem(storageKey(chatId), JSON.stringify(messages));
  } catch {
    // Persistence is best-effort; storage limits must not break chat.
  } finally {
    pendingMessagesByChatId.delete(chatId);
  }

  void persistMessagesToServer(chatId, messages);
};

const persistMessagesToServer = async (chatId: string, messages: UIMessage[]): Promise<void> => {
  serverPersistControllers.get(chatId)?.abort();
  const controller = new AbortController();
  serverPersistControllers.set(chatId, controller);

  try {
    await fetch(historyUrl(chatId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
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

const historyUrl = (chatId: string): string => {
  return `/api/agent/history?chatId=${encodeURIComponent(chatId)}`;
};

const storageKey = (chatId: string): string => {
  return chatId === defaultAgentChatId
    ? defaultStorageKey
    : `${defaultStorageKey}:${chatId}`;
};

const usageStorageKey = (chatId: string): string => {
  return chatId === defaultAgentChatId
    ? defaultUsageStorageKey
    : `${defaultUsageStorageKey}:${chatId}`;
};

const reviveMessage = (value: unknown): UIMessage | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string'
    || (record.role !== 'system' && record.role !== 'user' && record.role !== 'assistant')
    || !Array.isArray(record.parts)
  ) {
    return undefined;
  }

  return {
    id: record.id,
    role: record.role,
    parts: record.parts as UIMessage['parts'],
    ...(typeof record.createdAt === 'string' || typeof record.createdAt === 'number'
      ? { createdAt: new Date(record.createdAt) }
      : {})
  };
};

const isAgentUsage = (value: unknown): value is AgentUsage => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.provider === 'string'
    && typeof record.model === 'string'
    && typeof record.requestCount === 'number';
};
