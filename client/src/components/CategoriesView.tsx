import React, { useState } from 'react';
import { Plus, Tag, Layers } from 'lucide-react';
import { Category, OperationType } from '../types';

interface CategoriesViewProps {
  categories: Category[];
  onRefresh: () => void;
}

const TYPE_LABELS: Record<OperationType, string> = {
  INCOME: '1. Rentrées d\'argent',
  RECURRING_EXPENSE: '2. Dépenses répétitives (Charges & Abonnements)',
  CURRENT_EXPENSE: '3. Dépenses courantes',
  UNFORESEEN_EXPENSE: '4. Dépenses imprévues',
};

export const CategoriesView: React.FC<CategoriesViewProps> = ({ categories, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<OperationType>('CURRENT_EXPENSE');
  const [color, setColor] = useState('#6366F1');
  const [icon, setIcon] = useState('Tag');
  const [subcategoriesStr, setSubcategoriesStr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const subs = subcategoriesStr
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          type,
          icon,
          color,
          subcategories: subs,
        }),
      });

      if (res.ok) {
        setName('');
        setSubcategoriesStr('');
        setShowAddModal(false);
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const grouped = (['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE'] as OperationType[]).map(
    (t) => ({
      type: t,
      label: TYPE_LABELS[t],
      items: categories.filter((c) => c.type === t),
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Gestion des Catégories & Sous-catégories</h2>
          <p className="text-xs text-slate-400 mt-1">
            Référentiel complet des postes budgétaires avec taxonomie système et personnalisée.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle catégorie</span>
        </button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCategory}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-100">Ajouter une catégorie personnalisée</h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom de la catégorie</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Formations, Investissements..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type d'opération</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OperationType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="INCOME">Rentrées</option>
                  <option value="RECURRING_EXPENSE">Charges répétitives</option>
                  <option value="CURRENT_EXPENSE">Dépenses courantes</option>
                  <option value="UNFORESEEN_EXPENSE">Dépenses imprévues</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Couleur</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-10 bg-transparent cursor-pointer rounded border border-slate-700"
                  />
                  <span className="text-xs font-mono text-slate-300">{color}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Icône Lucide</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Ex: Bookmark, Sparkles..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Sous-catégories (séparées par une virgule)</label>
              <textarea
                value={subcategoriesStr}
                onChange={(e) => setSubcategoriesStr(e.target.value)}
                placeholder="Ex: Livres, Conférences, Abonnements cours"
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                Créer la catégorie
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grouped Category Listing */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.type} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>{group.label}</span>
              <span className="text-xs font-normal text-slate-500">({group.items.length} catégories)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 rounded-lg p-3.5 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      ></span>
                      <span className="font-semibold text-slate-100 text-xs">{cat.name}</span>
                    </div>
                    {cat.is_system === 1 ? (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                        Système
                      </span>
                    ) : (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        Perso
                      </span>
                    )}
                  </div>

                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cat.subcategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="inline-flex items-center gap-1 text-[10px] bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded border border-slate-800"
                        >
                          <Tag className="h-2.5 w-2.5 text-slate-500" />
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic mt-1">Aucune sous-catégorie</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
