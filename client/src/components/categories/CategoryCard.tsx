import React, { useState } from 'react';
import { Edit2, Check, X, Trash2, AlertCircle } from 'lucide-react';
import { Category } from '../../types';
import { SubcategoryEditor } from './SubcategoryEditor';

interface CategoryCardProps {
  category: Category;
  onRefresh: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [budgetLimit, setBudgetLimit] = useState(category.budget_limit ? String(category.budget_limit) : '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveEdit = async () => {
    if (!name.trim()) return;

    const parsedLimit = budgetLimit.trim() ? parseFloat(budgetLimit.replace(',', '.')) : null;

    const res = await fetch(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: name.trim(),
        color,
        budget_limit: parsedLimit && parsedLimit > 0 ? parsedLimit : null,
      }),
    });

    if (res.ok) {
      setIsEditing(false);
      onRefresh();
    }
  };

  const handleConfirmDelete = async () => {
    const res = await fetch(`/api/categories/${category.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.ok) {
      setShowDeleteConfirm(false);
      onRefresh();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 hover:border-slate-700/80 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 mr-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              aria-label="Choisir la couleur"
            />
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-100 outline-none"
              aria-label="Nom de la catégorie"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Plafond €"
              title="Plafond mensuel indicatif (€)"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="w-20 bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-100 outline-none"
              aria-label="Plafond budgétaire"
            />
            <button
              onClick={handleSaveEdit}
              aria-label="Enregistrer la modification"
              className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setName(category.name);
                setColor(category.color);
                setBudgetLimit(category.budget_limit ? String(category.budget_limit) : '');
              }}
              aria-label="Annuler la modification"
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: category.color || '#6366F1' }}
              aria-hidden="true"
            />
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>{category.name}</span>
              {category.budget_limit && (
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded font-mono border border-emerald-500/20">
                  Plafond : {category.budget_limit} €
                </span>
              )}
              {category.is_system === 1 ? (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded font-normal">
                  Système
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-400 rounded font-normal border border-indigo-500/20">
                  Personnalisée
                </span>
              )}
            </h4>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              title="Modifier nom et couleur"
              aria-label={`Modifier ${category.name}`}
              className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {category.is_system === 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Supprimer la catégorie"
                aria-label={`Supprimer ${category.name}`}
                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Éditeur de sous-catégories imbriqué (N2) */}
      <SubcategoryEditor
        categoryId={category.id}
        subcategories={category.subcategories || []}
        onRefresh={onRefresh}
      />

      {/* Confirmation suppression catégorie (E1 Accessible) */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-cat-title-${category.id}`}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h5 id={`delete-cat-title-${category.id}`} className="text-sm font-bold text-slate-100">
                  Supprimer la catégorie "{category.name}" ?
                </h5>
                <p className="text-xs text-slate-400 mt-1">
                  Les transactions existantes seront conservées sans cette catégorie.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
