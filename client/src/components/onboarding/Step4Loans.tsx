import React from 'react';
import { StepProps } from './types';

export const Step4Loans: React.FC<StepProps> = ({
  templates,
  toggleTemplate,
  updateTemplateField,
  getCatId,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Autres Crédits & Remboursements</h2>
        <p className="text-xs text-slate-400 mt-1">
          Crédit auto, prêt étudiant, paiements en 3x/4x... Renseignez la date de fin pour que le report s'arrête tout seul !
        </p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'loan_auto', title: 'Crédit Auto / Moto / LOA / LLD', defaultAmt: 220 },
          { key: 'loan_conso', title: 'Prêt Personnel / Consommation', defaultAmt: 150 },
          { key: 'loan_student', title: 'Prêt étudiant', defaultAmt: 120 },
          { key: 'loan_split_pay', title: 'Paiement en plusieurs fois en cours (3x, 4x, 10x)', defaultAmt: 65 },
          { key: 'loan_family', title: 'Remboursement dette familiale ou privée', defaultAmt: 100 },
        ].map((item) => {
          const tpl = templates.find((t) => t.id === item.key);
          const isChecked = !!tpl;
          const catId = getCatId('RECURRING_EXPENSE', 'crédits');

          return (
            <div
              key={item.key}
              className={`p-3.5 rounded-xl border transition-all ${
                isChecked
                  ? 'bg-slate-800/80 border-indigo-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      toggleTemplate(item.key, {
                        category_id: catId,
                        title: item.title,
                        amount: item.defaultAmt,
                        type: 'RECURRING_EXPENSE',
                        day_of_month: 10,
                      })
                    }
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                </label>
                {isChecked && (
                  <span className="font-mono text-xs text-rose-400 font-bold">
                    -{tpl.amount} € / mois
                  </span>
                )}
              </div>

              {isChecked && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Montant mensuel (€)</label>
                    <input
                      type="number"
                      step="any"
                      value={tpl.amount}
                      onChange={(e) => updateTemplateField(item.key, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-rose-400 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Jour de prélèvement</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={tpl.day_of_month}
                      onChange={(e) => updateTemplateField(item.key, 'day_of_month', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                      <span>Dernier mois à payer</span>
                      <span className="text-indigo-400 text-[10px]" title="Le prélèvement s'arrêtera automatiquement au-delà de cette date">(Fin)</span>
                    </label>
                    <input
                      type="month"
                      value={tpl.end_month_year || ''}
                      onChange={(e) => updateTemplateField(item.key, 'end_month_year', e.target.value || null)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-indigo-300"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
