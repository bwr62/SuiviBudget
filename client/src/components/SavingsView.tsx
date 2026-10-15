import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, Plus, Target, Trash2, Calendar, Coins, TrendingUp, Percent, Edit2 } from 'lucide-react';
import { SavingsGoal, SavingsAllocation } from '../types';
import { showToast } from '../store/useToastStore';

interface SavingsViewProps {
  currentMonthYear: string;
  savingsCapacity: number;
}

const PRESET_COLORS = [
  '#10B981', '#06B6D4', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6',
];

/**
 * Calcule le nombre de mois restants entre deux mois 'YYYY-MM'.
 */
function getMonthsDiff(startMonthYear: string, endMonthYear: string): number {
  const startParts = startMonthYear.split('-');
  const endParts = endMonthYear.split('-');
  const startY = Number(startParts[0] || 0);
  const startM = Number(startParts[1] || 1);
  const endY = Number(endParts[0] || 0);
  const endM = Number(endParts[1] || 1);
  return Math.max(0, (endY - startY) * 12 + (endM - startM));
}

export interface SavingsScheduleResult {
  monthsRemaining: number;
  monthlyDepositNeeded: number; // Montant brut à épargner chaque mois (ex: 285€)
  totalDeposited: number; // Total du capital versé (initial + mensualités)
  estimatedInterests: number; // Intérêts nets cumulés sur le capital initial et versements mensuels
  totalAtTarget: number; // Capital total disponible à l'échéance (versements + intérêts)
  interestOnInitial: number;
  interestOnMonthlyDeposits: number;
}

/**
 * Calcule l'échéancier d'épargne officiel :
 * 1. Détermine la mensualité brute nécessaire pour combler l'écart entre le capital actuel et la cible :
 *    mensualité = (Cible - Capital initial) / mois restants (ex: (3000 - 150) / 10 = 285 €/mois)
 * 2. Calcule les intérêts cumulés selon les règles officielles des livrets d'épargne (règle des quinzaines / capitalisation annuelle) :
 *    - Intérêts générés par le capital initial placé sur toute la durée
 *    - Intérêts générés progressivement par les versements mensuels (24 quinzaines par an)
 */
export function calculateSavingsSchedule(
  currentAmount: number,
  targetAmount: number,
  annualRateNetPercent: number | null | undefined,
  currentMonthYear: string,
  targetDateMonthYear: string | null | undefined
): SavingsScheduleResult {
  const monthsRemaining = targetDateMonthYear ? getMonthsDiff(currentMonthYear, targetDateMonthYear) : 0;
  const remainingCapitalToSave = Math.max(0, targetAmount - currentAmount);

  // Si pas de mois restants, mensualité = reste à charge total en un coup
  const monthlyDepositNeeded = monthsRemaining > 0 
    ? Math.round((remainingCapitalToSave / monthsRemaining) * 100) / 100 
    : remainingCapitalToSave;

  const totalDeposited = Math.round((currentAmount + (monthlyDepositNeeded * monthsRemaining)) * 100) / 100;

  if (!annualRateNetPercent || annualRateNetPercent <= 0 || monthsRemaining <= 0) {
    return {
      monthsRemaining,
      monthlyDepositNeeded,
      totalDeposited,
      estimatedInterests: 0,
      totalAtTarget: totalDeposited,
      interestOnInitial: 0,
      interestOnMonthlyDeposits: 0,
    };
  }

  const rateDecimal = annualRateNetPercent / 100;
  const quinzaineRate = rateDecimal / 24; // Règle officielle des 24 quinzaines par an

  // 1. Intérêts cumulés sur le capital initial (présent sur 2 * monthsRemaining quinzaines)
  // Règle Livret : Capitalisation annuelle au 31 décembre
  let simInitial = currentAmount;
  let accumulatedInterestInitial = 0;
  for (let m = 1; m <= monthsRemaining; m++) {
    // 2 quinzaines par mois
    accumulatedInterestInitial += simInitial * (quinzaineRate * 2);
    // Capitalisation au bout de chaque tranche de 12 mois
    if (m % 12 === 0) {
      simInitial += accumulatedInterestInitial;
      accumulatedInterestInitial = 0;
    }
  }
  const interestOnInitial = (simInitial - currentAmount) + accumulatedInterestInitial;

  // 2. Intérêts cumulés sur les versements mensuels réguliers
  // Chaque versement de début de mois produit des intérêts à partir de la 1ère quinzaine suivante (en moyenne ~2 quinzaines par mois restant)
  let simMonthlyDepositsTotal = 0;
  let simMonthlyInterest = 0;
  for (let m = 1; m <= monthsRemaining; m++) {
    // Versement effectué au mois m
    const monthsInvested = monthsRemaining - m;
    const quinzainesInvested = Math.max(0, monthsInvested * 2);
    simMonthlyDepositsTotal += monthlyDepositNeeded;
    simMonthlyInterest += monthlyDepositNeeded * quinzaineRate * quinzainesInvested;
  }

  const totalEstimatedInterests = Math.round((interestOnInitial + simMonthlyInterest) * 100) / 100;
  const totalAtTarget = Math.round((totalDeposited + totalEstimatedInterests) * 100) / 100;

  return {
    monthsRemaining,
    monthlyDepositNeeded,
    totalDeposited,
    estimatedInterests: totalEstimatedInterests,
    totalAtTarget,
    interestOnInitial: Math.round(interestOnInitial * 100) / 100,
    interestOnMonthlyDeposits: Math.round(simMonthlyInterest * 100) / 100,
  };
}

