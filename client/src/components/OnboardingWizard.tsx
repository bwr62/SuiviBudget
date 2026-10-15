import React, { useState, useMemo } from 'react';
import {
  Users,
  Wallet,
  Home,
  CreditCard,
  Zap,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Category, HousingStatus } from '../types';

interface OnboardingWizardProps {
  categories: Category[];
  currentMonthYear: string;
  onComplete: () => Promise<void>;
}

interface TemplateDraft {
  id: string;
  category_id: string;
  subcategory_id?: string | null;
  subcategory_name?: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
  day_of_month: number;
  end_month_year?: string | null;
  carry_over: number;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  categories,
  currentMonthYear,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Étape 1 : Composition du foyer
  const [adultsCount, setAdultsCount] = useState<number>(1);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [hasPets, setHasPets] = useState<boolean>(false);
  const [paydayDefault, setPaydayDefault] = useState<number>(1);
  const [housingStatus, setHousingStatus] = useState<HousingStatus>('TENANT');

  // Forfaits mobiles dynamiques
  const [mobilePlansCount, setMobilePlansCount] = useState<number>(1);

  // Templates créés tout au long du wizard
  const [templates, setTemplates] = useState<TemplateDraft[]>([]);

  // Helpers pour catégories
  const getCatId = (type: string, fallbackNamePart: string) => {
    const found = categories.find(
      (c) => c.type === type && c.name.toLowerCase().includes(fallbackNamePart.toLowerCase())
    );
    return found ? found.id : categories.find((c) => c.type === type)?.id || '';
  };

