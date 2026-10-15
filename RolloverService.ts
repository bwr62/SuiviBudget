// Fichier cible : server/src/services/rolloverService.ts
import Database from 'better-sqlite3';
import crypto from 'crypto';

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
  totalPendingExpenses: number; // Flaggées "En attente" (Hors total !)
  netBalance: number;           // Reste à vivre réel
}

export class RolloverEngine {
  constructor(private db: Database.Database) {
    this.ensureIndexes();
  }

  /**
   * Garantit au niveau SQL qu'un modèle récurrent ne puisse JAMAIS être
   * généré deux fois pour un même mois (Idempotence stricte).
   */
  private ensureIndexes(): void {
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_template_per_month 
      ON transactions(template_id, month_year) 
      WHERE template_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_transactions_month_status 
      ON transactions(month_year, status);
    `);
  }

  /**
   * Calcule une date valide (ex: jour 31 en Février -> 28 ou 29 Février)
   */
  private computeValidDate(monthYear: string, dayOfMonth: number): string {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    // Le jour 0 du mois suivant donne le dernier jour du mois courant
    const maxDaysInMonth = new Date(year, month, 0).getDate();
    const safeDay = Math.min(Math.max(1, dayOfMonth), maxDaysInMonth);
    return `${monthYear}-${String(safeDay).padStart(2, '0')}`;
  }

  /**
   * Calcule le mois précédent au format 'YYYY-MM'
   */
  private getPreviousMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }

  /**
   * 1. MOTEUR DE REPORT AUTOMATIQUE (Exécuté dans une transaction SQLite ACID)
   * Génère les opérations récurrentes et reporte les dépenses/soldes sur le mois demandé.
   */
  public initializeOrSyncMonth(monthYear: string, autoCarryOverBalance = false): void {
    const syncTransaction = this.db.transaction(() => {
      // A. S'assurer que l'entrée monthly_balances existe pour ce mois
      const existingBalance = this.db
        .prepare(`SELECT month_year FROM monthly_balances WHERE month_year = ?`)
        .get(monthYear);

      if (!existingBalance) {
        let carriedOverAmount = 0;
        if (autoCarryOverBalance) {
          const prevMonth = this.getPreviousMonthYear(monthYear);
          const prevSummary = this.getMonthlySummary(prevMonth);
          carriedOverAmount = prevSummary.netBalance;
        }

        this.db
          .prepare(`
            INSERT INTO monthly_balances (month_year, carried_over_from_previous, is_closed)
            VALUES (?, ?, 0)
          `)
          .run(monthYear, carriedOverAmount);
      }

      // B. Récupérer tous les modèles qui doivent se répéter (carry_over = 1)
      // Note : Les dépenses UNFORESEEN_EXPENSE ne sont jamais dans recurring_templates.
      const templates = this.db
        .prepare(`
          SELECT id, title, amount, type, category_id, subcategory_id, day_of_month, status
          FROM recurring_templates
          WHERE carry_over = 1
        `)
        .all() as Array<{
          id: string;
          title: string;
          amount: number;
          type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE';
          category_id: string;
          subcategory_id: string | null;
          day_of_month: number;
          status: 'ACTIVE' | 'PENDING_PAUSED';
        }>;

      const insertTxStmt = this.db.prepare(`
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
   * 2. BASCULE ACTIF / EN ATTENTE ("PENDING") & CONTRÔLE DE RÉPÉTITION
   * Permet de désactiver une dépense (la passe en "En attente" hors total),
   * de couper sa répétition future, ou de la réactiver à tout moment.
   */
  public toggleTransactionStatus(params: {
    transactionId: string;
    newStatus: 'ACTIVE' | 'PENDING';
    stopFutureRepetitions?: boolean; // Si true, ne se répètera plus sur les mois M+1
  }): void {
    const { transactionId, newStatus, stopFutureRepetitions } = params;

    const updateTx = this.db.transaction(() => {
      const tx = this.db
        .prepare(`SELECT id, template_id, type FROM transactions WHERE id = ?`)
        .get(transactionId) as { id: string; template_id: string | null; type: string } | undefined;

      if (!tx) {
        throw new Error(`Transaction introuvable : ${transactionId}`);
      }

      // 1. Mise à jour immédiate de la dépense sur le mois courant
      this.db
        .prepare(`UPDATE transactions SET status = ? WHERE id = ?`)
        .run(newStatus, transactionId);

      // 2. Si la dépense est liée à un modèle récurrent, on met à jour la règle de répétition
      if (tx.template_id && tx.type !== 'UNFORESEEN_EXPENSE') {
        if (newStatus === 'PENDING' && stopFutureRepetitions) {
          // Désactivée et non répétée sur les prochains mois (mais conservée pour réactivation future)
          this.db
            .prepare(`
              UPDATE recurring_templates 
              SET status = 'PENDING_PAUSED', carry_over = 0 
              WHERE id = ?
            `)
            .run(tx.template_id);
        } else if (newStatus === 'ACTIVE') {
          // Réactivation à tout moment : reprend son statut actif et sa répétition mensuelle
          this.db
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
    const balanceRow = this.db
      .prepare(`SELECT carried_over_from_previous FROM monthly_balances WHERE month_year = ?`)
      .get(monthYear) as { carried_over_from_previous: number } | undefined;

    const carriedOverFromPrevious = balanceRow?.carried_over_from_previous ?? 0;

    // Agrégation SQL en une seule passe avec séparation stricte ACTIVE vs PENDING
    const stats = this.db
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
      totalPendingExpenses: stats.total_pending_expenses, // Affiché à part dans le badge "En attente"
      netBalance,
    };
  }
}