export const SavingsView: React.FC<SavingsViewProps> = ({ currentMonthYear, savingsCapacity }) => {
  const queryClient = useQueryClient();
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [selectedGoalForAlloc, setSelectedGoalForAlloc] = useState<SavingsGoal | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [adjustingGoal, setAdjustingGoal] = useState<SavingsGoal | null>(null);
  const [adjustRealAmount, setAdjustRealAmount] = useState('');

  // Formulaire d'ajout / édition
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [color, setColor] = useState('#10B981');

  // Formulaire d'allocation rapide
  const [allocAmount, setAllocAmount] = useState('');

  // 1. Liste des objectifs
  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ['savingsGoals'],
    queryFn: async () => {
      const res = await fetch('/api/savings/goals', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur récupération objectifs');
      return res.json();
    },
  });

  // 2. Allocations du mois en cours
  const { data: allocations = [] } = useQuery<SavingsAllocation[]>({
    queryKey: ['savingsAllocations', currentMonthYear],
    queryFn: async () => {
      const res = await fetch(`/api/savings/allocations/${currentMonthYear}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur récupération allocations');
      return res.json();
    },
  });

  // Total déjà alloué ce mois-ci
  const totalAllocatedThisMonth = allocations.reduce((sum, a) => sum + a.amount, 0);
  const remainingSavingsCapacity = Math.max(0, savingsCapacity - totalAllocatedThisMonth);

  const resetForm = () => {
    setTitle('');
    setTargetAmount('');
    setInitialAmount('');
    setTargetDate('');
    setInterestRate('');
    setColor('#10B981');
    setEditingGoal(null);
  };

  const openEditModal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setTargetAmount(String(goal.target_amount));
    setInitialAmount(String(goal.current_amount));
    setTargetDate(goal.target_date || '');
    setInterestRate(goal.interest_rate !== undefined && goal.interest_rate !== null ? String(goal.interest_rate) : '');
    setColor(goal.color || '#10B981');
    setShowAddGoalModal(true);
  };

  // Mutation Création
  const createGoalMutation = useMutation({
    mutationFn: async () => {
      const parsedRate = interestRate ? parseFloat(interestRate.replace(',', '.')) : null;
      const res = await fetch('/api/savings/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          target_amount: parseFloat(targetAmount.replace(',', '.')),
          current_amount: initialAmount ? parseFloat(initialAmount.replace(',', '.')) : 0,
          target_date: targetDate || null,
          interest_rate: parsedRate !== null && !isNaN(parsedRate) ? parsedRate : null,
          color,
        }),
      });
      if (!res.ok) throw new Error('Erreur création objectif');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      showToast({ message: 'Projet d\'épargne créé avec succès !', type: 'success' });
      setShowAddGoalModal(false);
      resetForm();
    },
  });

  // Mutation Modification
  const updateGoalMutation = useMutation({
    mutationFn: async () => {
      if (!editingGoal) return;
      const parsedRate = interestRate ? parseFloat(interestRate.replace(',', '.')) : null;
      const res = await fetch(`/api/savings/goals/${editingGoal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          target_amount: parseFloat(targetAmount.replace(',', '.')),
          current_amount: parseFloat(initialAmount.replace(',', '.')),
          target_date: targetDate || null,
          interest_rate: parsedRate !== null && !isNaN(parsedRate) ? parsedRate : null,
          color,
        }),
      });
      if (!res.ok) throw new Error('Erreur modification objectif');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      showToast({ message: 'Projet d\'épargne mis à jour !', type: 'success' });
      setShowAddGoalModal(false);
      resetForm();
    },
  });

  // Mutation Ajustement Solde Réel
  const adjustSavingsMutation = useMutation({
    mutationFn: async () => {
      if (!adjustingGoal) return;
      const parsedAmount = parseFloat(adjustRealAmount.replace(',', '.'));
      const res = await fetch(`/api/savings/goals/${adjustingGoal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_amount: parsedAmount,
        }),
      });
      if (!res.ok) throw new Error('Erreur ajustement épargne réelle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      showToast({ message: `Épargne réelle mise à jour sur "${adjustingGoal?.title}" !`, type: 'success' });
      setAdjustingGoal(null);
      setAdjustRealAmount('');
    },
  });

  // Mutation Suppression
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/savings/goals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur suppression objectif');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      showToast({ message: 'Tirelire supprimée.', type: 'info' });
    },
  });

  // Mutation Allocation
  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoalForAlloc) return;
      const res = await fetch('/api/savings/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          goal_id: selectedGoalForAlloc.id,
          month_year: currentMonthYear,
          amount: parseFloat(allocAmount.replace(',', '.')),
        }),
      });
      if (!res.ok) throw new Error('Erreur allocation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['savingsAllocations', currentMonthYear] });
      showToast({ message: `Épargne allouée à "${selectedGoalForAlloc?.title}" !`, type: 'success' });
      setSelectedGoalForAlloc(null);
      setAllocAmount('');
    },
  });

  return (
    <div className="space-y-6">
      {/* En-tête avec KPI Capacité d'Épargne & Bouton Nouveau Projet */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <PiggyBank className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Projets & Poches d'Épargne</h2>
            <p className="text-xs text-slate-400">
              Affectez votre capacité d'épargne vers des objectifs concrets (vacances, apport, urgences)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-right">
            <span className="block text-[10px] text-slate-400 uppercase font-medium">Capacité dispo ({currentMonthYear})</span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {remainingSavingsCapacity.toFixed(2)} €
            </span>
          </div>

          <button
            onClick={() => setShowAddGoalModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau projet</span>
          </button>
        </div>
      </div>

      {/* Grille des objectifs */}
      {goalsLoading ? (
        <div className="text-center py-12 text-slate-400">Chargement de vos projets...</div>
      ) : goals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Aucune poche d'épargne pour le moment</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Créez votre première tirelire (ex: Fonds de précaution, Vacances d'été) et alimentez-la avec votre reste à vivre.
          </p>
          <button
            onClick={() => setShowAddGoalModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Créer mon premier projet</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            const isCompleted = goal.current_amount >= goal.target_amount;
            const schedule = calculateSavingsSchedule(
              goal.current_amount,
              goal.target_amount,
              goal.interest_rate,
              currentMonthYear,
              goal.target_date
            );

            return (
              <div
                key={goal.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: goal.color || '#10B981' }}
                    >
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{goal.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {goal.target_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Échéance {goal.target_date}</span>
                          </div>
                        )}
                        {goal.interest_rate !== undefined && goal.interest_rate !== null && goal.interest_rate > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                            <Percent className="w-2.5 h-2.5" />
                            {goal.interest_rate}% net/an
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(goal)}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded transition"
                      title="Modifier la tirelire"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer la tirelire "${goal.title}" ?`)) {
                          deleteGoalMutation.mutate(goal.id);
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                      title="Supprimer la tirelire"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-slate-100">
                        {goal.current_amount.toFixed(2)} €
                      </span>
                      <button
                        onClick={() => {
                          setAdjustingGoal(goal);
                          setAdjustRealAmount(String(goal.current_amount));
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans border border-slate-700/80 transition"
                        title="Ajuster le solde réel constaté"
                      >
                        Ajuster réel
                      </button>
                    </div>
                    <span className="text-slate-400">
                      sur {goal.target_amount.toFixed(2)} € ({pct}%)
                    </span>
                  </div>

                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: goal.color || '#10B981',
                      }}
                    />
                  </div>
                </div>

                {/* Bloc Effort d'Épargne Mensuel & Intérêts Cumulés */}
                {goal.target_date && !isCompleted && (
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Reste à épargner / mois :</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {schedule.monthlyDepositNeeded.toFixed(2)} € / mois
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Reste à charge total :</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {Math.max(0, goal.target_amount - goal.current_amount).toFixed(2)} € sur {schedule.monthsRemaining} mois
                      </span>
                    </div>

                    {goal.interest_rate !== undefined && goal.interest_rate !== null && goal.interest_rate > 0 && (
                      <div className="pt-1 border-t border-slate-800/80 space-y-1 text-[10px]">
                        <div className="flex items-center justify-between text-emerald-400 font-medium">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Intérêts cumulés (recalculés sur le réel) :</span>
                          </span>
                          <span className="font-mono font-bold">
                            +{schedule.estimatedInterests.toFixed(2)} €
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Capital final disponible :</span>
                          <span className="font-mono text-slate-200 font-semibold">
                            {schedule.totalAtTarget.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isCompleted ? (
                      <span className="text-emerald-400 font-bold">🎉 Objectif atteint !</span>
                    ) : (
                      `Reste : ${(goal.target_amount - goal.current_amount).toFixed(2)} €`
                    )}
                  </span>

                  <button
                    onClick={() => {
                      setSelectedGoalForAlloc(goal);
                      // Propose automatiquement le montant mensuel recommandé ou la capacité restante
                      const recommended = schedule.monthsRemaining > 0 ? schedule.monthlyDepositNeeded : (goal.target_amount - goal.current_amount);
                      const defaultAlloc = remainingSavingsCapacity > 0 
                        ? Math.min(remainingSavingsCapacity, recommended) 
                        : recommended;
                      setAllocAmount(String(defaultAlloc.toFixed(2)));
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Allouer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Création / Modification Objectif */}
      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              <span>{editingGoal ? "Modifier le projet d'épargne" : "Nouveau projet d'épargne"}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nom du projet</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Vacances, Livret A, Fonds d'urgence..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Montant Cible (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Ex: 3000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Épargne actuelle (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 150"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Date de fin estimée (YYYY-MM)</label>
                  <input
                    type="month"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Taux net annuel (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 3.0 (Livret A)"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Aperçu en direct de la simulation dans la modale */}
              {(() => {
                const parsedTarget = parseFloat(targetAmount.replace(',', '.'));
                const parsedCurrent = initialAmount ? parseFloat(initialAmount.replace(',', '.')) : 0;
                const parsedRate = interestRate ? parseFloat(interestRate.replace(',', '.')) : 0;
                if (parsedTarget > 0 && targetDate) {
                  const schedule = calculateSavingsSchedule(parsedCurrent, parsedTarget, parsedRate, currentMonthYear, targetDate);
                  return (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] space-y-1.5 text-emerald-300">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Épargne mensuelle nécessaire :</span>
                        <span className="font-mono text-emerald-400 text-sm font-bold">
                          {schedule.monthlyDepositNeeded.toFixed(2)} € / mois
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>Horizon de placement :</span>
                        <span className="font-mono text-slate-200">{schedule.monthsRemaining} mois</span>
                      </div>
                      {parsedRate > 0 && (
                        <div className="pt-1.5 border-t border-emerald-500/20 space-y-1 text-[10px]">
                          <div className="flex items-center justify-between font-medium">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>Intérêts cumulés estimés (règle quinzaines) :</span>
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              +{schedule.estimatedInterests.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Capital disponible à date de fin :</span>
                            <span className="font-mono text-slate-100 font-bold">
                              {schedule.totalAtTarget.toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Couleur</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        color === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowAddGoalModal(false);
                  resetForm();
                }}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!title.trim() || !targetAmount || createGoalMutation.isPending || updateGoalMutation.isPending}
                onClick={() => {
                  if (editingGoal) {
                    updateGoalMutation.mutate();
                  } else {
                    createGoalMutation.mutate();
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {editingGoal
                  ? updateGoalMutation.isPending ? 'Enregistrement...' : 'Enregistrer'
                  : createGoalMutation.isPending ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Allocation Rapide */}
      {selectedGoalForAlloc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>Allouer à "{selectedGoalForAlloc.title}"</span>
            </h3>

            <p className="text-xs text-slate-400">
              Capacité d'épargne restante ce mois-ci :{' '}
              <strong className="text-emerald-400 font-mono">{remainingSavingsCapacity.toFixed(2)} €</strong>
            </p>

            <div className="space-y-2 text-xs">
              <label className="block text-[11px] text-slate-400">Montant à verser (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                autoFocus
                placeholder="Montant en euros"
                value={allocAmount}
                onChange={(e) => setAllocAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectedGoalForAlloc(null)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!allocAmount || parseFloat(allocAmount) <= 0 || allocateMutation.isPending}
                onClick={() => allocateMutation.mutate()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {allocateMutation.isPending ? 'Versement...' : 'Confirmer le versement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustement Solde Réel Constaté */}
      {adjustingGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              <span>Ajuster l'épargne réelle sur "{adjustingGoal.title}"</span>
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Indiquez le montant réellement présent sur votre livret/compte. L'effort d'épargne mensuel restant et les intérêts prévisionnels seront immédiatement recalculés.
            </p>

            <div className="space-y-2 text-xs">
              <label className="block text-[11px] text-slate-400">Montant réel constaté (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                placeholder="Ex: 1150"
                value={adjustRealAmount}
                onChange={(e) => setAdjustRealAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none focus:border-emerald-500"
              />
            </div>

            {/* Simulation en direct du nouvel effort mensuel nécessaire */}
            {(() => {
              const newAmount = parseFloat(adjustRealAmount.replace(',', '.'));
              if (!isNaN(newAmount) && adjustingGoal.target_date) {
                const newSchedule = calculateSavingsSchedule(
                  newAmount,
                  adjustingGoal.target_amount,
                  adjustingGoal.interest_rate,
                  currentMonthYear,
                  adjustingGoal.target_date
                );
                return (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] space-y-1 text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nouveau reste à épargner :</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {newSchedule.monthlyDepositNeeded.toFixed(2)} € / mois
                      </span>
                    </div>
                    {adjustingGoal.interest_rate && adjustingGoal.interest_rate > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Intérêts recalculés :</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          +{newSchedule.estimatedInterests.toFixed(2)} €
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAdjustingGoal(null);
                  setAdjustRealAmount('');
                }}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!adjustRealAmount || parseFloat(adjustRealAmount) < 0 || adjustSavingsMutation.isPending}
                onClick={() => adjustSavingsMutation.mutate()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {adjustSavingsMutation.isPending ? 'Mise à jour...' : 'Enregistrer le solde réel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
