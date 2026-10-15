import React, { useEffect } from 'react';
import { Clock, Calendar, ToggleLeft, ToggleRight, X } from 'lucide-react';

interface ToggleScopeModalProps {
  isOpen: boolean;
  transactionTitle: string;
  currentMonthYear: string;
  isPending: boolean; // État actuel
  onConfirm: (stopFutureRepetitions: boolean) => void;
  onCancel: () => void;
}

export const ToggleScopeModal: React.FC<ToggleScopeModalProps> = ({
  isOpen,
  transactionTitle,
  currentMonthYear,
  isPending,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const targetAction = isPending ? 'Réactiver' : 'Mettre en attente';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="toggle-scope-modal-title"
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isPending ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 id="toggle-scope-modal-title" className="text-base font-bold text-slate-100">
                {targetAction} une opération récurrente
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                « {transactionTitle} » ({currentMonthYear})
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Fermer la boîte de dialogue"
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Cette opération se répète chaque mois. Souhaitez-vous appliquer ce changement uniquement pour le mois en cours ou également pour les mois futurs ?
        </p>

        <div className="space-y-3 pt-1">
          {/* Option 1 : Ce mois uniquement */}
          <button
            onClick={() => onConfirm(false)}
            className="w-full text-left p-3.5 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-indigo-400">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span>{targetAction} uniquement pour {currentMonthYear}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Ajustement temporaire. L'opération continuera de se générer normalement sur les mois suivants.
            </p>
          </button>

          {/* Option 2 : Ce mois et les mois suivants */}
          <button
            onClick={() => onConfirm(true)}
            className="w-full text-left p-3.5 bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/30 hover:border-amber-400/60 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 group-hover:text-amber-200">
              {isPending ? (
                <ToggleRight className="h-4 w-4 text-emerald-400" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-amber-400" />
              )}
              <span>{targetAction} pour ce mois ET les mois à venir</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              {isPending
                ? 'Réactive durablement le modèle récurrent pour tous les mois futurs.'
                : 'Suspend durablement le prélèvement pour les prochains mois jusqu\'à réactivation.'}
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
