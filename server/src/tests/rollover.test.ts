import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { DDL_SCHEMA } from '../db/schema.js';
import { RolloverEngine } from '../services/rolloverService.js';

describe('RolloverEngine Unit Tests', () => {
  let inMemoryDb: Database.Database;
  let engine: RolloverEngine;

  beforeEach(() => {
    inMemoryDb = new Database(':memory:');
    inMemoryDb.pragma('foreign_keys = ON');
    inMemoryDb.exec(DDL_SCHEMA);
    engine = new RolloverEngine(inMemoryDb);

    // Initialiser les catégories et utilisateur de base pour les tests
    inMemoryDb.prepare(`
      INSERT INTO users (id, username, recovery_hash)
      VALUES ('default_user', 'TestUser', 'hash123')
    `).run();

    inMemoryDb.prepare(`
      INSERT INTO categories (id, name, type, icon, color, is_system, is_active)
      VALUES 
        ('cat-income', 'Revenus', 'INCOME', 'Briefcase', '#10B981', 1, 1),
        ('cat-rent', 'Logement', 'RECURRING_EXPENSE', 'Home', '#6366F1', 1, 1),
        ('cat-food', 'Alimentation', 'CURRENT_EXPENSE', 'ShoppingCart', '#F59E0B', 1, 1)
    `).run();
  });

  describe('Date Calculation Utilities', () => {
    it('computeValidDate should clamp days to max days in month', () => {
      // Février 2026 a 28 jours
      assert.equal(engine.computeValidDate('2026-02', 31), '2026-02-28');
      assert.equal(engine.computeValidDate('2026-02', 29), '2026-02-28');
      // Avril a 30 jours
      assert.equal(engine.computeValidDate('2026-04', 31), '2026-04-30');
      // Jour standard
      assert.equal(engine.computeValidDate('2026-10', 15), '2026-10-15');
      // Jour inférieur à 1
      assert.equal(engine.computeValidDate('2026-10', 0), '2026-10-01');
    });

    it('getPreviousMonthYear should return correct previous month across year boundaries', () => {
      assert.equal(engine.getPreviousMonthYear('2026-10'), '2026-09');
      assert.equal(engine.getPreviousMonthYear('2026-01'), '2025-12');
      assert.equal(engine.getPreviousMonthYear('2025-12'), '2025-11');
    });
  });

  describe('Month Initialization & Synchronization (Idempotency)', () => {
    it('should generate transactions from recurring templates without duplication upon multiple calls', () => {
      // Ajouter un modèle de revenu et un modèle de loyer
      inMemoryDb.prepare(`
        INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
        VALUES 
          ('tpl-salary', 'Salaire', 2500.00, 'INCOME', 'cat-income', 1, 'ACTIVE', 1),
          ('tpl-rent', 'Loyer', 800.00, 'RECURRING_EXPENSE', 'cat-rent', 5, 'ACTIVE', 1)
      `).run();

      // Première initialisation
      engine.initializeOrSyncMonth('2026-10', false);

      const txsFirstRun = inMemoryDb.prepare('SELECT * FROM transactions WHERE month_year = ?').all('2026-10');
      assert.equal(txsFirstRun.length, 2);

      const summary1 = engine.getMonthlySummary('2026-10');
      assert.equal(summary1.totalIncome, 2500);
      assert.equal(summary1.totalActiveExpenses, 800);
      assert.equal(summary1.netBalance, 1700);

      // Deuxième appel idempotent (ne doit pas doubler les transactions)
      engine.initializeOrSyncMonth('2026-10', false);

      const txsSecondRun = inMemoryDb.prepare('SELECT * FROM transactions WHERE month_year = ?').all('2026-10');
      assert.equal(txsSecondRun.length, 2);

      const summary2 = engine.getMonthlySummary('2026-10');
      assert.equal(summary2.totalIncome, 2500);
      assert.equal(summary2.totalActiveExpenses, 800);
      assert.equal(summary2.netBalance, 1700);
    });
  });

  describe('Pending Expenses Strict Exclusion', () => {
    it('should strictly exclude PENDING expenses from active expenses and include in totalPendingExpenses', () => {
      inMemoryDb.prepare(`
        INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
        VALUES 
          ('tpl-sal', 'Salaire', 3000.00, 'INCOME', 'cat-income', 1, 'ACTIVE', 1),
          ('tpl-bill1', 'Abonnement Gym', 50.00, 'RECURRING_EXPENSE', 'cat-rent', 10, 'ACTIVE', 1),
          ('tpl-bill2', 'Internet', 40.00, 'RECURRING_EXPENSE', 'cat-rent', 12, 'ACTIVE', 1)
      `).run();

      engine.initializeOrSyncMonth('2026-10', false);

      // Trouver la transaction gym et la passer en PENDING
      const gymTx = inMemoryDb.prepare(`
        SELECT id FROM transactions WHERE title = 'Abonnement Gym' AND month_year = '2026-10'
      `).get() as { id: string };

      engine.toggleTransactionStatus({
        transactionId: gymTx.id,
        newStatus: 'PENDING',
        stopFutureRepetitions: false,
      });

      const summary = engine.getMonthlySummary('2026-10');
      // Seul Internet (40€) doit être dans les dépenses actives
      assert.equal(summary.totalActiveExpenses, 40.00);
      // Gym (50€) doit être dans totalPendingExpenses
      assert.equal(summary.totalPendingExpenses, 50.00);
      // Reste à vivre net = 3000 - 40 = 2960€
      assert.equal(summary.netBalance, 2960.00);
    });
  });

  describe('Scope Toggling & Update', () => {
    it('should pause future template when stopFutureRepetitions is true', () => {
      inMemoryDb.prepare(`
        INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
        VALUES ('tpl-mag', 'Magazine', 15.00, 'RECURRING_EXPENSE', 'cat-rent', 5, 'ACTIVE', 1)
      `).run();

      engine.initializeOrSyncMonth('2026-10', false);

      const tx = inMemoryDb.prepare(`
        SELECT id FROM transactions WHERE title = 'Magazine' AND month_year = '2026-10'
      `).get() as { id: string };

      // Toggle en attente avec répercussion sur les mois futurs
      engine.toggleTransactionStatus({
        transactionId: tx.id,
        newStatus: 'PENDING',
        stopFutureRepetitions: true,
      });

      // Vérifier le statut de la transaction
      const updatedTx = inMemoryDb.prepare('SELECT status FROM transactions WHERE id = ?').get(tx.id) as { status: string };
      assert.equal(updatedTx.status, 'PENDING');

      // Vérifier que le template parent est passé en PENDING_PAUSED
      const template = inMemoryDb.prepare('SELECT status FROM recurring_templates WHERE id = ?').get('tpl-mag') as { status: string };
      assert.equal(template.status, 'PENDING_PAUSED');
    });

    it('should update amount with scope CURRENT_AND_FUTURE', () => {
      inMemoryDb.prepare(`
        INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
        VALUES ('tpl-rent', 'Loyer', 750.00, 'RECURRING_EXPENSE', 'cat-rent', 5, 'ACTIVE', 1)
      `).run();

      engine.initializeOrSyncMonth('2026-10', false);

      const tx = inMemoryDb.prepare(`
        SELECT id FROM transactions WHERE title = 'Loyer' AND month_year = '2026-10'
      `).get() as { id: string };

      // Augmentation de loyer à 800€ répercutée
      engine.updateTransactionWithScope({
        transactionId: tx.id,
        data: { amount: 800.00 },
        scope: 'CURRENT_AND_FUTURE',
      });

      const updatedTx = inMemoryDb.prepare('SELECT amount FROM transactions WHERE id = ?').get(tx.id) as { amount: number };
      assert.equal(updatedTx.amount, 800.00);

      const updatedTpl = inMemoryDb.prepare('SELECT amount FROM recurring_templates WHERE id = ?').get('tpl-rent') as { amount: number };
      assert.equal(updatedTpl.amount, 800.00);
    });
  });

  describe('M-1 Report (Carry-Over Balance)', () => {
    it('should carry over net balance from previous month when enabled', () => {
      // Mois 1: Octobre 2026
      inMemoryDb.prepare(`
        INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
        VALUES 
          ('tpl-sal', 'Salaire', 2000.00, 'INCOME', 'cat-income', 1, 'ACTIVE', 1),
          ('tpl-rent', 'Loyer', 600.00, 'RECURRING_EXPENSE', 'cat-rent', 5, 'ACTIVE', 1)
      `).run();

      engine.initializeOrSyncMonth('2026-10', false);
      const octSummary = engine.getMonthlySummary('2026-10');
      assert.equal(octSummary.netBalance, 1400.00);

      // Mois 2: Novembre 2026 avec report de M-1 activé
      engine.initializeOrSyncMonth('2026-11', true);
      const novSummary = engine.getMonthlySummary('2026-11');

      assert.equal(novSummary.carriedOverFromPrevious, 1400.00);
      assert.equal(novSummary.totalIncome, 2000.00);
      assert.equal(novSummary.totalActiveExpenses, 600.00);
      // Reste à vivre net = 1400 (report) + 2000 (revenus) - 600 (dépenses) = 2800.00
      assert.equal(novSummary.netBalance, 2800.00);
    });
  });

  describe('Category Budgets & Savings Goals', () => {
    it('should respect category budget limits and track consumption', () => {
      // Définir un plafond de 300€ sur l'alimentation
      inMemoryDb.prepare('UPDATE categories SET budget_limit = 300 WHERE id = ?').run('cat-food');

      const cat = inMemoryDb.prepare('SELECT budget_limit FROM categories WHERE id = ?').get('cat-food') as { budget_limit: number };
      assert.equal(cat.budget_limit, 300);

      // Ajouter 2 dépenses alimentaires actives
      inMemoryDb.prepare(`
        INSERT INTO transactions (id, month_year, date, title, amount, type, category_id, status)
        VALUES 
          ('tx-f1', '2026-10', '2026-10-02', 'Supermarché 1', 120.00, 'CURRENT_EXPENSE', 'cat-food', 'ACTIVE'),
          ('tx-f2', '2026-10', '2026-10-15', 'Supermarché 2', 150.00, 'CURRENT_EXPENSE', 'cat-food', 'ACTIVE')
      `).run();

      const totalSpent = inMemoryDb.prepare(`
        SELECT SUM(amount) as total FROM transactions WHERE category_id = 'cat-food' AND status = 'ACTIVE'
      `).get() as { total: number };

      assert.equal(totalSpent.total, 270.00);
      assert.equal(totalSpent.total <= cat.budget_limit, true);
    });

    it('should correctly allocate savings and update goal balances', () => {
      // Créer un objectif d'épargne Vacances
      inMemoryDb.prepare(`
        INSERT INTO savings_goals (id, title, target_amount, current_amount, color)
        VALUES ('goal-holidays', 'Vacances été', 1500.00, 200.00, '#10B981')
      `).run();

      // Allocation de 300€
      const allocAmount = 300.00;
      inMemoryDb.prepare(`
        INSERT INTO savings_allocations (id, goal_id, month_year, amount, date)
        VALUES ('alloc-1', 'goal-holidays', '2026-10', ?, '2026-10-15')
      `).run(allocAmount);

      inMemoryDb.prepare(`
        UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = 'goal-holidays'
      `).run(allocAmount);

      const goal = inMemoryDb.prepare('SELECT current_amount, target_amount FROM savings_goals WHERE id = ?').get('goal-holidays') as {
        current_amount: number;
        target_amount: number;
      };

      assert.equal(goal.current_amount, 500.00);
      assert.equal(goal.target_amount, 1500.00);
    });
  });
});
