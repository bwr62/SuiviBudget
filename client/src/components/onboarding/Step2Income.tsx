import React from 'react';
import { StepProps } from './types';

interface Step2Props extends StepProps {
  adultsCount: number;
  childrenCount: number;
}

export const Step2Income: React.FC<Step2Props> = ({
  adultsCount,
  childrenCount,
  paydayDefault,
  templates,
  toggleTemplate,
  updateTemplateField,
  getCatId,
  getSubId,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Rentrées d'argent régulières</h2>
        <p className="text-xs text-slate-400 mt-1">
          Cochez vos sources de revenus et précisez le montant mensuel net.
        </p>
      </div>

      {/* Salaires générés dynamiquement selon le nombre d'adultes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
          1. Salaires & Revenus d'activité ({adultsCount} adulte{adultsCount > 1 ? 's' : ''})
        </h3>
        <div className="space-y-3">
          {Array.from({ length: adultsCount }).map((_, idx) => {
            const key = `salary_${idx + 1}`;
            const tpl = templates.find((t) => t.id === key);
            const isChecked = !!tpl;
            const catId = getCatId('INCOME', 'travail');
            const subId = getSubId(catId, 'Salaire');

            return (
              <div
                key={key}
                className={`p-3.5 rounded-xl border transition-all ${
                  isChecked
                    ? 'bg-slate-800/80 border-indigo-500/50'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        toggleTemplate(key, {
                          category_id: catId,
                          subcategory_id: subId,
                          title: `Salaire ${idx + 1}`,
                          amount: 2000,
                          type: 'INCOME',
                          day_of_month: paydayDefault,
                        })
                      }
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Salaire net {idx + 1}
                    </span>
                  </label>
                  {isChecked && (
                    <span className="font-mono text-xs text-emerald-400 font-bold">
                      +{tpl.amount} € / mois
                    </span>
                  )}
                </div>

                {isChecked && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/80">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Libellé</label>
                      <input
                        type="text"
                        value={tpl.title}
                        onChange={(e) => updateTemplateField(key, 'title', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Montant Net (€)</label>
                      <input
                        type="number"
                        step="any"
                        value={tpl.amount}
                        onChange={(e) => updateTemplateField(key, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Jour de versement</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={tpl.day_of_month}
                        onChange={(e) => updateTemplateField(key, 'day_of_month', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Aides & Allocations */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
          2. Aides sociales, CAF & Allocations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'caf_apl', title: 'CAF - APL / Logement', defaultAmt: 200 },
            { key: 'caf_famille', title: 'CAF - Allocations familiales', defaultAmt: 140, suggested: childrenCount > 1 },
            { key: 'caf_prime', title: 'CAF - Prime d\'activité / RSA', defaultAmt: 180 },
            { key: 'france_travail', title: 'France Travail (Chômage)', defaultAmt: 1100 },
            { key: 'pension_recue', title: 'Pension alimentaire reçue', defaultAmt: 150 },
            { key: 'bourse', title: 'Bourses scolaires / étudiantes', defaultAmt: 100 },
          ].map((item) => {
            const tpl = templates.find((t) => t.id === item.key);
            const isChecked = !!tpl;
            const catId = getCatId('INCOME', 'aides');
            const subId = getSubId(catId, item.title.substring(0, 5));

            return (
              <div
                key={item.key}
                className={`p-3 rounded-xl border transition-all ${
                  isChecked
                    ? 'bg-slate-800/80 border-indigo-500/50'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        toggleTemplate(item.key, {
                          category_id: catId,
                          subcategory_id: subId,
                          title: item.title,
                          amount: item.defaultAmt,
                          type: 'INCOME',
                          day_of_month: 5,
                        })
                      }
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 h-4 w-4"
                    />
                    <span className="text-xs font-medium text-slate-200">{item.title}</span>
                  </label>
                  {item.suggested && !isChecked && (
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Suggéré
                    </span>
                  )}
                </div>

                {isChecked && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Montant net :</span>
                    <input
                      type="number"
                      step="any"
                      value={tpl.amount}
                      onChange={(e) => updateTemplateField(item.key, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-emerald-400 font-bold font-mono"
                    />
                    <span className="text-xs text-slate-400">€ / mois</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
