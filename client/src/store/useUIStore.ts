import { create } from 'zustand';

export type TabType =
  | 'dashboard'
  | 'income'
  | 'recurring'
  | 'current'
  | 'unforeseen'
  | 'categories'
  | 'analytics';

interface UIState {
  currentMonthYear: string;
  activeTab: TabType;
  autoCarryOverBalance: boolean;
  setCurrentMonthYear: (monthYear: string) => void;
  setActiveTab: (tab: TabType) => void;
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

export const useUIStore = create<UIState>((set) => ({
  currentMonthYear: getInitialMonth(),
  activeTab: 'dashboard',
  autoCarryOverBalance: false,
  setCurrentMonthYear: (monthYear) => set({ currentMonthYear: monthYear }),
  setActiveTab: (tab) => set({ activeTab: tab }),
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
