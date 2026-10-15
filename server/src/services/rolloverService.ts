import Database from 'better-sqlite3';
import { db } from '../db/index.js';

export interface MonthlySummary {
  monthYear: string;
  carriedOverFromPrevious: number;
  totalIncome: number;
  totalActiveExpenses: number;
  byType: {
    recurring: number;
    current: number;
    unforeseen: number;
  };
  totalPendingExpenses: number; // Flaggées "En attente" (Strictement HORS total calculé !)
  netBalance: number;           // Reste à vivre réel (Revenus - Dépenses Actives + Report)
}

export class RolloverEngine {
  constructor(private database: Database.Database = db) {}

  /**
   * Calcule une date valide dans le mois pour éviter les débordements (ex: jour 31 en Février -> 28/29)
   */
  public computeValidDate(monthYear: string, dayOfMonth: number): string {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const maxDaysInMonth = new Date(year, month, 0).getDate();
    const safeDay = Math.min(Math.max(1, dayOfMonth), maxDaysInMonth);
    return `${monthYear}-${String(safeDay).padStart(2, '0')}`;
  }

  /**
   * Calcule le mois précédent au format 'YYYY-MM'
   */
  public getPreviousMonthYear(monthYear: string): string {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }

  /**
   * 1. MOTEUR DE REPORT AUTOMATIQUE (Exécuté dans une transaction SQLite ACID)
   * Génère les opérations récurrentes et configure les soldes mensuels de façon idempotente.
   */
  public initializeOrSyncMonth(monthYear: string, autoCarryOverBalance = false): void {
    const syncTransaction = this.database.transaction(() => {
      // A. Mettre à jour ou insérer l'entrée monthly_balances pour ce mois
      // Si autoCarryOverBalance est actif : on calcule le solde net de M-1
      // Si autoCarryOverBalance est inactif : carried_over_from_previous vaut 0
      let carriedOverAmount = 0;
      if (autoCarryOverBalance) {
        const prevMonth = this.getPreviousMonthYear(monthYear);
        const prevSummary = this.getMonthlySummary(prevMonth);
        carriedOverAmount = prevSummary.netBalance;
      }

      const existingBalance = this.database
        .prepare(`SELECT month_year, is_closed FROM monthly_balances WHERE month_year = ?`)
        .get(monthYear) as { month_year: string; is_closed: number } | undefined;

      if (!existingBalance) {
        this.database
          .prepare(`
            INSERT INTO monthly_balances (month_year, carried_over_from_previous, is_closed)
            VALUES (?, ?, 0)
          `)
          .run(monthYear, carriedOverAmount);
      } else if (!existingBalance.is_closed) {
        // Mois non clôturé : synchroniser le report en temps réel selon la valeur de la case à cocher
        this.database
          .prepare(`
            UPDATE monthly_balances 
            SET carried_over_from_previous = ? 
            WHERE month_year = ?
          `)
          .run(carriedOverAmount, monthYear);
      }

      // B. Récupérer tous les modèles qui doivent se répéter (carry_over = 1)
      // et dont la date de fin n'est pas échue (end_month_year IS NULL OR end_month_year >= monthYear)
      // Note : Les dépenses imprévues (UNFORESEEN_EXPENSE) ne sont JAMAIS dans recurring_templates.
      const templates = this.database
        .prepare(`
          SELECT id, title, amount, type, category_id, subcategory_id, day_of_month, status, end_month_year
          FROM recurring_templates
          WHERE carry_over = 1
            AND (end_month_year IS NULL OR end_month_year >= ?)
        `)
        .all(monthYear) as Array<{
          id: string;
          title: string;
          amount: number;
          type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
          category_id: string;
          subcategory_id: string | null;
          day_of_month: number;
          status: 'ACTIVE' | 'PENDING_PAUSED';
          end_month_year: string | null;
        }>;

      const insertTxStmt = this.database.prepare(`
        INSERT OR IGNORE INTO transactions (
          id, template_id, month_year, date, title, amount, type,
          category_id, subcategory_id, status, is_carried_over, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);

      for (const tpl of templates) {
        const txDate = this.computeValidDate(monthYear, tpl.day_of_month);
        // Si le template est en pause mais avec report maintenu, il apparaît directement en 'PENDING'
        const initialStatus = tpl.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING';

        insertTxStmt.run(
          crypto.randomUUID(),
          tpl.id,
          monthYear,
          txDate,
          tpl.title,
          tpl.amount,
          tpl.type,
          tpl.category_id,
          tpl.subcategory_id,
          initialStatus,
          'Généré automatiquement par report mensuel'
        );
      }
    });

    syncTransaction();
  }

  /**
   * 1.B PROPAGATION TEMPORELLE & MODIFICATION AVEC PORTÉE (SCOPE)
   * Loi d'intégrité historique : JAMAIS de modification sur les mois passés (< currentMonthYear).
   */
  public updateTransactionWithScope(params: {
    transactionId: string;
    data: {
      amount?: number;
      title?: string;
      category_id?: string;
      subcategory_id?: string | null;
      date?: string;
      notes?: string | null;
    };
    scope: 'CURRENT_MONTH_ONLY' | 'CURRENT_AND_FUTURE';
  }): { updatedTxId: string; templateUpdated: boolean; futureCount: number } {
    const { transactionId, data, scope } = params;

    let templateUpdated = false;
    let futureCount = 0;

    const runScopedUpdate = this.database.transaction(() => {
      const currentTx = this.database
        .prepare('SELECT * FROM transactions WHERE id = ?')
        .get(transactionId) as any;

      if (!currentTx) {
        throw new Error(`Transaction introuvable: ${transactionId}`);
      }

      // 1. Mettre à jour la transaction du mois courant M
      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          updates.push(`${key} = ?`);
          values.push(val);
        }
      }

      if (data.date && !('month_year' in data)) {
        updates.push('month_year = ?');
        values.push(data.date.substring(0, 7));
      }

      if (updates.length > 0) {
        values.push(transactionId);
        this.database
          .prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`)
          .run(...values);
      }

      // 2. Si portée = CURRENT_AND_FUTURE et rattaché à un recurring_template
      if (scope === 'CURRENT_AND_FUTURE' && currentTx.template_id) {
        const tplUpdates: string[] = [];
        const tplValues: any[] = [];

        if (data.amount !== undefined) {
          tplUpdates.push('amount = ?');
          tplValues.push(data.amount);
        }
        if (data.title !== undefined) {
          tplUpdates.push('title = ?');
          tplValues.push(data.title);
        }
        if (data.category_id !== undefined) {
          tplUpdates.push('category_id = ?');
          tplValues.push(data.category_id);
        }
        if (data.subcategory_id !== undefined) {
          tplUpdates.push('subcategory_id = ?');
          tplValues.push(data.subcategory_id);
        }

        if (tplUpdates.length > 0) {
          tplValues.push(currentTx.template_id);
          this.database
            .prepare(`UPDATE recurring_templates SET ${tplUpdates.join(', ')} WHERE id = ?`)
            .run(...tplValues);
          templateUpdated = true;
        }

        // Mettre à jour les transactions pré-générées STRICTEMENT sur les mois futurs (>= currentMonthYear)
        // LOI D'INTÉGRITÉ : On ne touche jamais aux mois passés (< currentTx.month_year)
        const futureUpdates: string[] = [];
        const futureValues: any[] = [];

        if (data.amount !== undefined) {
          futureUpdates.push('amount = ?');
          futureValues.push(data.amount);
        }
        if (data.title !== undefined) {
          futureUpdates.push('title = ?');
          futureValues.push(data.title);
        }

        if (futureUpdates.length > 0) {
          futureValues.push(currentTx.template_id);
          futureValues.push(currentTx.month_year);

          const result = this.database
            .prepare(`
              UPDATE transactions 
              SET ${futureUpdates.join(', ')}
              WHERE template_id = ? AND month_year >= ?
            `)
            .run(...futureValues);
          futureCount = result.changes;
        }
      }
    });

