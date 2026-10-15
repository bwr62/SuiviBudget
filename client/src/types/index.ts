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
  subcategories?: Subcategory[];
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
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_name?: string;
}
