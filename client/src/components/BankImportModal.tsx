import React, { useState } from 'react';
import { Upload, FileText, Check, X } from 'lucide-react';
import { Category } from '../types';
import { showToast } from '../store/useToastStore';

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currentMonthYear: string;
  onImportSuccess: () => void;
}

interface ParsedRow {
  date: string;
  rawLabel: string;
  amount: number;
  type: 'INCOME' | 'CURRENT_EXPENSE';
  suggestedCategoryId: string;
}

export const BankImportModal: React.FC<BankImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  currentMonthYear,
  onImportSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Auto-catégorisation basique par mots-clés
  const guessCategory = (label: string, isIncome: boolean): string => {
    const l = label.toLowerCase();
    if (isIncome) {
      const inc = categories.find((c) => c.type === 'INCOME');
      return inc ? inc.id : categories[0]?.id || '';
    }

    if (l.includes('carrefour') || l.includes('auchan') || l.includes('leclerc') || l.includes('lidl') || l.includes('monoprix')) {
      const food = categories.find((c) => c.name.toLowerCase().includes('alim') || c.name.toLowerCase().includes('courses'));
      if (food) return food.id;
    }

    if (l.includes('total') || l.includes('shell') || l.includes('bp') || l.includes('essence') || l.includes('sncf') || l.includes('ratp')) {
      const transport = categories.find((c) => c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('carburant'));
      if (transport) return transport.id;
    }

    if (l.includes('restaurant') || l.includes('uber') || l.includes('deliveroo') || l.includes('mc donald') || l.includes('burger')) {
      const rest = categories.find((c) => c.name.toLowerCase().includes('resto') || c.name.toLowerCase().includes('sortie'));
      if (rest) return rest.id;
    }

    const currentCat = categories.find((c) => c.type === 'CURRENT_EXPENSE');
    return currentCat ? currentCat.id : categories[0]?.id || '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        alert('Le fichier CSV est vide ou ne contient pas d\'opérations.');
        return;
      }

      const delimiter = lines[0]?.includes(';') ? ';' : ',';
      const parsed: ParsedRow[] = [];

      // Parcourir les lignes (en sautant l'en-tête éventuel)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length < 2) continue;

        // Détection de colonnes typiques de banques (Date, Libellé, Débit, Crédit OU Date, Libellé, Montant)
        let dateStr = cols[0] || '';
        let labelStr = cols[1] || 'Opération importée';
        let amount = 0;
        let isIncome = false;

        // Formater date YYYY-MM-DD
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            // DD/MM/YYYY -> YYYY-MM-DD
            dateStr = `${parts[2]}-${parts[1]?.padStart(2, '0')}-${parts[0]?.padStart(2, '0')}`;
          }
        }

        // Tenter de trouver le montant
        const col2Num = parseFloat((cols[2] || '').replace(',', '.'));
        const col3Num = parseFloat((cols[3] || '').replace(',', '.'));

        if (!isNaN(col3Num) && col3Num !== 0) {
          // Format avec Crédit en col 3
          amount = Math.abs(col3Num);
          isIncome = col3Num > 0;
        } else if (!isNaN(col2Num)) {
          amount = Math.abs(col2Num);
          isIncome = col2Num > 0;
        }

        if (amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          parsed.push({
            date: dateStr,
            rawLabel: labelStr,
            amount,
            type: isIncome ? 'INCOME' : 'CURRENT_EXPENSE',
            suggestedCategoryId: guessCategory(labelStr, isIncome),
          });
        }
      }

      if (parsed.length === 0) {
        alert('Impossible de reconnaître les colonnes bancaires. Vérifiez le format (Date, Libellé, Montant).');
        return;
      }

      setCsvRows(parsed);
      setStep(2);
    } catch (err: any) {
      alert('Erreur lecture CSV : ' + err.message);
    }
  };

  const handleConfirmImport = async () => {
    setIsSubmitting(true);
    try {
      let importedCount = 0;
      for (const row of csvRows) {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            month_year: currentMonthYear,
            date: row.date,
            title: row.rawLabel,
            amount: row.amount,
            type: row.type,
            category_id: row.suggestedCategoryId,
            status: 'ACTIVE',
          }),
        });
        if (res.ok) importedCount++;
      }

      showToast({ message: `${importedCount} transaction(s) importée(s) avec succès !`, type: 'success' });
      onImportSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement des transactions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Importation de Relevé Bancaire (CSV)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4 py-4 text-center">
            <div className="p-6 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/40 hover:border-indigo-500/60 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-200">
                Glissez votre relevé CSV ici ou cliquez pour parcourir
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Compatible BoursoBank, Crédit Agricole, BNP, SG, Revolut, N26, etc.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              <strong className="text-slate-200 font-mono">{csvRows.length}</strong> opération(s) détectée(s). Vérifiez et confirmez l'importation vers <strong className="text-indigo-400">{currentMonthYear}</strong>.
            </p>

            <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Libellé</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Catégorie suggérée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {csvRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 font-mono text-slate-400 text-[11px]">{r.date}</td>
                      <td className="px-3 py-1.5 text-slate-200 truncate max-w-xs">{r.rawLabel}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-semibold ${r.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {r.type === 'INCOME' ? '+' : '-'}{r.amount.toFixed(2)} €
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={r.suggestedCategoryId}
                          onChange={(e) => {
                            const next = [...csvRows];
                            const cur = next[i];
                            if (cur) cur.suggestedCategoryId = e.target.value;
                            setCsvRows(next);
                          }}
                          className="text-[11px] bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Importation en cours...' : `Importer ${csvRows.length} opérations`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
