export interface User {
  id: string;
  username: string;
  recovery_hash: string;
  created_at?: string;
}

export interface Passkey {
  credential_id: string;
  user_id: string;
  public_key: Buffer | Uint8Array;
  counter: number;
  transports: string | null; // JSON string array
  created_at?: string;
}

export type OperationType =
  | 'INCOME'
  | 'RECURRING_EXPENSE'
  | 'CURRENT_EXPENSE'
  | 'UNFORESEEN_EXPENSE';

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  revoked: number;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  type: OperationType;
  icon: string; // Nom de l'icône Lucide
  color: string; // Code Hex ou classe Tailwind
  is_system: number; // 1 = pré-créée, 0 = personnalisée
  is_active: number;
  user_id?: string;
  budget_limit?: number | null;
}

export type SavingsDepositTiming = 'START_OF_MONTH' | 'END_OF_MONTH';
export type SavingsInterestMode = 'BONUS' | 'DEDUCT';

export interface SavingsGoal {
  id: string;
  user_id?: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  interest_rate?: number | null; // Taux de rémunération annuel net (en %, ex: 3.0 pour 3%)
  deposit_timing?: SavingsDepositTiming; // 'START_OF_MONTH' (1ère quinzaine gagnée) ou 'END_OF_MONTH' (départ mois suivant)
  interest_mode?: SavingsInterestMode; // 'BONUS' (sécurité Livret A fin d'année) ou 'DEDUCT' (intérêts déduits de l'effort)
  icon?: string;
  color?: string;
  created_at?: string;
}

export interface SavingsAllocation {
  id: string;
  goal_id: string;
  month_year: string;
  amount: number;
  date: string;
  created_at?: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

export type HousingStatus = 'TENANT' | 'OWNER_WITH_LOAN' | 'OWNER_PAID_OFF' | 'FREE_HOUSING';

export interface HouseholdProfile {
  id: number; // 1
  has_completed_onboarding: number;
  adults_count: number;
  children_count: number;
  pets_count: number;
  housing_status: HousingStatus;
  payday_default: number;
  updated_at?: string;
}

export type RecurringTemplateStatus = 'ACTIVE' | 'PENDING_PAUSED';

export interface RecurringTemplate {
  id: string;
  user_id?: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
  category_id: string;
  subcategory_id?: string | null;
  day_of_month: number;
  status: RecurringTemplateStatus;
  carry_over: number; // 1 = se reporte sur les mois suivants, 0 = non
  end_month_year?: string | null; // Format 'YYYY-MM'
  created_at?: string;
}

export type TransactionStatus = 'ACTIVE' | 'PENDING';

export interface Transaction {
  id: string;
  user_id?: string;
  template_id?: string | null; // NULL si imprévue ou ponctuelle
  month_year: string; // Format 'YYYY-MM'
  date: string; // Format 'YYYY-MM-DD'
  title: string;
  amount: number;
  type: OperationType;
  category_id: string;
  subcategory_id?: string | null;
  status: TransactionStatus;
  is_carried_over: number; // 1 si reportée
  notes?: string | null;
  created_at?: string;
}

export interface MonthlyBalance {
  month_year: string; // 'YYYY-MM'
  carried_over_from_previous: number;
  is_closed: number;
  user_id?: string;
}

export const DDL_SCHEMA = `
-- 1. Utilisateurs & Sécurité
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  key TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  created_at INTEGER NOT NULL -- timestamp ms
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Profil du foyer et état d'onboarding (Singleton id=1)
CREATE TABLE IF NOT EXISTS household_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
  adults_count INTEGER NOT NULL DEFAULT 1,
  children_count INTEGER NOT NULL DEFAULT 0,
  pets_count INTEGER NOT NULL DEFAULT 0,
  housing_status TEXT CHECK(housing_status IN ('TENANT', 'OWNER_WITH_LOAN', 'OWNER_PAID_OFF', 'FREE_HOUSING')),
  payday_default INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Catégories et Sous-catégories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE')),
  icon TEXT NOT NULL, -- Nom de l'icône Lucide
  color TEXT NOT NULL, -- Code Hex ou classe Tailwind
  is_system INTEGER DEFAULT 0, -- 1 = pré-créée, 0 = personnalisée
  is_active INTEGER DEFAULT 1,
  budget_limit REAL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Objectifs d'épargne et allocations (F2)
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default_user',
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0.0,
  target_date TEXT,
  interest_rate REAL DEFAULT NULL,
  deposit_timing TEXT DEFAULT 'START_OF_MONTH' CHECK(deposit_timing IN ('START_OF_MONTH', 'END_OF_MONTH')),
  interest_mode TEXT DEFAULT 'BONUS' CHECK(interest_mode IN ('BONUS', 'DEDUCT')),
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

-- 3. Modèles d'opérations récurrentes (Moteur de répétition)
CREATE TABLE IF NOT EXISTS recurring_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE')),
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  day_of_month INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 31),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING_PAUSED')),
  carry_over INTEGER NOT NULL DEFAULT 1, -- 1 = se reporte sur les mois suivants
  end_month_year TEXT, -- Format 'YYYY-MM', NULL = sans fin
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- 4. Transactions mensuelles réelles (Instances par mois)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  template_id TEXT, -- NULL si dépense imprévue ou ponctuelle
  month_year TEXT NOT NULL, -- Format 'YYYY-MM' (ex: '2026-10')
  date TEXT NOT NULL, -- Format 'YYYY-MM-DD'
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE')),
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING')),
  is_carried_over INTEGER DEFAULT 0, -- 1 si générée par report automatique
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES recurring_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- 5. Clôtures et Reports de Solde Mensuel
CREATE TABLE IF NOT EXISTS monthly_balances (
  month_year TEXT PRIMARY KEY, -- 'YYYY-MM'
  carried_over_from_previous REAL DEFAULT 0, -- Reliquat ou dette du mois M-1
  is_closed INTEGER DEFAULT 0
);

-- Index de performance et d'idempotence stricte
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_template_per_month 
  ON transactions(template_id, month_year) 
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_month_status 
  ON transactions(month_year, status);

CREATE INDEX IF NOT EXISTS idx_transactions_date 
  ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id 
  ON subcategories(category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_template_id 
  ON transactions(template_id);
`;
