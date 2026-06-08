import { database } from './database';

interface ChatHistoryRow {
  messages_json: string;
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

export const readAgentChatHistory = (chatId: string): unknown[] => {
  const row = selectHistory.get(chatId) as ChatHistoryRow | undefined;
  if (!row) return [];

  try {
    const messages = JSON.parse(row.messages_json);
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
};

export const writeAgentChatHistory = (chatId: string, messages: unknown[]): void => {
  upsertHistory.run(chatId, JSON.stringify(messages));
};

export const removeAgentChatHistory = (chatId: string): void => {
  deleteHistory.run(chatId);
};