    runScopedUpdate();
    return { updatedTxId: transactionId, templateUpdated, futureCount };
  }

  /**
   * 2. BASCULE ACTIF / EN ATTENTE ("PENDING") & CONTRÔLE DE RÉPÉTITION
   */
  public toggleTransactionStatus(params: {
    transactionId: string;
    newStatus: 'ACTIVE' | 'PENDING';
    stopFutureRepetitions?: boolean;
  }): void {
    const { transactionId, newStatus, stopFutureRepetitions } = params;

    const updateTx = this.database.transaction(() => {
      const tx = this.database
        .prepare(`SELECT id, template_id, type FROM transactions WHERE id = ?`)
        .get(transactionId) as { id: string; template_id: string | null; type: string } | undefined;

      if (!tx) {
        throw new Error(`Transaction introuvable : ${transactionId}`);
      }

      // 1. Mise à jour immédiate sur le mois courant
      this.database
        .prepare(`UPDATE transactions SET status = ? WHERE id = ?`)
        .run(newStatus, transactionId);

      // 2. Si la dépense est issue d'un template récurrent
      if (tx.template_id && tx.type !== 'UNFORESEEN_EXPENSE') {
        if (newStatus === 'PENDING' && stopFutureRepetitions) {
          this.database
            .prepare(`
              UPDATE recurring_templates 
              SET status = 'PENDING_PAUSED', carry_over = 0 
              WHERE id = ?
            `)
            .run(tx.template_id);
        } else if (newStatus === 'ACTIVE') {
          this.database
            .prepare(`
              UPDATE recurring_templates 
              SET status = 'ACTIVE', carry_over = 1 
              WHERE id = ?
            `)
            .run(tx.template_id);
        }
      }
    });

    updateTx();
  }

  /**
   * 3. CALCUL DES TOTAUX DU MOIS (AVEC EXCLUSION STRICTE DES "PENDING")
   */
  public getMonthlySummary(monthYear: string): MonthlySummary {
    const balanceRow = this.database
      .prepare(`SELECT carried_over_from_previous FROM monthly_balances WHERE month_year = ?`)
      .get(monthYear) as { carried_over_from_previous: number } | undefined;

    const carriedOverFromPrevious = balanceRow?.carried_over_from_previous ?? 0;

    const stats = this.database
      .prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'INCOME' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'RECURRING_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as active_recurring,
          COALESCE(SUM(CASE WHEN type = 'CURRENT_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as active_current,
          COALESCE(SUM(CASE WHEN type = 'UNFORESEEN_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as active_unforeseen,
          COALESCE(SUM(CASE WHEN type != 'INCOME' AND status = 'PENDING' THEN amount ELSE 0 END), 0) as total_pending_expenses
        FROM transactions
        WHERE month_year = ?
      `)
      .get(monthYear) as {
        total_income: number;
        active_recurring: number;
        active_current: number;
        active_unforeseen: number;
        total_pending_expenses: number;
      };

    const totalActiveExpenses =
      stats.active_recurring + stats.active_current + stats.active_unforeseen;

    const netBalance =
      carriedOverFromPrevious + stats.total_income - totalActiveExpenses;

    return {
      monthYear,
      carriedOverFromPrevious,
      totalIncome: stats.total_income,
      totalActiveExpenses,
      byType: {
        recurring: stats.active_recurring,
        current: stats.active_current,
        unforeseen: stats.active_unforeseen,
      },
      totalPendingExpenses: stats.total_pending_expenses,
      netBalance,
    };
  }
}

export const rolloverService = new RolloverEngine(db);
