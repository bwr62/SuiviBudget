import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import crypto from 'crypto';

console.log('🧪 Lancement de la suite de tests de validation (Rollover Engine & Règles Métier)...');

// Nettoyer d'éventuelles données résiduelles de test pour un mois isolé
const testMonth = '2099-01';
db.prepare('DELETE FROM transactions WHERE month_year = ?').run(testMonth);
db.prepare('DELETE FROM monthly_balances WHERE month_year = ?').run(testMonth);

// 1. Test de l'idempotence et du clonage des templates
const testCat = db.prepare("SELECT id FROM categories WHERE type = 'RECURRING_EXPENSE' LIMIT 1").get() as { id: string };
const templateId = 'tpl-test-' + crypto.randomUUID().substring(0, 8);

db.prepare(`
  INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
  VALUES (?, 'Abonnement Internet Test', 39.99, 'RECURRING_EXPENSE', ?, 5, 'ACTIVE', 1)
`).run(templateId, testCat.id);

// Première initialisation
rolloverService.initializeOrSyncMonth(testMonth, false);
let txCount = (db.prepare('SELECT count(*) as c FROM transactions WHERE month_year = ? AND template_id = ?').get(testMonth, templateId) as { c: number }).c;
if (txCount !== 1) {
  throw new Error(`[FAIL] Attendu 1 transaction générée pour le template, obtenu: ${txCount}`);
}

// Deuxième initialisation (Doit être strictement idempotente : 0 doublon créé)
rolloverService.initializeOrSyncMonth(testMonth, false);
txCount = (db.prepare('SELECT count(*) as c FROM transactions WHERE month_year = ? AND template_id = ?').get(testMonth, templateId) as { c: number }).c;
if (txCount !== 1) {
  throw new Error(`[FAIL] Règle d'idempotence violée : doublons détectés (${txCount})`);
}
console.log('✅ Test 1 réussi : Idempotence stricte du moteur de report.');

// 2. Test d'exclusion des statuts PENDING dans les calculs
const incomeCat = db.prepare("SELECT id FROM categories WHERE type = 'INCOME' LIMIT 1").get() as { id: string };
const txActiveId = crypto.randomUUID();
const txPendingId = crypto.randomUUID();

// Revenu : 2000 €
db.prepare(`
  INSERT INTO transactions (id, month_year, date, title, amount, type, category_id, status, is_carried_over)
  VALUES (?, ?, '2099-01-01', 'Salaire Test', 2000.00, 'INCOME', ?, 'ACTIVE', 0)
`).run(crypto.randomUUID(), testMonth, incomeCat.id);

// Dépense courante Active : 100 €
db.prepare(`
  INSERT INTO transactions (id, month_year, date, title, amount, type, category_id, status, is_carried_over)
  VALUES (?, ?, '2099-01-02', 'Courses Actives', 100.00, 'CURRENT_EXPENSE', ?, 'ACTIVE', 0)
`).run(txActiveId, testMonth, testCat.id);

// Dépense courante PENDING : 500 € (Strictement exclue des calculs de dépenses et reste à vivre)
db.prepare(`
  INSERT INTO transactions (id, month_year, date, title, amount, type, category_id, status, is_carried_over)
  VALUES (?, ?, '2099-01-03', 'Dépense Suspendue', 500.00, 'CURRENT_EXPENSE', ?, 'PENDING', 0)
`).run(txPendingId, testMonth, testCat.id);

const summary = rolloverService.getMonthlySummary(testMonth);

// Vérifications :
// Total dépenses actives attendu = 39.99 (abonnement récurrent) + 100.00 (courses) = 139.99
// Total dépenses en attente = 500.00
// Reste à vivre attendu = 2000.00 - 139.99 = 1860.01 (Le 500€ NE DOIT PAS être déduit)
if (Math.abs(summary.totalActiveExpenses - 139.99) > 0.001) {
  throw new Error(`[FAIL] Total dépenses actives erroné : attendu 139.99, obtenu ${summary.totalActiveExpenses}`);
}
if (Math.abs(summary.totalPendingExpenses - 500.00) > 0.001) {
  throw new Error(`[FAIL] Total dépenses en attente erroné : attendu 500.00, obtenu ${summary.totalPendingExpenses}`);
}
if (Math.abs(summary.netBalance - 1860.01) > 0.001) {
  throw new Error(`[FAIL] Reste à vivre erroné : attendu 1860.01, obtenu ${summary.netBalance}`);
}

console.log('✅ Test 2 réussi : Règle métier critique d\'exclusion stricte de PENDING validée.');

// 3. Test de bascule de statut (Toggle)
rolloverService.toggleTransactionStatus({
  transactionId: txActiveId,
  newStatus: 'PENDING',
});

const summaryAfterToggle = rolloverService.getMonthlySummary(testMonth);
if (Math.abs(summaryAfterToggle.totalActiveExpenses - 39.99) > 0.001) {
  throw new Error(`[FAIL] Toggle vers PENDING erroné : attendu 39.99, obtenu ${summaryAfterToggle.totalActiveExpenses}`);
}
if (Math.abs(summaryAfterToggle.totalPendingExpenses - 600.00) > 0.001) {
  throw new Error(`[FAIL] Enveloppe PENDING après toggle erronée : attendu 600.00, obtenu ${summaryAfterToggle.totalPendingExpenses}`);
}

console.log('✅ Test 3 réussi : Bascule dynamique et recalcul instantané des totaux.');

// Nettoyage des données de test
db.prepare('DELETE FROM transactions WHERE month_year = ?').run(testMonth);
db.prepare('DELETE FROM monthly_balances WHERE month_year = ?').run(testMonth);
db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(templateId);

console.log('🎉 Tous les tests unitaires et d\'intégration sont validés avec succès !');
