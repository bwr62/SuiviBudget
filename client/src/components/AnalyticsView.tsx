import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Award, Activity } from 'lucide-react';
import { Category } from '../types';

interface AnalyticsViewProps {
  categories: Category[];
  currentMonthYear: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ currentMonthYear }) => {
  const currentYear = currentMonthYear.substring(0, 4);

  // 1. Données Annuelles
  const { data: annualData = [], isLoading: annualLoading } = useQuery<any[]>({
    queryKey: ['annualStats', currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/stats/annual?year=${currentYear}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur annual stats');
      return res.json();
    },
  });

  // 2. Répartition par catégorie
  const { data: pieData = [], isLoading: pieLoading } = useQuery<any[]>({
    queryKey: ['categoryDistribution', currentMonthYear],
    queryFn: async () => {
      const res = await fetch(`/api/stats/category-distribution?monthYear=${currentMonthYear}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur dist stats');
      return res.json();
    },
  });

  // 3. Courbe journalière
  const { data: curveJson, isLoading: curveLoading } = useQuery<{ points: any[] }>({
    queryKey: ['dailyCurve', currentMonthYear],
    queryFn: async () => {
      const res = await fetch(`/api/months/${currentMonthYear}/daily-curve`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur daily curve');
      return res.json();
    },
  });
  const dailyCurveData = curveJson?.points || [];

  // 4. Top catégories
  const { data: topJson, isLoading: topLoading } = useQuery<{ topCategories: any[]; totalExpense: number }>({
    queryKey: ['topCategories', currentMonthYear],
    queryFn: async () => {
      const res = await fetch(`/api/stats/top-categories?monthYear=${currentMonthYear}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur top categories');
      return res.json();
    },
  });
  const topCategories = topJson?.topCategories || [];
  const totalExpense = topJson?.totalExpense || 0;

  const loading = annualLoading || pieLoading || curveLoading || topLoading;

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-mono">
        Chargement des graphiques statistiques et de trésorerie...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <span>Statistiques & Analyses Visuelles</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Visualisation annuelle, trésorerie quotidienne et classement des dépenses (exclusion stricte des opérations En attente).
        </p>
      </div>

      {/* Graphique Pleine Largeur : Courbe de Trésorerie Journalière (N5 AreaChart) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Évolution du Solde Journalier - Trésorerie ({currentMonthYear})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Solde cumulé jour par jour</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickFormatter={(d) => `J${d}`} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(2)} €`, 'Solde courant']}
                labelFormatter={(label) => `Jour ${label}`}
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px', color: '#10B981' }}
              />
              <Area
                type="monotone"
                dataKey="runningBalance"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#balanceGradient)"
                name="Solde réel"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deux colonnes : Donut Répartition + Top 5 Postes de Dépenses (N6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Répartition des Dépenses */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Répartition par Catégorie ({currentMonthYear})
            </h3>
          </div>

          {pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs italic">
              Aucune dépense active enregistrée pour ce mois.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total_amount"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.category_color || '#6366F1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `${Number(val).toFixed(2)} €`}
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top 5 Postes de Dépenses (N6 Widget) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Top 5 des Postes de Dépenses
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Total : {totalExpense.toFixed(2)} €</span>
          </div>

          {topCategories.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs italic">
              Aucune dépense sur ce mois.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {topCategories.map((cat, idx) => (
                <div key={cat.category_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-400 text-[10px]">#{idx + 1}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.category_color || '#6366F1' }}
                      />
                      <span className="font-medium text-slate-200">{cat.category_name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-100 font-semibold">{cat.total_amount.toFixed(2)} €</span>
                      <span className="text-[10px] text-slate-400">({cat.percentage}%)</span>
                    </div>
                  </div>
                  {/* Barre horizontale de proportion */}
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, cat.percentage)}%`,
                        backgroundColor: cat.category_color || '#6366F1',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graphique Annuel : Entrées vs Dépenses */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          Évolution Annuelle (Entrées vs Dépenses empilées)
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annualData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="month_year" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="income" name="Revenus" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recurring" name="Charges Fixes" stackId="expenses" fill="#3B82F6" />
              <Bar dataKey="current" name="Courantes" stackId="expenses" fill="#F59E0B" />
              <Bar dataKey="unforeseen" name="Imprévus" stackId="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
