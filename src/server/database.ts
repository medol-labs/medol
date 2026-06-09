import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const currentDefaultPath = path.resolve(process.cwd(), 'data', 'medol.sqlite');
const eventModelingDefaultPath = path.resolve(process.cwd(), 'data', 'event-modeling.sqlite');
const agentChatDefaultPath = path.resolve(process.cwd(), 'data', 'agent-chat.sqlite');
const databasePath = process.env.MEDOL_DB_PATH
  ? path.resolve(process.env.MEDOL_DB_PATH)
  : process.env.EVENT_MODELING_DB_PATH
    ? path.resolve(process.env.EVENT_MODELING_DB_PATH)
  : process.env.AGENT_CHAT_DB_PATH
    ? path.resolve(process.env.AGENT_CHAT_DB_PATH)
    : existsSync(currentDefaultPath)
      ? currentDefaultPath
      : existsSync(eventModelingDefaultPath)
        ? eventModelingDefaultPath
        : existsSync(agentChatDefaultPath)
          ? agentChatDefaultPath
          : currentDefaultPath;

mkdirSync(path.dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
