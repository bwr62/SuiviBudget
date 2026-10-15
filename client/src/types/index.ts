export type OperationType =
  | 'INCOME'
  | 'RECURRING_EXPENSE'
  | 'CURRENT_EXPENSE'
  | 'UNFORESEEN_EXPENSE';

export interface Category {
  id: string;
  name: string;
  type: OperationType;
  icon: string;
  color: string;
  is_system: number;
  is_active: number;
  budget_limit?: number | null;
  subcategories?: Subcategory[];
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
  interest_rate?: number | null; // Taux net annuel en %
  deposit_timing?: SavingsDepositTiming; // 'START_OF_MONTH' ou 'END_OF_MONTH'
  interest_mode?: SavingsInterestMode; // 'BONUS' ou 'DEDUCT'
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
  goal_title?: string;
  goal_color?: string;
  created_at?: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

export interface Transaction {
  id: string;
  template_id?: string | null;
  month_year: string;
  date: string;
  title: string;
  amount: number;
  type: OperationType;
  category_id: string;
  subcategory_id?: string | null;
  status: 'ACTIVE' | 'PENDING';
  is_carried_over: number;
  is_recurring?: boolean;
  notes?: string | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_name?: string;
  created_at?: string;
}

export interface MonthlySummary {
  monthYear: string;
  carriedOverFromPrevious: number;
  totalIncome: number;
  totalActiveExpenses: number;
  byType: {
    recurring: number;
    current: number;
    unforeseen: number;
  };
  totalPendingExpenses: number;
  netBalance: number;
}

export type HousingStatus = 'TENANT' | 'OWNER_WITH_LOAN' | 'OWNER_PAID_OFF' | 'FREE_HOUSING';

export interface HouseholdProfile {
  id: number;
  has_completed_onboarding: number;
  adults_count: number;
  children_count: number;
  pets_count: number;
  housing_status: HousingStatus;
  payday_default: number;
  updated_at?: string;
}

export interface RecurringTemplate {
  id: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
  category_id: string;
  subcategory_id?: string | null;
  day_of_month: number;
  status: 'ACTIVE' | 'PENDING_PAUSED';
  carry_over: number;
  end_month_year?: string | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_name?: string;
}
