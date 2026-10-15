import React, { useState } from 'react';
import { Plus, Tag, Layers, Edit2, Check, X, Trash2 } from 'lucide-react';
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

  // Édition d'une catégorie existante
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('');

  // Ajout rapide d'une sous-catégorie
  const [addingSubToCategoryId, setAddingSubToCategoryId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  // Édition d'une sous-catégorie
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState('');

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

  const handleStartEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditCategoryColor(cat.color);
  };

  const handleSaveEditCategory = async (catId: string) => {
    if (!editCategoryName.trim()) return;

    const res = await fetch(`/api/categories/${catId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: editCategoryName.trim(),
        color: editCategoryColor,
      }),
    });

    if (res.ok) {
      setEditingCategoryId(null);
      onRefresh();
    }
  };

  const handleAddSubcategory = async (catId: string) => {
    if (!newSubName.trim()) return;

    const res = await fetch(`/api/categories/${catId}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newSubName.trim() }),
    });

    if (res.ok) {
      setNewSubName('');
      setAddingSubToCategoryId(null);
      onRefresh();
    }
  };

  const handleSaveEditSub = async (subId: string) => {
    if (!editingSubName.trim()) return;

    const res = await fetch(`/api/subcategories/${subId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: editingSubName.trim() }),
    });

    if (res.ok) {
      setEditingSubId(null);
      onRefresh();
    }
  };

  const handleDeleteSub = async (subId: string) => {
    const res = await fetch(`/api/subcategories/${subId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.ok) {
      onRefresh();
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
            Modifiez le nom ou la couleur d'une catégorie existante, et ajoutez ou renommez vos sous-catégories librement.
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((cat) => {
                const isEditingThisCat = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="bg-slate-800/40 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Entête Catégorie (Affichage ou Mode Édition) */}
                      {isEditingThisCat ? (
                        <div className="space-y-2 mb-3 bg-slate-900/90 p-2.5 rounded-lg border border-indigo-500/30">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editCategoryColor}
                              onChange={(e) => setEditCategoryColor(e.target.value)}
                              className="h-6 w-6 bg-transparent cursor-pointer rounded border border-slate-700"
                            />
                            <input
                              type="text"
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingCategoryId(null)}
                              className="p-1 text-slate-400 hover:text-slate-200 rounded"
                              title="Annuler"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleSaveEditCategory(cat.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                              title="Valider"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full shadow-sm"
                              style={{ backgroundColor: cat.color }}
                            ></span>
                            <span className="font-semibold text-slate-100 text-xs">{cat.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartEditCategory(cat)}
                              title="Modifier cette catégorie"
                              className="p-1 text-slate-500 hover:text-indigo-400 rounded transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
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
                        </div>
                      )}

                      {/* Liste des sous-catégories existantes */}
                      <div className="space-y-1.5 mt-2">
                        {cat.subcategories && cat.subcategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cat.subcategories.map((sub) => {
                              const isEditingThisSub = editingSubId === sub.id;

                              if (isEditingThisSub) {
                                return (
                                  <div
                                    key={sub.id}
                                    className="flex items-center gap-1 bg-slate-900 border border-indigo-500/40 rounded px-1.5 py-0.5"
                                  >
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingSubName}
                                      onChange={(e) => setEditingSubName(e.target.value)}
                                      className="bg-transparent text-[10px] text-slate-100 outline-none w-24"
                                    />
                                    <button
                                      onClick={() => handleSaveEditSub(sub.id)}
                                      className="text-emerald-400 hover:text-emerald-300"
                                      title="Enregistrer"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => setEditingSubId(null)}
                                      className="text-slate-400 hover:text-slate-200"
                                      title="Annuler"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <span
                                  key={sub.id}
                                  className="group inline-flex items-center gap-1 text-[10px] bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-700"
                                >
                                  <Tag className="h-2.5 w-2.5 text-slate-500" />
                                  <span>{sub.name}</span>
                                  <button
                                    onClick={() => {
                                      setEditingSubId(sub.id);
                                      setEditingSubName(sub.name);
                                    }}
                                    title="Renommer"
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-400 ml-0.5 transition-opacity"
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSub(sub.id)}
                                    title="Supprimer"
                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 ml-0.5 transition-opacity"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">Aucune sous-catégorie</p>
                        )}
                      </div>
                    </div>

                    {/* Formulaire ajout rapide sous-catégorie */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60">
                      {addingSubToCategoryId === cat.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Nouvelle sous-catégorie..."
                            autoFocus
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSubcategory(cat.id);
                              }
                            }}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={() => handleAddSubcategory(cat.id)}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px]"
                            title="Ajouter"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              setAddingSubToCategoryId(null);
                              setNewSubName('');
                            }}
                            className="p-1 text-slate-400 hover:text-slate-200"
                            title="Annuler"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingSubToCategoryId(cat.id);
                            setNewSubName('');
                          }}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-medium py-0.5"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Ajouter une sous-catégorie</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
