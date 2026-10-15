import {
  LayoutDashboard,
  ArrowDownLeft,
  CalendarSync,
  Receipt,
  AlertTriangle,
  FolderTree,
  BarChart3,
  PiggyBank,
  LogOut,
  Wallet,
  Sun,
  Moon,
} from 'lucide-react';
import { useUIStore, TabType } from '../store/useUIStore';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'income', label: 'Rentrées d\'argent', icon: ArrowDownLeft },
  { id: 'recurring', label: 'Charges & Abonnements', icon: CalendarSync },
  { id: 'current', label: 'Dépenses courantes', icon: Receipt },
  { id: 'unforeseen', label: 'Dépenses imprévues', icon: AlertTriangle },
  { id: 'savings', label: 'Projets & Épargne', icon: PiggyBank },
  { id: 'categories', label: 'Gestion & Catégories', icon: FolderTree },
  { id: 'analytics', label: 'Statistiques & Analyses', icon: BarChart3 },
];

interface SidebarProps {
  onLogout?: () => void;
  username?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout, username }) => {
  const { activeTab, setActiveTab, theme, toggleTheme } = useUIStore();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 transition-colors">
      {/* Logo & Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight leading-tight">Suivi Budget</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-400 font-mono">v0.02 Local</span>
            </div>
          </div>
        </div>

        {/* Bouton de bascule Thème Clair / Sombre */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors border border-slate-800"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-400" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User & Security Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">{username || 'Session Sécurisée'}</p>
              <p className="text-[10px] text-emerald-400 font-mono">Passkey Active</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Déconnexion"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
