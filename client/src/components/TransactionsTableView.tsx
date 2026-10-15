import React, { useState, useEffect, useMemo } from 'react';
import { Plus, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Transaction, Category, OperationType } from '../types';
import { UpdateScopeModal } from './UpdateScopeModal';
import { ToggleScopeModal } from './ToggleScopeModal';
import { SearchBar } from './transactions/SearchBar';
import { AddTransactionForm } from './transactions/AddTransactionForm';
import { TransactionRow } from './transactions/TransactionRow';
import { showToast } from '../store/useToastStore';

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

type SortField = 'date' | 'title' | 'category' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [pendingToggleTx, setPendingToggleTx] = useState<Transaction | null>(null);

  const [pendingScopeUpdate, setPendingScopeUpdate] = useState<{
    tx: Transaction;
    newAmount: number;
    newTitle: string;
  } | null>(null);

  // Raccourci clavier 'N' pour ouvrir l'ajout rapide (N7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowAddForm((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Gestion de la touche Escape pour les modales (E1)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingTxId) setDeletingTxId(null);
        if (editingTxId) setEditingTxId(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [deletingTxId, editingTxId]);

  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
  };

  const handleSaveEdit = async (tx: Transaction, newTitle: string, newAmount: number) => {
    setEditingTxId(null);

    if (tx.template_id && onUpdateTransaction) {
      setPendingScopeUpdate({
        tx,
        newAmount,
        newTitle,
      });
      return;
    }

    if (onUpdateTransaction) {
      await onUpdateTransaction(tx.id, {
        title: newTitle,
        amount: newAmount,
      }, 'CURRENT_MONTH_ONLY');
    }
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

  const handleToggleClick = async (tx: Transaction) => {
    const isRecurring = Boolean(tx.template_id || tx.is_carried_over === 1 || tx.type === 'RECURRING_EXPENSE');
    if (isRecurring) {
      setPendingToggleTx(tx);
    } else {
      await onToggleStatus(tx.id, tx.status === 'PENDING' ? 'ACTIVE' : 'PENDING', false);
    }
  };

  const handleConfirmToggleScope = async (stopFutureRepetitions: boolean) => {
    if (!pendingToggleTx) return;
    const tx = pendingToggleTx;
    setPendingToggleTx(null);
    const newStatus = tx.status === 'PENDING' ? 'ACTIVE' : 'PENDING';
    await onToggleStatus(tx.id, newStatus, stopFutureRepetitions);
    showToast({
      message: `Statut de "${tx.title}" mis à jour (${newStatus}).`,
      type: 'info',
      onUndo: async () => {
        await onToggleStatus(tx.id, tx.status, false);
      },
    });
  };

  // Liste des sous-catégories présentes dans ce type d'opération
  const typeTransactions = useMemo(() => transactions.filter((t) => t.type === type), [transactions, type]);
  
  const subcategoriesList = useMemo(() => {
    const set = new Set<string>();
    for (const tx of typeTransactions) {
      if (tx.subcategory_name) set.add(tx.subcategory_name);
    }
    return Array.from(set).sort();
  }, [typeTransactions]);

  // Filtrage
  const filteredTransactions = useMemo(() => {
    return typeTransactions.filter((tx) => {
      if (selectedSubcategory && tx.subcategory_name !== selectedSubcategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = tx.title.toLowerCase().includes(q);
      const catMatch = tx.category_name?.toLowerCase().includes(q);
      const subMatch = tx.subcategory_name?.toLowerCase().includes(q);
      return titleMatch || catMatch || subMatch;
    });
  }, [typeTransactions, searchQuery, selectedSubcategory]);

  // Tri interactif par colonne (U2)
  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = a.date.localeCompare(b.date);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'category':
          cmp = (a.category_name || '').localeCompare(b.category_name || '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredTransactions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Gestion de la sélection multiple (U4)
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTransactions.map((t) => t.id)));
    }
  };

  // Batch actions (U4)
  const handleBatchToggleStatus = async (targetStatus: 'ACTIVE' | 'PENDING') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch('/api/transactions/batch/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids, status: targetStatus }),
      });
      if (res.ok) {
        showToast({ message: `${ids.length} opération(s) passée(s) en ${targetStatus}.`, type: 'success' });
        setSelectedIds(new Set());
        // Forcer le rechargement via onToggleStatus du premier
        if (ids[0]) await onToggleStatus(ids[0], targetStatus, false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (!confirm(`Supprimer définitivement les ${ids.length} transactions sélectionnées ?`)) return;

    try {
      const res = await fetch('/api/transactions/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        showToast({ message: `${ids.length} opération(s) supprimée(s).`, type: 'info' });
        setSelectedIds(new Set());
        if (ids[0]) await onDeleteTransaction(ids[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête de section avec Recherche et Bouton d'ajout */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
              {filteredTransactions.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestion des opérations de type {title.toLowerCase()} (Raccourci: <kbd className="px-1 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono">N</kbd>)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedSubcategory={selectedSubcategory}
            onSubcategoryChange={setSelectedSubcategory}
            subcategoriesList={subcategoriesList}
            filteredCount={sortedTransactions.length}
            totalCount={typeTransactions.length}
          />

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
            aria-expanded={showAddForm}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Fermer' : 'Ajouter'}</span>
          </button>
        </div>
      </div>

      {/* Barre d'actions groupées (Batch Actions Bar - U4) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-indigo-200">
            <span className="font-bold text-white font-mono">{selectedIds.size}</span>
            <span>opération(s) sélectionnée(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchToggleStatus('PENDING')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-medium transition"
            >
              <ToggleLeft className="w-3.5 h-3.5" />
              <span>Mettre en attente</span>
            </button>
            <button
              onClick={() => handleBatchToggleStatus('ACTIVE')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium transition"
            >
              <ToggleRight className="w-3.5 h-3.5" />
              <span>Activer</span>
            </button>
            <button
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer le lot</span>
            </button>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout rapide (N1) */}
      {showAddForm && (
        <AddTransactionForm
          type={type}
          categories={categories}
          currentMonthYear={currentMonthYear}
          onAddTransaction={onAddTransaction}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Tableau des Lignes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs" aria-label={title}>
          <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th scope="col" className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={sortedTransactions.length > 0 && selectedIds.size === sortedTransactions.length}
                  onChange={handleSelectAll}
                  aria-label="Tout sélectionner"
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>

              <th scope="col" className="px-4 py-3 cursor-pointer hover:text-slate-200 transition" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  {sortField === 'date' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col" className="px-4 py-3 cursor-pointer hover:text-slate-200 transition" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-1">
                  <span>Libellé</span>
                  {sortField === 'title' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col" className="px-4 py-3 cursor-pointer hover:text-slate-200 transition" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1">
                  <span>Catégorie</span>
                  {sortField === 'category' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col" className="px-4 py-3 cursor-pointer hover:text-slate-200 transition" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">
                  <span>Statut</span>
                  {sortField === 'status' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col" className="px-4 py-3 text-right cursor-pointer hover:text-slate-200 transition" onClick={() => handleSort('amount')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Montant</span>
                  {sortField === 'amount' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {sortedTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                  Aucune ligne pour {title.toLowerCase()} sur ce mois.
                </td>
              </tr>
            ) : (
              sortedTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isSelected={selectedIds.has(tx.id)}
                  onToggleSelect={handleToggleSelect}
                  isEditing={editingTxId === tx.id}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={() => setEditingTxId(null)}
                  onSaveEdit={handleSaveEdit}
                  onToggleClick={handleToggleClick}
                  onDeleteClick={(id) => setDeletingTxId(id)}
                  canUpdate={!!onUpdateTransaction}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modale de confirmation de suppression (E1 Accessible) */}
      {deletingTxId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 id="delete-dialog-title" className="text-sm font-semibold text-slate-100">
                  Confirmer la suppression
                </h4>
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
                autoFocus
                onClick={async () => {
                  const idToDelete = deletingTxId;
                  setDeletingTxId(null);
                  await onDeleteTransaction(idToDelete);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de portée de mise à jour pour opérations récurrentes */}
      {pendingScopeUpdate && (
        <UpdateScopeModal
          isOpen={true}
          transactionTitle={pendingScopeUpdate.newTitle}
          currentMonthYear={currentMonthYear}
          newAmount={pendingScopeUpdate.newAmount}
          oldAmount={pendingScopeUpdate.tx.amount}
          onConfirm={handleConfirmScope}
          onCancel={() => setPendingScopeUpdate(null)}
        />
      )}

      {/* Modale de portée de mise en attente pour opérations récurrentes */}
      {pendingToggleTx && (
        <ToggleScopeModal
          isOpen={true}
          transactionTitle={pendingToggleTx.title}
          currentMonthYear={currentMonthYear}
          isPending={pendingToggleTx.status === 'PENDING'}
          onConfirm={handleConfirmToggleScope}
          onCancel={() => setPendingToggleTx(null)}
        />
      )}
    </div>
  );
};
