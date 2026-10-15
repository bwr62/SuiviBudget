import React from 'react';
import { TemplateDraft } from './types';

interface Step6Props {
  totals: {
    totalIncome: number;
    totalRecurring: number;
    totalCurrent: number;
    remaining: number;
  };
  templates: TemplateDraft[];
  currentMonthYear: string;
}

export const Step6Summary: React.FC<Step6Props> = ({
  totals,
  templates,
  currentMonthYear,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Habitudes de Dépenses Courantes & Validation</h2>
        <p className="text-xs text-slate-400 mt-1">
          Voici un aperçu en direct de votre équilibre financier mensuel avant d'accéder à votre espace.
        </p>
      </div>

      {/* Récapitulatif KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            Total Revenus
          </span>
          <div className="text-xl font-bold font-mono text-emerald-400">
            +{totals.totalIncome.toFixed(2)} €
          </div>
          <p className="text-[10px] text-slate-500">Salaires et rentrées déclarées</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            Charges & Crédits
          </span>
          <div className="text-xl font-bold font-mono text-rose-400">
            -{totals.totalRecurring.toFixed(2)} €
          </div>
          <p className="text-[10px] text-slate-500">Dépenses incompressibles fixes</p>
        </div>

        <div
          className={`rounded-xl p-5 space-y-1 border ${
            totals.remaining >= 0
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-rose-950/20 border-rose-500/30'
          }`}
        >
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">
            Reste à vivre estimé
          </span>
          <div
            className={`text-xl font-bold font-mono ${
              totals.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totals.remaining.toFixed(2)} €
          </div>
          <p className="text-[10px] text-slate-400">Pour les courses, loisirs, imprévus et épargne</p>
        </div>
      </div>

      {/* Liste récapitulative des modèles qui vont être enregistrés */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-200">
            Lignes récurrentes qui seront créées ({templates.length})
          </h3>
          <span className="text-[11px] text-slate-400">Mois de départ : {currentMonthYear}</span>
        </div>

        {templates.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            Aucune ligne récurrente configurée. Vous pourrez en ajouter ultérieurement.
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 text-xs">
            {templates.map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      t.type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className="font-medium text-slate-200">{t.title}</span>
                  {t.end_month_year && (
                    <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                      Jusqu'à {t.end_month_year}
                    </span>
                  )}
                </div>
                <span
                  className={`font-mono font-bold ${
                    t.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {t.type === 'INCOME' ? '+' : '-'}
                  {t.amount.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
