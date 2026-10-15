import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Clock, TrendingUp, PiggyBank, Target, AlertCircle } from 'lucide-react';
import { MonthlySummary, Transaction, Category } from '../types';

interface DashboardViewProps {
  summary?: MonthlySummary;
  transactions?: Transaction[];
  categories?: Category[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ summary, transactions = [], categories = [] }) => {
  if (!summary) {
    return <div className="p-8 text-center text-slate-400">Chargement des données du mois...</div>;
  }

  const netBalance = summary.netBalance;
  const isPositive = netBalance >= 0;

  // Calcul des ratios budgétaires et capacité d'épargne
  const totalIncome = summary.totalIncome > 0 ? summary.totalIncome : 1;
  const recurringPct = Math.min(100, Math.round((summary.byType.recurring / totalIncome) * 100));
  const currentPct = Math.min(100, Math.round((summary.byType.current / totalIncome) * 100));
  const unforeseenPct = Math.min(100, Math.round((summary.byType.unforeseen / totalIncome) * 100));
  const remainingPct = Math.max(0, 100 - (recurringPct + currentPct + unforeseenPct));

  // Notion de Capacité d'Épargne
  const savingsCapacity = Math.max(0, netBalance);
  const savingsRate = Math.round((savingsCapacity / totalIncome) * 100);

  return (
    <div className="space-y-6">
      {/* 1. Les 5 Cartes KPI Principales (avec Capacité d'Épargne) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1 : Rentrées */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Rentrées</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {summary.totalIncome.toFixed(2)} €
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Revenus actifs</p>
        </div>

        {/* KPI 2 : Dépenses Actives */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Dépenses</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {summary.totalActiveExpenses.toFixed(2)} €
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Fixes + Courantes + Imprévus
          </p>
        </div>

        {/* KPI 3 : Reste à vivre réel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Reste à vivre</span>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-xl font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}{netBalance.toFixed(2)} €
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {summary.carriedOverFromPrevious !== 0 ? `Report: ${summary.carriedOverFromPrevious > 0 ? '+' : ''}${summary.carriedOverFromPrevious.toFixed(2)}€` : 'Sans dette reportée'}
          </p>
        </div>

        {/* KPI 4 : Capacité d'Épargne */}
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-teal-300">Capacité d'épargne</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-teal-300">
            {savingsCapacity.toFixed(2)} €
          </div>
          <p className="text-[11px] text-teal-400/80 mt-1">
            Taux : <span className="font-semibold">{savingsRate}%</span> (Objectif : 20%)
          </p>
        </div>

        {/* KPI 5 : Enveloppe En Attente (PENDING) */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-300">En attente</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {summary.totalPendingExpenses.toFixed(2)} €
          </div>
          <p className="text-[11px] text-amber-400/80 mt-1 truncate">Strictement non débité</p>
        </div>
      </div>

      {/* 2. Jauge Visuelle de Santé Budgétaire */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">Répartition du budget mensuel</h2>
          </div>
          <span className="text-xs text-slate-400">Base : 100% des rentrées</span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div style={{ width: `${recurringPct}%` }} className="bg-blue-500 hover:opacity-90 transition-all" title={`Charges Fixes: ${recurringPct}%`}></div>
          <div style={{ width: `${currentPct}%` }} className="bg-amber-500 hover:opacity-90 transition-all" title={`Courantes: ${currentPct}%`}></div>
          <div style={{ width: `${unforeseenPct}%` }} className="bg-rose-500 hover:opacity-90 transition-all" title={`Imprévus: ${unforeseenPct}%`}></div>
          <div style={{ width: `${remainingPct}%` }} className="bg-emerald-500 hover:opacity-90 transition-all" title={`Reste disponible: ${remainingPct}%`}></div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">Charges fixes ({recurringPct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">Dépenses courantes ({currentPct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="text-slate-400">Imprévus ({unforeseenPct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-400">Reste libre ({remainingPct}%)</span>
          </div>
        </div>
      </div>

      {/* 3. Derniers mouvements & Top 5 Dépenses (N6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières Transactions Récentes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-100 mb-4">Derniers mouvements du mois</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucune transaction saisie pour ce mois.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tx.category_color || '#64748B' }}
                    ></span>
                    <div>
                      <p className="font-medium text-slate-200">{tx.title}</p>
                      <p className="text-[11px] text-slate-500">{tx.date} • {tx.category_name} {tx.subcategory_name ? `› ${tx.subcategory_name}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {tx.status === 'PENDING' && (
                      <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                        En attente
                      </span>
                    )}
                    <span
                      className={`font-mono font-semibold ${
                        tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toFixed(2)} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 Postes de Dépenses (N6) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-100 mb-4">Top 5 Postes de Dépenses</h2>
          {(() => {
            const catMap = new Map<string, { name: string; color: string; total: number }>();
            for (const tx of transactions) {
              if (tx.status === 'ACTIVE' && tx.type !== 'INCOME') {
                const key = tx.category_id;
                const existing = catMap.get(key) || {
                  name: tx.category_name || 'Catégorie',
                  color: tx.category_color || '#6366F1',
                  total: 0,
                };
                existing.total += tx.amount;
                catMap.set(key, existing);
              }
            }
            const top5 = Array.from(catMap.values())
              .sort((a, b) => b.total - a.total)
              .slice(0, 5);

            const totalActive = summary.totalActiveExpenses > 0 ? summary.totalActiveExpenses : 1;

            if (top5.length === 0) {
              return <p className="text-sm text-slate-500 italic">Aucune dépense active sur ce mois.</p>;
            }

            return (
              <div className="space-y-3 pt-1">
                {top5.map((cat, idx) => {
                  const pct = Math.round((cat.total / totalActive) * 1000) / 10;
                  return (
                    <div key={cat.name + idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-medium text-slate-200">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-100 font-semibold">{cat.total.toFixed(2)} €</span>
                          <span className="text-[10px] text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Plafonds Budgétaires & Jauges de Consommation (F1) */}
      {(() => {
        const catSpentMap = new Map<string, number>();
        for (const tx of transactions) {
          if (tx.status === 'ACTIVE' && tx.type !== 'INCOME') {
            catSpentMap.set(tx.category_id, (catSpentMap.get(tx.category_id) || 0) + tx.amount);
          }
        }

        const budgetedCats = categories.filter((c) => c.budget_limit && c.budget_limit > 0);
        if (budgetedCats.length === 0) return null;

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-bold text-slate-100">Enveloppes & Plafonds Budgétaires</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {budgetedCats.length} poste{budgetedCats.length > 1 ? 's suivis' : ' suivi'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgetedCats.map((cat) => {
                const spent = catSpentMap.get(cat.id) || 0;
                const limit = cat.budget_limit!;
                const pct = Math.round((spent / limit) * 100);
                const isOver = spent > limit;
                const isWarning = pct >= 75 && !isOver;

                return (
                  <div key={cat.id} className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-semibold text-slate-200">{cat.name}</span>
                      </div>
                      {isOver && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" /> Dépassement
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-slate-100 font-bold">{spent.toFixed(2)} €</span>
                      <span className="text-slate-400">Plafond : {limit.toFixed(2)} €</span>
                    </div>

                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{pct}% consommé</span>
                      <span>{isOver ? `+${(spent - limit).toFixed(2)} € d'excédent` : `${(limit - spent).toFixed(2)} € restant`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
