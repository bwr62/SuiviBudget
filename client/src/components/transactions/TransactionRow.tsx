import React, { useState } from 'react';
import { Calendar, Tag, Edit2, Check, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Transaction } from '../../types';

interface TransactionRowProps {
  tx: Transaction;
  isEditing: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onStartEdit: (tx: Transaction) => void;
  onCancelEdit: () => void;
  onSaveEdit: (tx: Transaction, newTitle: string, newAmount: number) => void;
  onToggleClick: (tx: Transaction) => void;
  onDeleteClick: (id: string) => void;
  canUpdate?: boolean;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  tx,
  isEditing,
  isSelected = false,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleClick,
  onDeleteClick,
  canUpdate = true,
}) => {
  const [editTitle, setEditTitle] = useState(tx.title);
  const [editAmount, setEditAmount] = useState(tx.amount.toString());

  const isPending = tx.status === 'PENDING';

  const handleSave = () => {
    const num = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(num) || num <= 0) {
      onCancelEdit();
      return;
    }
    onSaveEdit(tx, editTitle.trim(), num);
  };

  return (
    <tr
      className={`hover:bg-slate-800/40 transition-colors ${
        isPending ? 'opacity-60 bg-slate-950/30' : ''
      } ${isSelected ? 'bg-indigo-950/30' : ''}`}
    >
      <td className="px-3 py-3 text-center">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(tx.id)}
            aria-label={`Sélectionner ${tx.title}`}
            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        )}
      </td>

      <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          {tx.date}
        </span>
      </td>

      <td className="px-4 py-3 font-medium text-slate-200">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-100 w-full outline-none"
              autoFocus
              aria-label="Modifier le libellé"
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
        {isEditing ? (
          <input
            type="number"
            step="any"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            className="w-24 bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-right font-mono text-slate-100 outline-none"
            aria-label="Modifier le montant"
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
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                title="Enregistrer"
                aria-label="Enregistrer les modifications"
                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onCancelEdit}
                title="Annuler"
                aria-label="Annuler la modification"
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : canUpdate ? (
            <button
              onClick={() => onStartEdit(tx)}
              title="Modifier montant ou libellé"
              aria-label={`Modifier ${tx.title}`}
              className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {/* Switch Actif / En attente */}
          <button
            onClick={() => onToggleClick(tx)}
            title={
              isPending
                ? 'Réactiver cette dépense'
                : 'Mettre en attente (exclure du calcul)'
            }
            aria-label={isPending ? 'Réactiver' : 'Mettre en attente'}
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
            onClick={() => onDeleteClick(tx.id)}
            title="Supprimer"
            aria-label={`Supprimer ${tx.title}`}
            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
