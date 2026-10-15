import React, { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, Trash2, Calendar, Tag, Search, AlertCircle, X, Edit2, Check } from 'lucide-react';
import { Transaction, Category, OperationType } from '../types';
import { UpdateScopeModal } from './UpdateScopeModal';

interface TransactionsTableViewProps {
  title: string;
  type: OperationType;
  transactions: Transaction[];
  categories: Category[];
  currentMonthYear: string;
  onAddTransaction: (data: Partial<Transaction>) => Promise<void>;
  onUpdateTransaction?: (id: string, data: Partial<Transaction>, scope?: 'CURRENT_MONTH_ONLY' | 'CURRENT_AND_FUTURE') => Promise<void>;
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
  onUpdateTransaction,
  onToggleStatus,
  onDeleteTransaction,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(`${currentMonthYear}-01`);
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formRecurring, setFormRecurring] = useState(type === 'INCOME' || type === 'RECURRING_EXPENSE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Édition en ligne d'une transaction
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Modale de choix de portée pour opérations récurrentes
  const [pendingScopeUpdate, setPendingScopeUpdate] = useState<{
    tx: Transaction;
    newAmount: number;
    newTitle: string;
  } | null>(null);

  // Synchroniser la date par défaut lorsque le mois change
  React.useEffect(() => {
    setFormDate(`${currentMonthYear}-01`);
  }, [currentMonthYear]);

  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditTitle(tx.title);
    setEditAmount(tx.amount.toString());
  };

  const handleSaveEdit = async (tx: Transaction) => {
    const numAmount = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(numAmount) || numAmount <= 0) {
      setEditingTxId(null);
      return;
    }

    // Cas B : La transaction est issue d'un template récurrent
    if (tx.template_id && onUpdateTransaction) {
      setEditingTxId(null);
      setPendingScopeUpdate({
        tx,
        newAmount: numAmount,
        newTitle: editTitle.trim(),
      });
      return;
    }

    // Cas A : La transaction est ponctuelle ou imprévue (template_id IS NULL)
    if (onUpdateTransaction) {
      await onUpdateTransaction(tx.id, {
        title: editTitle.trim(),
        amount: numAmount,
      }, 'CURRENT_MONTH_ONLY');
    }
    setEditingTxId(null);
  };

  const handleConfirmScope = async (scope: 'CURRENT_MONTH_ONLY' | 'CURRENT_AND_FUTURE') => {
    if (!pendingScopeUpdate || !onUpdateTransaction) return;
    const { tx, newAmount, newTitle } = pendingScopeUpdate;
    setPendingScopeUpdate(null);

    await onUpdateTransaction(tx.id, {
      title: newTitle,
      amount: newAmount,
    }, scope);
  };

  // Filtrer les transactions selon le type de la vue et la recherche textuelle
  const filteredTransactions = transactions
    .filter((t) => t.type === type)
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = t.title.toLowerCase().includes(q);
      const catMatch = t.category_name?.toLowerCase().includes(q);
      const subMatch = t.subcategory_name?.toLowerCase().includes(q);
      const amountMatch = t.amount.toString().includes(q);
      const dateMatch = t.date.includes(q);
      return titleMatch || catMatch || subMatch || amountMatch || dateMatch;
    });

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
        month_year: formDate.substring(0, 7),
        type,
        category_id: formCategory,
        subcategory_id: formSubcategory || null,
        status: 'ACTIVE',
        is_recurring: formRecurring,
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

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une ligne</span>
          </button>
        </div>
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

          {/* Option de récurrence automatique pour mois suivants */}
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
                      {editingTxId === tx.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-100 w-full outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{tx.title}</span>
                          {tx.is_carried_over === 1 && (
                            <span className="inline-block px-1.5 py-0.2 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20">
                              Répété
                            </span>
                          )}
                        </div>
                      )}
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
                      {editingTxId === tx.id ? (
                        <input
                          type="number"
                          step="any"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-24 bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-right font-mono text-slate-100 outline-none"
                        />
                      ) : (
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
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {editingTxId === tx.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(tx)}
                              title="Enregistrer"
                              className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTxId(null)}
                              title="Annuler"
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : onUpdateTransaction ? (
                          <button
                            onClick={() => handleStartEdit(tx)}
                            title="Modifier montant ou libellé"
                            className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}

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
                          onClick={() => setDeletingTxId(tx.id)}
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

      {/* Modale de confirmation de suppression */}
      {deletingTxId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Confirmer la suppression</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTxId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deletingTxId;
                  setDeletingTxId(null);
                  if (id) await onDeleteTransaction(id);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de portée temporelle pour modification d'une récurrence */}
      {pendingScopeUpdate && (
        <UpdateScopeModal
          isOpen={true}
          transactionTitle={pendingScopeUpdate.tx.title}
          currentMonthYear={currentMonthYear}
          oldAmount={pendingScopeUpdate.tx.amount}
          newAmount={pendingScopeUpdate.newAmount}
          onConfirm={handleConfirmScope}
          onCancel={() => setPendingScopeUpdate(null)}
        />
      )}
    </div>
  );
};
