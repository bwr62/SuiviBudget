import React from 'react';
import { AlertCircle, Calendar, RefreshCw, X } from 'lucide-react';

interface UpdateScopeModalProps {
  isOpen: boolean;
  transactionTitle: string;
  currentMonthYear: string;
  oldAmount?: number;
  newAmount?: number;
  onConfirm: (scope: 'CURRENT_MONTH_ONLY' | 'CURRENT_AND_FUTURE') => void;
  onCancel: () => void;
}

export const UpdateScopeModal: React.FC<UpdateScopeModalProps> = ({
  isOpen,
  transactionTitle,
  currentMonthYear,
  oldAmount,
  newAmount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Modifier une opération récurrente</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                « {transactionTitle} » ({currentMonthYear})
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {oldAmount !== undefined && newAmount !== undefined && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Montant :</span>
            <div className="flex items-center gap-2">
              <span className="line-through text-slate-500 font-mono">{oldAmount.toFixed(2)} €</span>
              <span className="text-slate-400">➔</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">{newAmount.toFixed(2)} €</span>
            </div>
          </div>
        )}

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2.5 text-xs text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Cette opération est issue d'un modèle répété. Choisissez la portée de votre modification. Les mois passés restent strictement préservés.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          {/* Option 1: Mois courant uniquement */}
          <button
            onClick={() => onConfirm('CURRENT_MONTH_ONLY')}
            className="w-full text-left p-3.5 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-indigo-400">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span>Modifier uniquement pour ce mois ({currentMonthYear})</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Ajustement ponctuel. Le modèle d'origine et les mois futurs conserveront leur montant habituel.
            </p>
          </button>

          {/* Option 2: Mois courant et mois futurs */}
          <button
            onClick={() => onConfirm('CURRENT_AND_FUTURE')}
            className="w-full text-left p-3.5 bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/40 hover:border-indigo-400 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 group-hover:text-indigo-200">
              <RefreshCw className="h-4 w-4 text-indigo-400 group-hover:rotate-45 transition-transform" />
              <span>Modifier pour ce mois ({currentMonthYear}) ET les mois à venir</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Changement durable (nouveau loyer, nouveau salaire...). Met à jour le modèle et tous les mois futurs.
            </p>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
