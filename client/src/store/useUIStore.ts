import { create } from 'zustand';

export type TabType =
  | 'dashboard'
  | 'income'
  | 'recurring'
  | 'current'
  | 'unforeseen'
  | 'categories'
  | 'analytics';

export type Theme = 'dark' | 'light';

interface UIState {
  currentMonthYear: string;
  activeTab: TabType;
  theme: Theme;
  autoCarryOverBalance: boolean;
  setCurrentMonthYear: (monthYear: string) => void;
  setActiveTab: (tab: TabType) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAutoCarryOverBalance: (value: boolean) => void;
  nextMonth: () => void;
  prevMonth: () => void;
}

function getInitialMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getSavedTheme(): Theme {
  const saved = localStorage.getItem('app_theme');
  return saved === 'light' ? 'light' : 'dark';
}

export const useUIStore = create<UIState>((set) => ({
  currentMonthYear: getInitialMonth(),
  activeTab: 'dashboard',
  theme: getSavedTheme(),
  autoCarryOverBalance: false,
  setCurrentMonthYear: (monthYear) => set({ currentMonthYear: monthYear }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => {
    localStorage.setItem('app_theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme: Theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app_theme', nextTheme);
      return { theme: nextTheme };
    }),
  setAutoCarryOverBalance: (value) => set({ autoCarryOverBalance: value }),
  nextMonth: () =>
    set((state) => {
      const [y, m] = state.currentMonthYear.split('-').map(Number);
      if (!y || !m) return state;
      const nextDate = new Date(y, m, 1);
      const nextY = nextDate.getFullYear();
      const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
      return { currentMonthYear: `${nextY}-${nextM}` };
    }),
  prevMonth: () =>
    set((state) => {
      const [y, m] = state.currentMonthYear.split('-').map(Number);
      if (!y || !m) return state;
      const prevDate = new Date(y, m - 2, 1);
      const prevY = prevDate.getFullYear();
      const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
      return { currentMonthYear: `${prevY}-${prevM}` };
    }),
}));
