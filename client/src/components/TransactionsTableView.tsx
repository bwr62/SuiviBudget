import React, { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, Trash2, Calendar, Tag } from 'lucide-react';
import { Transaction, Category, OperationType } from '../types';

interface TransactionsTableViewProps {
  title: string;
  type: OperationType;
  transactions: Transaction[];
  categories: Category[];
  currentMonthYear: string;
  onAddTransaction: (data: Partial<Transaction>) => Promise<void>;
  onToggleStatus: (id: string, newStatus: 'ACTIVE' | 'PENDING', stopRepetitions?: boolean) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const TransactionsTableView: React.FC<TransactionsTableViewProps> = ({
  title,
  type,
  transactions,
  categories,
  currentMonthYear,
  onAddTransaction,
  onToggleStatus,
  onDeleteTransaction,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(`${currentMonthYear}-01`);
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrer les transactions selon le type de la vue
  const filteredTransactions = transactions.filter((t) => t.type === type);
  const relevantCategories = categories.filter((c) => c.type === type);

  const selectedCategoryObj = relevantCategories.find((c) => c.id === formCategory);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formAmount || !formCategory || !formDate) return;

    setIsSubmitting(true);
    try {
      await onAddTransaction({
        title: formTitle,
        amount: parseFloat(formAmount),
        date: formDate,
        month_year: currentMonthYear,
        type,
        category_id: formCategory,
        subcategory_id: formSubcategory || null,
        status: 'ACTIVE',
      });

      // Reset
      setFormTitle('');
      setFormAmount('');
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTotal = filteredTransactions
    .filter((t) => t.status === 'ACTIVE')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingTotal = filteredTransactions
    .filter((t) => t.status === 'PENDING')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Entête de Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <div className="flex items-center gap-4 mt-1 text-xs">
            <span className="text-slate-400">
              Total actif : <strong className="font-mono text-emerald-400 text-sm">{activeTotal.toFixed(2)} €</strong>
            </span>
            {pendingTotal > 0 && (
              <span className="text-amber-400">
                En attente : <strong className="font-mono text-sm">{pendingTotal.toFixed(2)} €</strong> (exclu)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter une ligne</span>
        </button>
      </div>

      {/* Formulaire d'ajout rapide */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-5 space-y-4 shadow-lg backdrop-blur-sm"
        >
          <h3 className="text-sm font-semibold text-indigo-300">Nouvelle saisie ({title})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Date</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Libellé</label>
              <input
                type="text"
                required
                placeholder="Ex: Salaire, Loyer, Courses..."
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Tableau des Lignes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                  Aucune ligne pour {title.toLowerCase()} sur ce mois.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isPending = tx.status === 'PENDING';
                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isPending ? 'opacity-60 bg-slate-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {tx.date}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-200">
                      <div>
                        <span>{tx.title}</span>
                        {tx.is_carried_over === 1 && (
                          <span className="ml-2 inline-block px-1.5 py-0.2 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20">
                            Répété
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Tag
                          className="h-3 w-3 shrink-0"
                          style={{ color: tx.category_color || '#94A3B8' }}
                        />
                        <span>{tx.category_name}</span>
                        {tx.subcategory_name && (
                          <span className="text-slate-500 text-[11px]">› {tx.subcategory_name}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {isPending ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          En attente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Actif
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          isPending
                            ? 'text-slate-500 line-through'
                            : tx.type === 'INCOME'
                            ? 'text-emerald-400'
                            : 'text-slate-100'
                        }
                      >
                        {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toFixed(2)} €
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Switch Actif / En attente */}
                        <button
                          onClick={() =>
                            onToggleStatus(
                              tx.id,
                              isPending ? 'ACTIVE' : 'PENDING',
                              !isPending && tx.type === 'RECURRING_EXPENSE'
                            )
                          }
                          title={
                            isPending
                              ? 'Réactiver cette dépense'
                              : 'Mettre en attente (exclure du calcul)'
                          }
                          className={`p-1 rounded transition-colors ${
                            isPending
                              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {isPending ? (
                            <ToggleLeft className="h-4 w-4" />
                          ) : (
                            <ToggleRight className="h-4 w-4 text-emerald-400" />
                          )}
                        </button>

                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Supprimer"
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
