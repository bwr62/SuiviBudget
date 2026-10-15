import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Lock, Unlock, Download, Upload } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface MonthHeaderProps {
  netBalance?: number;
  isClosed?: boolean;
  onToggleClose?: () => void;
  onOpenImport?: () => void;
}

export const MonthHeader: React.FC<MonthHeaderProps> = ({
  netBalance,
  isClosed = false,
  onToggleClose,
  onOpenImport,
}) => {
  const { currentMonthYear, nextMonth, prevMonth, autoCarryOverBalance, setAutoCarryOverBalance } = useUIStore();

  const [yearStr, monthStr] = currentMonthYear.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const monthIndex = parseInt(monthStr || '10', 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] || 'Mois';

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
      {/* Month Navigator & Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
            title="Mois précédent"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1 font-semibold text-slate-100 text-sm">
            <Calendar className="h-4 w-4 text-indigo-400" />
            <span>{monthName} {year}</span>
          </div>

          <button
            onClick={nextMonth}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
            title="Mois suivant"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton de clôture de mois (N4) */}
        {onToggleClose && (
          <button
            onClick={onToggleClose}
            title={isClosed ? 'Mois clôturé (cliquez pour réouvrir)' : 'Mois ouvert (cliquez pour clôturer)'}
            aria-label={isClosed ? 'Réouvrir le mois' : 'Clôturer le mois'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isClosed
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {isClosed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{isClosed ? 'Clôturé' : 'Ouvert'}</span>
          </button>
        )}

        {/* Rollover option toggle avec infobulle explicative */}
        <label
          title="Si activé, le reste d'argent (ou le déficit) du mois précédent est automatiquement additionné au solde de départ de ce mois. Si désactivé, chaque mois démarre avec un compteur remis à zéro."
          className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group"
        >
          <input
            type="checkbox"
            checked={autoCarryOverBalance}
            onChange={(e) => setAutoCarryOverBalance(e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
          />
          <span>Reporter le solde net de M-1</span>
          <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 ml-0.5 font-bold">ℹ️</span>
        </label>

        {/* Bouton Export CSV (F4) */}
        <a
          href={`/api/transactions/export/csv?monthYear=${currentMonthYear}`}
          download={`budget_${currentMonthYear}.csv`}
          title={`Exporter le mois ${currentMonthYear} en fichier CSV`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/60 text-slate-300 border border-slate-700 hover:text-white hover:bg-slate-800 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </a>

        {/* Bouton Import Bancaire CSV (F3) */}
        {onOpenImport && (
          <button
            onClick={onOpenImport}
            title="Importer un relevé bancaire CSV (Bourso, CA, BNP...)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Bancaire</span>
          </button>
        )}
      </div>

      {/* Quick Balance Preview */}
      {typeof netBalance === 'number' && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Reste à vivre prévisionnel :</span>
          <span
            className={`text-base font-bold font-mono px-3 py-1 rounded-lg border ${
              netBalance >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)} €
          </span>
        </div>
      )}
    </header>
  );
};
