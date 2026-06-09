import { database } from './database';

interface ChatHistoryRow {
  messages_json: string;
}

export interface AgentChatHistory {
  messages: unknown[];
  patches: Record<string, unknown>;
  patchStates: Record<string, unknown>;
}

database.exec(`
  CREATE TABLE IF NOT EXISTS agent_chat_history (
    chat_id TEXT PRIMARY KEY,
    messages_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const selectHistory = database.prepare(`
  SELECT messages_json
  FROM agent_chat_history
  WHERE chat_id = ?
`);

const upsertHistory = database.prepare(`
  INSERT INTO agent_chat_history (chat_id, messages_json, updated_at)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(chat_id) DO UPDATE SET
    messages_json = excluded.messages_json,
    updated_at = CURRENT_TIMESTAMP
`);

const deleteHistory = database.prepare(`
  DELETE FROM agent_chat_history
  WHERE chat_id = ?
`);

export const readAgentChatHistory = (chatId: string): AgentChatHistory => {
  const row = selectHistory.get(chatId) as ChatHistoryRow | undefined;
  if (!row) return emptyHistory();

  try {
    const value = JSON.parse(row.messages_json);
    if (Array.isArray(value)) {
      return { ...emptyHistory(), messages: value };
    }
    if (!value || typeof value !== 'object') return emptyHistory();
    const record = value as Record<string, unknown>;
    return {
      messages: Array.isArray(record.messages) ? record.messages : [],
      patches: isRecord(record.patches) ? record.patches : {},
      patchStates: isRecord(record.patchStates) ? record.patchStates : {}
    };
  } catch {
    return emptyHistory();
  }
};

export const writeAgentChatHistory = (chatId: string, history: AgentChatHistory): void => {
  upsertHistory.run(chatId, JSON.stringify(history));
};

export const removeAgentChatHistory = (chatId: string): void => {
  deleteHistory.run(chatId);
};

const emptyHistory = (): AgentChatHistory => ({
  messages: [],
  patches: {},
  patchStates: {}
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};
