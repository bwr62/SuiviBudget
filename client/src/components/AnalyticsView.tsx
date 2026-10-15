import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { Category } from '../types';

interface AnalyticsViewProps {
  categories: Category[];
  currentMonthYear: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ currentMonthYear }) => {
  const [data, setData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [yearRes, distRes] = await Promise.all([
          fetch(`/api/stats/annual?year=${currentMonthYear.substring(0, 4)}`, { credentials: 'include' }),
          fetch(`/api/stats/category-distribution?monthYear=${currentMonthYear}`, { credentials: 'include' }),
        ]);

        if (yearRes.ok && distRes.ok) {
          const yData = await yearRes.json();
          const dData = await distRes.json();
          setData(yData);
          setPieData(dData);
        }
      } catch (err) {
        console.error('Erreur stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentMonthYear]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Chargement des graphiques statistiques...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <h2 className="text-lg font-bold text-slate-100">Statistiques & Analyses Visuelles</h2>
        <p className="text-xs text-slate-400 mt-1">
          Visualisation annuelle et répartition par catégories (Calculs stricts excluant les dépenses En attente).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique 1 : Entrées vs Dépenses Annuelles */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Évolution Annuelle (Entrées vs Sorties)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="month_year" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Revenus" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recurring" name="Fixes" stackId="expenses" fill="#3B82F6" />
                <Bar dataKey="current" name="Courantes" stackId="expenses" fill="#F59E0B" />
                <Bar dataKey="unforeseen" name="Imprévus" stackId="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 2 : Répartition par Catégories */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Répartition des Dépenses ({currentMonthYear})</h3>
          {pieData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-slate-500 text-xs italic">
              Aucune dépense active enregistrée pour ce mois.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total_amount"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
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
      </div>
    </div>
  );
};
