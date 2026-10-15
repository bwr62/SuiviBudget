import React from 'react';
import { HousingStatus } from '../../types';
import { StepProps } from './types';

interface Step3Props extends StepProps {
  housingStatus: HousingStatus;
  setHousingStatus: (status: HousingStatus) => void;
}

export const Step3Housing: React.FC<Step3Props> = ({
  housingStatus,
  setHousingStatus,
  templates,
  toggleTemplate,
  updateTemplateField,
  getCatId,
  getSubId,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Logement & Frais d'habitation</h2>
        <p className="text-xs text-slate-400 mt-1">
          Quelle est votre situation de logement principale ?
        </p>
      </div>

      {/* Radio cards situation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'TENANT', label: 'Locataire' },
          { id: 'OWNER_WITH_LOAN', label: 'Propriétaire (avec crédit)' },
          { id: 'OWNER_PAID_OFF', label: 'Propriétaire (remboursé)' },
          { id: 'FREE_HOUSING', label: 'Hébergé à titre gratuit' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setHousingStatus(opt.id as HousingStatus)}
            className={`p-3.5 rounded-xl border text-center transition-all ${
              housingStatus === opt.id
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="text-xs block">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Si Locataire */}
      {housingStatus === 'TENANT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            Frais de location
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'loyer_principal', title: 'Loyer mensuel (charges comprises)', defaultAmt: 750 },
              { key: 'charges_loc', title: 'Charges locatives séparées', defaultAmt: 60 },
              { key: 'parking_box', title: 'Place de parking / Box séparé', defaultAmt: 50 },
            ].map((item) => {
              const tpl = templates.find((t) => t.id === item.key);
              const isChecked = !!tpl;
              const catId = getCatId('RECURRING_EXPENSE', 'logement');
              const subId = getSubId(catId, 'Loyer');

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
                            subcategory_id: subId,
                            title: item.title,
                            amount: item.defaultAmt,
                            type: 'RECURRING_EXPENSE',
                            day_of_month: 5,
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
      )}

      {/* Si Propriétaire avec crédit */}
      {housingStatus === 'OWNER_WITH_LOAN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
            <span>Prêts immobiliers & Assurances emprunteur</span>
            <span className="text-[10px] text-slate-400 font-normal">Extinction automatique avec Date de Fin</span>
          </h3>
          <div className="space-y-3">
            {[
              { key: 'loan_immo_main', title: 'Crédit Immobilier Principal', defaultAmt: 850 },
              { key: 'loan_ptz', title: 'Prêt à Taux Zéro (PTZ)', defaultAmt: 150 },
              { key: 'loan_assurance', title: 'Assurance Emprunteur (séparée)', defaultAmt: 35 },
            ].map((item) => {
              const tpl = templates.find((t) => t.id === item.key);
              const isChecked = !!tpl;
              const catId = getCatId('RECURRING_EXPENSE', 'logement');
              const subId = getSubId(catId, 'Loyer');

              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isChecked
                      ? 'bg-slate-800/80 border-indigo-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
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
                            subcategory_id: subId,
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
                        <label className="block text-[10px] text-slate-400 mb-1">Jour du prélèvement</label>
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
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Fin du prêt (YYYY-MM, facultatif)
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
      )}

      {/* Charges de propriétaire (Copropriété & Taxe foncière) */}
      {(housingStatus === 'OWNER_WITH_LOAN' || housingStatus === 'OWNER_PAID_OFF') && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            Charges de copropriété & Taxes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'copro', title: 'Charges de copropriété (mensualisées)', defaultAmt: 120 },
              { key: 'taxe_fonciere', title: 'Taxe foncière (mensualisée)', defaultAmt: 90 },
            ].map((item) => {
              const tpl = templates.find((t) => t.id === item.key);
              const isChecked = !!tpl;
              const catId = getCatId('RECURRING_EXPENSE', 'logement');

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
                            day_of_month: 15,
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
      )}
    </div>
  );
};
