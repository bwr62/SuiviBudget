import React, { useState, useEffect } from 'react';
import { Calendar, Tag } from 'lucide-react';
import { Category, OperationType, Transaction } from '../../types';

interface AddTransactionFormProps {
  type: OperationType;
  categories: Category[];
  currentMonthYear: string;
  onAddTransaction: (data: Partial<Transaction>) => Promise<void>;
  onCancel: () => void;
}

export const AddTransactionForm: React.FC<AddTransactionFormProps> = ({
  type,
  categories,
  currentMonthYear,
  onAddTransaction,
  onCancel,
}) => {
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(`${currentMonthYear}-01`);
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formRecurring, setFormRecurring] = useState(type === 'INCOME' || type === 'RECURRING_EXPENSE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormDate(`${currentMonthYear}-01`);
  }, [currentMonthYear]);

  const relevantCategories = categories.filter((c) => c.type === type);
  const selectedCategoryObj = categories.find((c) => c.id === formCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount || !formCategory) return;

    setIsSubmitting(true);
    try {
      await onAddTransaction({
        title: formTitle.trim(),
        amount: parseFloat(formAmount),
        date: formDate,
        type,
        category_id: formCategory,
        subcategory_id: formSubcategory || null,
        status: 'ACTIVE',
        is_recurring: formRecurring,
      });

      setFormTitle('');
      setFormAmount('');
      setFormCategory('');
      setFormSubcategory('');
      onCancel();
    } catch (err) {
      console.error('Erreur ajout transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 mb-4 animate-in fade-in duration-200"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Date</label>
          <div className="relative">
            <input
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Libellé</label>
          <input
            type="text"
            required
            placeholder="Ex: Salaire, Loyer..."
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Montant (€)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Catégorie</label>
          <div className="relative">
            <select
              required
              value={formCategory}
              onChange={(e) => {
                setFormCategory(e.target.value);
                setFormSubcategory('');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Sélectionner</option>
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {selectedCategoryObj?.subcategories && selectedCategoryObj.subcategories.length > 0 && (
        <div className="w-full md:w-1/3">
          <label className="block text-[11px] text-slate-400 mb-1">Sous-catégorie (Optionnelle)</label>
          <select
            value={formSubcategory}
            onChange={(e) => setFormSubcategory(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Aucune</option>
            {selectedCategoryObj.subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {type !== 'UNFORESEEN_EXPENSE' && (
        <div className="pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formRecurring}
              onChange={(e) => setFormRecurring(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
            />
            <span className="font-medium">
              Répéter automatiquement chaque mois (se reportera sur les mois suivants)
            </span>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
};
