import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Clock, TrendingUp } from 'lucide-react';
import { MonthlySummary, Transaction } from '../types';

interface DashboardViewProps {
  summary?: MonthlySummary;
  transactions?: Transaction[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ summary, transactions = [] }) => {
  if (!summary) {
    return <div className="p-8 text-center text-slate-400">Chargement des données du mois...</div>;
  }

  const netBalance = summary.netBalance;
  const isPositive = netBalance >= 0;

  // Calcul des ratios budgétaires
  const totalIncome = summary.totalIncome > 0 ? summary.totalIncome : 1;
  const recurringPct = Math.min(100, Math.round((summary.byType.recurring / totalIncome) * 100));
  const currentPct = Math.min(100, Math.round((summary.byType.current / totalIncome) * 100));
  const unforeseenPct = Math.min(100, Math.round((summary.byType.unforeseen / totalIncome) * 100));
  const remainingPct = Math.max(0, 100 - (recurringPct + currentPct + unforeseenPct));

  return (
    <div className="space-y-6">
      {/* 1. Les 4 Cartes KPI Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Rentrées */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Rentrées d'argent</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {summary.totalIncome.toFixed(2)} €
          </div>
          <p className="text-xs text-slate-400 mt-1">Revenus & entrées actives</p>
        </div>

        {/* KPI 2 : Dépenses Actives */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Dépenses Actives</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {summary.totalActiveExpenses.toFixed(2)} €
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fixes ({summary.byType.recurring.toFixed(0)}€) + Courantes ({summary.byType.current.toFixed(0)}€) + Imprévus ({summary.byType.unforeseen.toFixed(0)}€)
          </p>
        </div>

        {/* KPI 3 : Reste à vivre réel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Reste à vivre réel</span>
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}{netBalance.toFixed(2)} €
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {summary.carriedOverFromPrevious !== 0 ? `Inclut ${summary.carriedOverFromPrevious > 0 ? '+' : ''}${summary.carriedOverFromPrevious.toFixed(2)}€ de report` : 'Sans dette reportée'}
          </p>
        </div>

        {/* KPI 4 : Enveloppe En Attente (PENDING) */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-300">En attente (Suspendu)</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {summary.totalPendingExpenses.toFixed(2)} €
          </div>
          <p className="text-xs text-amber-400/80 mt-1">Strictement non comptabilisé</p>
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

      {/* 3. Dernières Transactions Récentes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-100 mb-4">Derniers mouvements du mois</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Aucune transaction saisie pour ce mois.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: tx.category_color || '#64748B' }}
                  ></span>
                  <div>
                    <p className="font-medium text-slate-200">{tx.title}</p>
                    <p className="text-xs text-slate-500">{tx.date} • {tx.category_name} {tx.subcategory_name ? `> ${tx.subcategory_name}` : ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {tx.status === 'PENDING' && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
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
    </div>
  );
};