  const getSubId = (catId: string, subNamePart: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat?.subcategories) return null;
    const found = cat.subcategories.find((s) =>
      s.name.toLowerCase().includes(subNamePart.toLowerCase())
    );
    return found ? found.id : null;
  };

  // Ajout / modification d'un template draft
  const toggleTemplate = (
    key: string,
    defaultData: {
      category_id: string;
      subcategory_id?: string | null;
      subcategory_name?: string;
      title: string;
      amount: number;
      type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
      day_of_month?: number;
      end_month_year?: string | null;
      carry_over?: number;
    }
  ) => {
    setTemplates((prev) => {
      const exists = prev.find((t) => t.id === key);
      if (exists) {
        return prev.filter((t) => t.id !== key);
      } else {
        return [
          ...prev,
          {
            id: key,
            category_id: defaultData.category_id,
            subcategory_id: defaultData.subcategory_id ?? null,
            subcategory_name: defaultData.subcategory_name,
            title: defaultData.title,
            amount: defaultData.amount,
            type: defaultData.type,
            day_of_month: defaultData.day_of_month ?? paydayDefault,
            end_month_year: defaultData.end_month_year ?? null,
            carry_over: defaultData.carry_over ?? 1,
          },
        ];
      }
    });
  };

  const updateTemplateField = (key: string, field: keyof TemplateDraft, value: any) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === key ? { ...t, [field]: value } : t))
    );
  };

  // Calculs totaux en direct pour l'aperçu
  const totals = useMemo(() => {
    const totalIncome = templates
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalRecurring = templates
      .filter((t) => t.type === 'RECURRING_EXPENSE')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalCurrent = templates
      .filter((t) => t.type === 'CURRENT_EXPENSE')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const remaining = totalIncome - totalRecurring;

    return { totalIncome, totalRecurring, totalCurrent, remaining };
  }, [templates]);

  // Soumission finale
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        profile: {
          adults_count: adultsCount,
          children_count: childrenCount,
          pets_count: hasPets ? 1 : 0,
          housing_status: housingStatus,
          payday_default: paydayDefault,
        },
        templates: templates.map((t) => ({
          title: t.title,
          amount: Number(t.amount) || 0,
          type: t.type,
          category_id: t.category_id,
          subcategory_id: t.subcategory_id ?? null,
          subcategory_name: t.subcategory_name,
          day_of_month: Number(t.day_of_month) || 1,
          end_month_year: t.end_month_year || null,
          carry_over: t.carry_over ?? 1,
        })),
        current_month_year: currentMonthYear,
      };

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onComplete();
      } else {
        const err = await res.json();
        alert(`Erreur: ${err.error || 'Impossible de terminer la configuration'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert('Erreur réseau lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Noms d'étapes
  const STEPS_NAV = [
    { num: 1, label: 'Foyer', icon: Users },
    { num: 2, label: 'Rentrées', icon: Wallet },
    { num: 3, label: 'Logement', icon: Home },
    { num: 4, label: 'Crédits', icon: CreditCard },
    { num: 5, label: 'Charges fixes', icon: Zap },
    { num: 6, label: 'Habitudes & Bilan', icon: ShoppingBag },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col text-slate-100 overflow-hidden">
      {/* Barre d'en-tête et progression */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl flex items-center justify-center font-bold">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Assistant de Configuration Budgétaire
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                Étape {step} sur 6
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Paramétrez vos rentrées et charges récurrentes en quelques minutes.
            </p>
          </div>
        </div>

        {/* Steps Breadcrumbs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {STEPS_NAV.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;

            return (
              <div
                key={s.num}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : isDone
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Contenu Déroulant de l'étape */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl w-full mx-auto">
        {/* ========================================================= */}
        {/* ÉTAPE 1 : COMPOSITION DU FOYER */}
        {/* ========================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Composition de votre foyer</h2>
              <p className="text-xs text-slate-400 mt-1">
                Ces informations personnalisent automatiquement les étapes suivantes (salaires, cantine, allocations, animaux).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Adultes */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Nombre d'adultes</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, adultsCount - 1);
                      setAdultsCount(next);
                      setMobilePlansCount(next);
                    }}
                    className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
                  >
                    -
                  </button>
                  <span className="font-mono text-lg font-bold text-indigo-400 w-8 text-center">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = adultsCount + 1;
                      setAdultsCount(next);
                      setMobilePlansCount(next);
                    }}
                    className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Générera automatiquement les lignes de salaires associées.</p>
              </div>

              {/* Enfants */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Nombre d'enfants à charge</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                    className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
                  >
                    -
                  </button>
                  <span className="font-mono text-lg font-bold text-indigo-400 w-8 text-center">
                    {childrenCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setChildrenCount(childrenCount + 1)}
                    className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Active les suggestions pour cantine, garde, et allocations familiales.</p>
              </div>

              {/* Animaux de compagnie */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Animaux de compagnie</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHasPets(false)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                      !hasPets
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasPets(true)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                      hasPets
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Oui (Chiens, chats...)
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Proposera les rubriques alimentation animale et mutuelle santé.</p>
              </div>

              {/* Jour habituel de réception des revenus */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Jour habituel de paie / revenus principaux
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Le</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={paydayDefault}
                    onChange={(e) => setPaydayDefault(parseInt(e.target.value, 10) || 1)}
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold text-indigo-400 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-slate-400">du mois (ex: 28, 30 ou 1er)</span>
                </div>
                <p className="text-[11px] text-slate-500">Date affectée par défaut à vos entrées d'argent récurrentes.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ÉTAPE 2 : RENTRÉES D'ARGENT (INCOME) */}
        {/* ========================================================= */}
        {step === 2 && (
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
        )}

        {/* ========================================================= */}
        {/* ÉTAPE 3 : LOGEMENT & CRÉDITS IMMOBILIERS (RECURRING_EXPENSE) */}
        {/* ========================================================= */}
        {step === 3 && (
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
        )}

        {/* ========================================================= */}
        {/* ÉTAPE 4 : AUTRES CRÉDITS & REMBOURSEMENTS (RECURRING_EXPENSE) */}
        {/* ========================================================= */}
        {step === 4 && (
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
        )}

        {/* ========================================================= */}
        {/* ÉTAPE 5 : CHARGES FIXES, ÉNERGIE & ABONNEMENTS */}
        {/* ========================================================= */}
        {step === 5 && (
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
        )}

        {/* ========================================================= */}
        {/* ÉTAPE 6 : HABITUDES COURANTES & SYNTHÈSE BUDGÉTAIRE */}
        {/* ========================================================= */}
        {step === 6 && (
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

              <div className={`rounded-xl p-5 space-y-1 border ${
                totals.remaining >= 0
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">
                  Reste à vivre estimé
                </span>
                <div className={`text-xl font-bold font-mono ${
                  totals.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
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
                        <span className={`h-2 w-2 rounded-full ${t.type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-medium text-slate-200">{t.title}</span>
                        {t.end_month_year && (
                          <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                            Jusqu'à {t.end_month_year}
                          </span>
                        )}
                      </div>
                      <span className={`font-mono font-bold ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{t.amount.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Barre d'action inférieure */}
      <footer className="border-t border-slate-800 bg-slate-900/90 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          {step > 1 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Précédent</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step < 6 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all"
            >
              <span>Continuer</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Génération du budget en cours...</span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Terminer et générer mon budget</span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
