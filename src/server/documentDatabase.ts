import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const databasePath = process.env.MEDOL_DOCUMENT_DB_PATH
  ? path.resolve(process.env.MEDOL_DOCUMENT_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'medol-documents.sqlite');

mkdirSync(path.dirname(databasePath), { recursive: true });

export const documentDatabase = new Database(databasePath);
documentDatabase.pragma('journal_mode = WAL');
