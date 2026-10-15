import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DDL_SCHEMA } from './schema.js';
import { runMigrations } from './migrator.js';

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

  // Exécution du gestionnaire de migrations versionnées (C1)
  runMigrations(db);

  // Initialisation du singleton household_profile s'il n'existe pas
  const profile = db.prepare("SELECT id FROM household_profile WHERE id = 1").get();
  if (!profile) {
    db.prepare(`
      INSERT INTO household_profile (id, has_completed_onboarding, adults_count, children_count, pets_count, housing_status, payday_default)
      VALUES (1, 0, 1, 0, 0, 'TENANT', 1)
    `).run();
  }
}

// Initialisation automatique à l'import
initDatabase();

export default db;
