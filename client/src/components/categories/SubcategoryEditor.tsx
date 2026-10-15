import React, { useState } from 'react';
import { Plus, Edit2, Check, X, Trash2, AlertCircle } from 'lucide-react';
import { Subcategory } from '../../types';

interface SubcategoryEditorProps {
  categoryId: string;
  subcategories: Subcategory[];
  onRefresh: () => void;
}

export const SubcategoryEditor: React.FC<SubcategoryEditorProps> = ({
  categoryId,
  subcategories,
  onRefresh,
}) => {
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState('');
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;

    const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newSubName.trim() }),
    });

    if (res.ok) {
      setNewSubName('');
      setAddingSub(false);
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

  const handleConfirmDeleteSub = async (subId: string) => {
    const res = await fetch(`/api/subcategories/${subId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.ok) {
      setDeletingSubId(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Sous-catégories ({subcategories.length})
        </span>
        {!addingSub && (
          <button
            type="button"
            onClick={() => setAddingSub(true)}
            aria-label="Ajouter une sous-catégorie"
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Ajouter</span>
          </button>
        )}
      </div>

      {addingSub && (
        <form onSubmit={handleAddSubcategory} className="flex items-center gap-1.5 animate-in fade-in">
          <input
            type="text"
            required
            autoFocus
            placeholder="Nom sous-catégorie..."
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            aria-label="Valider l'ajout"
            className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingSub(false);
              setNewSubName('');
            }}
            aria-label="Annuler l'ajout"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {subcategories.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">Aucune sous-catégorie.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {subcategories.map((sub) => {
            const isEditing = editingSubId === sub.id;
            return (
              <div
                key={sub.id}
                className="group flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-md px-2 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={editingSubName}
                      onChange={(e) => setEditingSubName(e.target.value)}
                      className="bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-slate-100 outline-none w-28"
                    />
                    <button
                      onClick={() => handleSaveEditSub(sub.id)}
                      aria-label="Enregistrer la modification"
                      className="p-0.5 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingSubId(null)}
                      aria-label="Annuler la modification"
                      className="p-0.5 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span>{sub.name}</span>
                    <button
                      onClick={() => {
                        setEditingSubId(sub.id);
                        setEditingSubName(sub.name);
                      }}
                      aria-label={`Modifier ${sub.name}`}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-300 transition-opacity"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setDeletingSubId(sub.id)}
                      aria-label={`Supprimer ${sub.name}`}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation suppression sous-catégorie (E1 Accessible) */}
      {deletingSubId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-sub-delete"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h5 id="confirm-sub-delete" className="text-xs font-bold text-slate-100">
                  Supprimer la sous-catégorie ?
                </h5>
                <p className="text-[11px] text-slate-400 mt-1">
                  Les transactions existantes seront conservées sans sous-catégorie.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingSubId(null)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirmDeleteSub(deletingSubId)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded shadow-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
