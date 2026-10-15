import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DDL_SCHEMA } from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'budget.sqlite');

export const db: Database.Database = new Database(DB_PATH);

// Configuration optimale SQLite pour applications réactives et fiables
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

/**
 * Initialise le schéma complet de la base de données SQLite.
 */
export function initDatabase(): void {
  db.exec(DDL_SCHEMA);
}

// Initialisation automatique à l'import
initDatabase();

export default db;
