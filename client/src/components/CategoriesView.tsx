import React, { useState } from 'react';
import { Plus, Download, Upload, Database, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { Category, OperationType } from '../types';
import { CategoryCard } from './categories/CategoryCard';
import { NewCategoryModal } from './categories/NewCategoryModal';

interface CategoriesViewProps {
  categories: Category[];
  onRefresh: () => void;
}

const TYPE_CONFIG: Array<{ type: OperationType; label: string; description: string }> = [
  {
    type: 'INCOME',
    label: '1. Rentrées d\'argent',
    description: 'Salaires, primes, remboursements et revenus réguliers',
  },
  {
    type: 'RECURRING_EXPENSE',
    label: '2. Dépenses répétitives (Charges & Abonnements)',
    description: 'Loyer, énergie, assurances, abonnements mensuels fixes',
  },
  {
    type: 'CURRENT_EXPENSE',
    label: '3. Dépenses courantes',
    description: 'Alimentation, sorties, carburant et vie quotidienne',
  },
  {
    type: 'UNFORESEEN_EXPENSE',
    label: '4. Dépenses imprévues',
    description: 'Urgences médicales, réparations et dépenses non budgétées',
  },
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({ categories, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportJson = () => {
    window.open('/api/backup/export/json', '_blank');
  };

  const handleExportDb = () => {
    window.open('/api/backup/export/db', '_blank');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(json),
      });

      const data = await res.json();
      if (res.ok) {
        setImportStatus({ success: true, message: data.message || 'Sauvegarde restaurée avec succès !' });
        onRefresh();
      } else {
        setImportStatus({ success: false, message: data.error || 'Erreur lors de l\'import' });
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: 'Fichier JSON invalide : ' + err.message });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec Actions Globales (Ajout + Sauvegardes) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Structure & Catégories</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
              {categories.length} catégories
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personnalisez vos catégories et sauvegardez ou restaurez vos données en un clic.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Import JSON (C2) */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer border border-slate-700 transition-colors">
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isImporting ? 'Restauration...' : 'Restaurer JSON'}</span>
            <input
              type="file"
              accept=".json"
              disabled={isImporting}
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExportJson}
            title="Exporter en JSON"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleExportDb}
            title="Télécharger la base SQLite"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export SQLite</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle catégorie</span>
          </button>
        </div>
      </div>

      {/* Message de confirmation d'import */}
      {importStatus && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-lg text-xs flex items-center gap-2.5 ${
            importStatus.success
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}
        >
          {importStatus.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* Sections budgétaires avec CategoryCard (N2) */}
      <div className="space-y-6">
        {TYPE_CONFIG.map(({ type, label, description }) => {
          const typeCategories = categories.filter((c) => c.type === type);
          return (
            <div key={type} className="space-y-3">
              <div className="border-b border-slate-800/80 pb-2">
                <h3 className="text-sm font-bold text-slate-200">{label}</h3>
                <p className="text-[11px] text-slate-400">{description}</p>
              </div>

              {typeCategories.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500 italic">
                  Aucune catégorie configurée pour cette section.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {typeCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modale d'ajout de catégorie (E1) */}
      <NewCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={onRefresh}
      />
    </div>
  );
};
