import React from 'react';
import { StepProps } from './types';

interface Step5Props extends StepProps {
  adultsCount: number;
  childrenCount: number;
  hasPets: boolean;
  mobilePlansCount: number;
  setMobilePlansCount: (val: number) => void;
}

export const Step5RecurringExpenses: React.FC<Step5Props> = ({
  adultsCount,
  childrenCount,
  hasPets,
  mobilePlansCount,
  setMobilePlansCount,
  templates,
  toggleTemplate,
  updateTemplateField,
  getCatId,
  getSubId,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Charges Fixes & Abonnements</h2>
        <p className="text-xs text-slate-400 mt-1">
          Sélectionnez vos dépenses récurrentes courantes.
        </p>
      </div>

      {/* 1. Bloc Télécoms avec forfaits mobiles multiples configurables */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200">📶 Forfaits Mobiles & Téléphonie</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Indiquez le nombre de forfaits mobiles du foyer ({adultsCount} adulte{adultsCount > 1 ? 's' : ''}{childrenCount > 0 ? `, ${childrenCount} enfant${childrenCount > 1 ? 's' : ''}` : ''}) et personnalisez le libellé en face de chaque montant.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-300 font-medium">Nombre de forfaits :</span>
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMobilePlansCount(Math.max(1, mobilePlansCount - 1))}
                className="h-6 w-6 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded flex items-center justify-center font-bold text-xs"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold text-indigo-400 w-6 text-center">
                {mobilePlansCount}
              </span>
              <button
                type="button"
                onClick={() => setMobilePlansCount(mobilePlansCount + 1)}
                className="h-6 w-6 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded flex items-center justify-center font-bold text-xs"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Lignes dynamiques de forfaits mobiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: mobilePlansCount }).map((_, idx) => {
            const key = `mobile_plan_${idx + 1}`;
            const tpl = templates.find((t) => t.id === key);
            const isChecked = !!tpl;
            const catId = getCatId('RECURRING_EXPENSE', 'télécoms');
            const subId = getSubId(catId, 'mobile');

            return (
              <div
                key={key}
                className={`p-3 rounded-xl border transition-all ${
                  isChecked
                    ? 'bg-slate-800/80 border-indigo-500/50'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        toggleTemplate(key, {
                          category_id: catId,
                          subcategory_id: subId,
                          title: `Forfait Mobile ${idx + 1}`,
                          amount: 19.99,
                          type: 'RECURRING_EXPENSE',
                          day_of_month: 10,
                        })
                      }
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 h-4 w-4"
                    />
                    <span className="text-xs font-medium text-slate-200">
                      Forfait Mobile {idx + 1}
                    </span>
                  </label>
                  {isChecked && (
                    <span className="font-mono text-xs text-rose-400 font-bold">
                      -{tpl.amount} € / mois
                    </span>
                  )}
                </div>

                {isChecked && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Libellé</label>
                      <input
                        type="text"
                        value={tpl.title}
                        onChange={(e) => updateTemplateField(key, 'title', e.target.value)}
                        placeholder={`Ex: Forfait Julien, Forfait Marie...`}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Montant mensuel (€)</label>
                      <input
                        type="number"
                        step="any"
                        value={tpl.amount}
                        onChange={(e) => updateTemplateField(key, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-rose-400 font-bold font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Autres blocs thématiques */}
      {[
        {
          title: '⚡ Énergie & Eau',
          items: [
            { key: 'elec', title: 'Électricité (EDF, Engie...)', defaultAmt: 85, catPart: 'logement' },
            { key: 'gaz', title: 'Gaz', defaultAmt: 60, catPart: 'logement' },
            { key: 'eau', title: 'Eau courante', defaultAmt: 35, catPart: 'logement' },
          ],
        },
        {
          title: '📺 Internet & Abonnements Numériques',
          items: [
            { key: 'box_fibre', title: 'Box Internet / Fibre', defaultAmt: 39, catPart: 'télécoms' },
            { key: 'streaming_video', title: 'Streaming (Netflix, Prime...)', defaultAmt: 15, catPart: 'télécoms' },
            { key: 'streaming_music', title: 'Musique (Spotify, Deezer...)', defaultAmt: 10, catPart: 'télécoms' },
          ],
        },
        {
          title: '🛡️ Assurances & Banque',
          items: [
            { key: 'assur_hab', title: 'Assurance Habitation', defaultAmt: 25, catPart: 'assurances' },
            { key: 'assur_auto', title: 'Assurance Auto / Moto', defaultAmt: 55, catPart: 'assurances' },
            { key: 'mutuelle', title: 'Mutuelle Santé', defaultAmt: 45, catPart: 'assurances' },
            ...(hasPets
              ? [{ key: 'assur_pets', title: 'Assurance Animaux', defaultAmt: 22, catPart: 'assurances' }]
              : []),
            { key: 'frais_banque', title: 'Frais bancaires / Carte', defaultAmt: 8, catPart: 'assurances' },
          ],
        },
        {
          title: '🎒 Vie scolaire, Transports & Loisirs réguliers',
          items: [
            ...(childrenCount > 0
              ? [{ key: 'cantine', title: 'Cantine / Garderie scolaire', defaultAmt: 70, catPart: 'abonnements' }]
              : []),
            { key: 'navigo', title: 'Abonnement Transport (Bus / Train / Navigo)', defaultAmt: 45, catPart: 'abonnements' },
            { key: 'sport', title: 'Salle de sport / Club régulier', defaultAmt: 30, catPart: 'abonnements' },
          ],
        },
      ].map((section, sIdx) => (
        <div key={sIdx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200">{section.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.items.map((item) => {
              const tpl = templates.find((t) => t.id === item.key);
              const isChecked = !!tpl;
              const catId = getCatId('RECURRING_EXPENSE', item.catPart);

              return (
                <div
                  key={item.key}
                  className={`p-3 rounded-xl border transition-all ${
                    isChecked
                      ? 'bg-slate-800/80 border-indigo-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
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
                            title: item.title,
                            amount: item.defaultAmt,
                            type: 'RECURRING_EXPENSE',
                            day_of_month: 10,
                          })
                        }
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 h-4 w-4"
                      />
                      <span className="text-xs font-medium text-slate-200">{item.title}</span>
                    </label>
                  </div>
                  {isChecked && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Montant :</span>
                      <input
                        type="number"
                        step="any"
                        value={tpl.amount}
                        onChange={(e) => updateTemplateField(item.key, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-rose-400 font-bold font-mono"
                      />
                      <span className="text-xs text-slate-400">€ / mois</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
