import React, { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';
import { OperationType } from '../../types';

interface NewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TYPE_OPTIONS: Array<{ value: OperationType; label: string }> = [
  { value: 'INCOME', label: 'Rentrée d\'argent' },
  { value: 'RECURRING_EXPENSE', label: 'Charges & Abonnements (Répétitives)' },
  { value: 'CURRENT_EXPENSE', label: 'Dépense courante' },
  { value: 'UNFORESEEN_EXPENSE', label: 'Dépense imprévue' },
];

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#F59E0B', '#EF4444', '#14B8A6',
];

export const NewCategoryModal: React.FC<NewCategoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<OperationType>('CURRENT_EXPENSE');
  const [color, setColor] = useState('#6366F1');
  const icon = 'Tag';
  const [subcategoriesStr, setSubcategoriesStr] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const subs = subcategoriesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedLimit = budgetLimit.trim() ? parseFloat(budgetLimit.replace(',', '.')) : null;

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
          budget_limit: parsedLimit && parsedLimit > 0 ? parsedLimit : null,
        }),
      });

      if (res.ok) {
        setName('');
        setSubcategoriesStr('');
        setBudgetLimit('');
        onClose();
        onCreated();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-category-title"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 id="modal-category-title" className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            <span>Nouvelle catégorie personnalisée</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Nom de la catégorie</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Loisirs créatifs, Animaux..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Section budgétaire</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as OperationType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Couleur d'accentuation</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  aria-label={`Choisir la couleur ${c}`}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Sous-catégories initiales (séparées par une virgule)
            </label>
            <input
              type="text"
              placeholder="Ex: Matériel, Cours, Fournitures..."
              value={subcategoriesStr}
              onChange={(e) => setSubcategoriesStr(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Plafond / Enveloppe mensuelle cible (€) (Optionnel)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 350.00"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer la catégorie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
