import { Category } from '../../types';

export interface TemplateDraft {
  id: string;
  category_id: string;
  subcategory_id?: string | null;
  subcategory_name?: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
  day_of_month: number;
  end_month_year?: string | null;
  carry_over: number;
}

export interface StepProps {
  categories: Category[];
  currentMonthYear: string;
  paydayDefault: number;
  templates: TemplateDraft[];
  toggleTemplate: (
    key: string,
    defaultData: {
      category_id: string;
      subcategory_id?: string | null;
      subcategory_name?: string;
      title: string;
      amount: number;
      type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
      day_of_month?: number;
      end_month_year?: string | null;
      carry_over?: number;
    }
  ) => void;
  updateTemplateField: (key: string, field: keyof TemplateDraft, value: any) => void;
  getCatId: (type: string, fallbackNamePart: string) => string;
  getSubId: (catId: string, subNamePart: string) => string | null;
}
