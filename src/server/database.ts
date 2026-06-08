import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const currentDefaultPath = path.resolve(process.cwd(), 'data', 'event-modeling.sqlite');
const legacyDefaultPath = path.resolve(process.cwd(), 'data', 'agent-chat.sqlite');
const databasePath = process.env.EVENT_MODELING_DB_PATH
  ? path.resolve(process.env.EVENT_MODELING_DB_PATH)
  : process.env.AGENT_CHAT_DB_PATH
    ? path.resolve(process.env.AGENT_CHAT_DB_PATH)
    : existsSync(currentDefaultPath) || !existsSync(legacyDefaultPath)
      ? currentDefaultPath
      : legacyDefaultPath;

mkdirSync(path.dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
