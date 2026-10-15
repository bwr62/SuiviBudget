import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: (_db) => {
      // Le schéma de base est initialisé via DDL_SCHEMA
    },
  },
  {
    version: 2,
    name: '002_add_template_id_index',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_template_id 
        ON transactions(template_id);
      `);
    },
  },
  {
    version: 3,
    name: '003_add_refresh_tokens',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      `);
    },
  },
  {
    version: 4,
    name: '004_add_user_id_multi_profile',
    up: (db) => {
      // Vérification et ajout de la colonne user_id pour multi-profils (E4)
      const checkAndAddColumn = (table: string, column: string, def: string) => {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        if (!columns.some((col) => col.name === column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
        }
      };

      checkAndAddColumn('transactions', 'user_id', "TEXT DEFAULT 'default_user'");
      checkAndAddColumn('recurring_templates', 'user_id', "TEXT DEFAULT 'default_user'");
      checkAndAddColumn('categories', 'user_id', "TEXT DEFAULT 'default_user'");
      checkAndAddColumn('monthly_balances', 'user_id', "TEXT DEFAULT 'default_user'");

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_id ON recurring_templates(user_id);
      `);
    },
  },
  {
    version: 5,
    name: '005_cent_precision_and_closed_check',
    up: (db) => {
      // S'assurer que monthly_balances a bien la colonne is_closed
      const mbCols = db.prepare("PRAGMA table_info(monthly_balances)").all() as Array<{ name: string }>;
      if (!mbCols.some((col) => col.name === 'is_closed')) {
        db.exec("ALTER TABLE monthly_balances ADD COLUMN is_closed INTEGER DEFAULT 0;");
      }
    },
  },
  {
    version: 6,
    name: '006_category_budget_limits',
    up: (db) => {
      const catCols = db.prepare("PRAGMA table_info(categories)").all() as Array<{ name: string }>;
      if (!catCols.some((col) => col.name === 'budget_limit')) {
        db.exec("ALTER TABLE categories ADD COLUMN budget_limit REAL DEFAULT NULL;");
      }
    },
  },
  {
    version: 7,
    name: '007_savings_goals_and_allocations',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS savings_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT DEFAULT 'default_user',
          title TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL NOT NULL DEFAULT 0.0,
          target_date TEXT,
          icon TEXT DEFAULT 'PiggyBank',
          color TEXT DEFAULT '#10B981',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS savings_allocations (
          id TEXT PRIMARY KEY,
          goal_id TEXT NOT NULL,
          month_year TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
        CREATE INDEX IF NOT EXISTS idx_savings_alloc_goal ON savings_allocations(goal_id);
        CREATE INDEX IF NOT EXISTS idx_savings_alloc_month ON savings_allocations(month_year);
      `);
    },
  },
  {
    version: 8,
    name: '008_savings_interest_rate',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info(savings_goals)").all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'interest_rate')) {
        db.exec("ALTER TABLE savings_goals ADD COLUMN interest_rate REAL DEFAULT NULL;");
      }
    },
  },
  {
    version: 9,
    name: '009_savings_timing_and_mode',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info(savings_goals)").all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'deposit_timing')) {
        db.exec("ALTER TABLE savings_goals ADD COLUMN deposit_timing TEXT DEFAULT 'START_OF_MONTH';");
      }
      if (!cols.some((c) => c.name === 'interest_mode')) {
        db.exec("ALTER TABLE savings_goals ADD COLUMN interest_mode TEXT DEFAULT 'BONUS';");
      }
    },
  },
];

/**
 * Exécute toutes les migrations en attente de façon atomique et idempotente.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_versions ORDER BY version ASC').all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migration] Application de la migration v${migration.version}: ${migration.name}...`);
      const migrateTx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_versions (version, name) VALUES (?, ?)').run(migration.version, migration.name);
      });
      migrateTx();
      console.log(`[Migration] Migration v${migration.version} appliquée avec succès.`);
    }
  }
}
