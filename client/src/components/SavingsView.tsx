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

/**
 * Calcule les intérêts composés prévisionnels en fonction du montant actuel,
 * du taux net annuel et de la date de fin estimée (en mois).
 */
export function calculateEstimatedInterests(
  currentAmount: number,
  annualRateNetPercent: number | null | undefined,
  currentMonthYear: string,
  targetDateMonthYear: string | null | undefined
): { monthsRemaining: number; estimatedInterests: number; totalEstimated: number } {
  if (!annualRateNetPercent || annualRateNetPercent <= 0 || !targetDateMonthYear) {
    return { monthsRemaining: 0, estimatedInterests: 0, totalEstimated: currentAmount };
  }

  const monthsRemaining = getMonthsDiff(currentMonthYear, targetDateMonthYear);
  if (monthsRemaining <= 0 || currentAmount <= 0) {
    return { monthsRemaining, estimatedInterests: 0, totalEstimated: currentAmount };
  }

  const years = monthsRemaining / 12;
  const rateDecimal = annualRateNetPercent / 100;
  // Intérêts composés annuels : A = P * (1 + r)^t
  const totalEstimated = currentAmount * Math.pow(1 + rateDecimal, years);
  const estimatedInterests = Math.max(0, totalEstimated - currentAmount);

  return {
    monthsRemaining,
    estimatedInterests: Math.round(estimatedInterests * 100) / 100,
    totalEstimated: Math.round(totalEstimated * 100) / 100,
  };
}

export const SavingsView: React.FC<SavingsViewProps> = ({ currentMonthYear, savingsCapacity }) => {
  const queryClient = useQueryClient();
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [selectedGoalForAlloc, setSelectedGoalForAlloc] = useState<SavingsGoal | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

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
            const interestInfo = calculateEstimatedInterests(
              goal.current_amount,
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
                            <span>Objectif {goal.target_date}</span>
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
                    <span className="text-base font-bold text-slate-100">
                      {goal.current_amount.toFixed(2)} €
                    </span>
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

                {/* Bloc Calcul Intérêts Estimés */}
                {goal.interest_rate && goal.interest_rate > 0 && goal.target_date && (
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <TrendingUp className="w-3 h-3" />
                        <span>Intérêts nets estimés :</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        +{interestInfo.estimatedInterests.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Capital à terme ({interestInfo.monthsRemaining} mois) :</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {interestInfo.totalEstimated.toFixed(2)} €
                      </span>
                    </div>
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
                      setAllocAmount(remainingSavingsCapacity > 0 ? String(remainingSavingsCapacity) : '50');
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
                    placeholder="Ex: 2000"
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
                    placeholder="Ex: 500"
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

              {/* Aperçu en direct des intérêts dans la modale */}
              {(() => {
                const parsedRate = parseFloat(interestRate.replace(',', '.'));
                const parsedAmount = parseFloat(initialAmount.replace(',', '.'));
                if (parsedRate > 0 && parsedAmount > 0 && targetDate) {
                  const preview = calculateEstimatedInterests(parsedAmount, parsedRate, currentMonthYear, targetDate);
                  return (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] space-y-1 text-emerald-300">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Simulation d'intérêts ({preview.monthsRemaining} mois) :</span>
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">+{preview.estimatedInterests.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>Capital prévisionnel à terme :</span>
                        <span className="font-mono text-slate-200">{preview.totalEstimated.toFixed(2)} €</span>
                      </div>
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
    </div>
  );
};
