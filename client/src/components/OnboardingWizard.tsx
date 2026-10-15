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
import { TemplateDraft } from './onboarding/types';
import { Step1Household } from './onboarding/Step1Household';
import { Step2Income } from './onboarding/Step2Income';
import { Step3Housing } from './onboarding/Step3Housing';
import { Step4Loans } from './onboarding/Step4Loans';
import { Step5RecurringExpenses } from './onboarding/Step5RecurringExpenses';
import { Step6Summary } from './onboarding/Step6Summary';

interface OnboardingWizardProps {
  categories: Category[];
  currentMonthYear: string;
  onComplete: () => Promise<void>;
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

  const commonProps = {
    categories,
    currentMonthYear,
    paydayDefault,
    templates,
    toggleTemplate,
    updateTemplateField,
    getCatId,
    getSubId,
  };

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

      {/* Contenu Déroulant de l'étape modulaire */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl w-full mx-auto">
        {step === 1 && (
          <Step1Household
            adultsCount={adultsCount}
            setAdultsCount={setAdultsCount}
            childrenCount={childrenCount}
            setChildrenCount={setChildrenCount}
            hasPets={hasPets}
            setHasPets={setHasPets}
            paydayDefault={paydayDefault}
            setPaydayDefault={setPaydayDefault}
            setMobilePlansCount={setMobilePlansCount}
          />
        )}

        {step === 2 && (
          <Step2Income
            {...commonProps}
            adultsCount={adultsCount}
            childrenCount={childrenCount}
          />
        )}

        {step === 3 && (
          <Step3Housing
            {...commonProps}
            housingStatus={housingStatus}
            setHousingStatus={setHousingStatus}
          />
        )}

        {step === 4 && <Step4Loans {...commonProps} />}

        {step === 5 && (
          <Step5RecurringExpenses
            {...commonProps}
            adultsCount={adultsCount}
            childrenCount={childrenCount}
            hasPets={hasPets}
            mobilePlansCount={mobilePlansCount}
            setMobilePlansCount={setMobilePlansCount}
          />
        )}

        {step === 6 && (
          <Step6Summary
            totals={totals}
            templates={templates}
            currentMonthYear={currentMonthYear}
          />
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
