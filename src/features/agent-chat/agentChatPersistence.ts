import type { UIMessage } from '@tanstack/ai-client';
import type { AgentUsage } from './agentUsage';

export const agentChatId = 'event-modeling-assistant';
export const agentChatThreadId = 'event-modeling-assistant-thread';

const storageKey = 'event-modeling-toolkit:agent-chat:v1';
const usageStorageKey = 'event-modeling-toolkit:agent-chat-usage:v1';
const maxPersistedMessages = 100;
const persistDelayMs = 250;

let persistTimer: number | undefined;
let pendingMessages: UIMessage[] | undefined;
let serverPersistController: AbortController | undefined;

export const loadAgentChatMessages = (): UIMessage[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveMessage).filter((message): message is UIMessage => Boolean(message));
  } catch {
    return [];
  }
};

export const loadAgentChatUsage = (): Record<string, AgentUsage> => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(usageStorageKey);
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

export const persistAgentChatUsage = (usageByMessageId: Record<string, AgentUsage>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(usageStorageKey, JSON.stringify(usageByMessageId));
  } catch {
    // Usage display metadata must not break chat.
  }
};

export const loadAgentChatMessagesFromServer = async (): Promise<UIMessage[]> => {
  try {
    const response = await fetch(historyUrl(), {
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

export const persistAgentChatMessages = (messages: UIMessage[]): void => {
  if (typeof window === 'undefined') return;
  pendingMessages = messages.slice(-maxPersistedMessages);

  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(flushPendingMessages, persistDelayMs);
};

export const clearPersistedAgentChat = (): void => {
  if (typeof window === 'undefined') return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = undefined;
  pendingMessages = undefined;
  serverPersistController?.abort();
  serverPersistController = undefined;
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(usageStorageKey);
  void fetch(historyUrl(), { method: 'DELETE' }).catch(() => undefined);
};

const flushPendingMessages = (): void => {
  persistTimer = undefined;
  if (typeof window === 'undefined' || !pendingMessages) return;
  const messages = pendingMessages;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch {
    // Persistence is best-effort; storage limits must not break chat.
  } finally {
    pendingMessages = undefined;
  }

  void persistMessagesToServer(messages);
};

const persistMessagesToServer = async (messages: UIMessage[]): Promise<void> => {
  serverPersistController?.abort();
  const controller = new AbortController();
  serverPersistController = controller;

  try {
    await fetch(historyUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal
    });
  } catch {
    // localStorage remains the offline fallback.
  } finally {
    if (serverPersistController === controller) {
      serverPersistController = undefined;
    }
  }
};

const historyUrl = (): string => {
  return `/api/agent/history?chatId=${encodeURIComponent(agentChatId)}`;
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
