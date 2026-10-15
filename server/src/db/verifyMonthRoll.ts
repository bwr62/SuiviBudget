import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import crypto from 'crypto';

console.log('🧪 Lancement du test de report multi-mois et date...');

const sept = '2099-09';
const oct = '2099-10';

// Nettoyage préalable
db.prepare('DELETE FROM transactions WHERE month_year IN (?, ?)').run(sept, oct);
db.prepare('DELETE FROM monthly_balances WHERE month_year IN (?, ?)').run(sept, oct);
db.prepare("DELETE FROM recurring_templates WHERE title LIKE 'Test Multi Mois%'").run();

const catRec = db.prepare("SELECT id FROM categories WHERE type = 'RECURRING_EXPENSE' LIMIT 1").get() as { id: string };

// 1. Créer une transaction en septembre avec récurrence (simulant l'API /transactions avec is_recurring = true)
const templateId = crypto.randomUUID();
db.prepare(`
  INSERT INTO recurring_templates (id, title, amount, type, category_id, day_of_month, status, carry_over)
  VALUES (?, 'Test Multi Mois Internet', 45.00, 'RECURRING_EXPENSE', ?, 12, 'ACTIVE', 1)
`).run(templateId, catRec.id);

db.prepare(`
  INSERT INTO transactions (id, template_id, month_year, date, title, amount, type, category_id, status, is_carried_over)
  VALUES (?, ?, ?, '2099-09-12', 'Test Multi Mois Internet', 45.00, 'RECURRING_EXPENSE', ?, 'ACTIVE', 0)
`).run(crypto.randomUUID(), templateId, sept, catRec.id);

// 2. Synchroniser octobre
rolloverService.initializeOrSyncMonth(oct, false);

// 3. Vérifier que la transaction a bien été clonée sur octobre
const octTx = db.prepare('SELECT * FROM transactions WHERE month_year = ? AND template_id = ?').get(oct, templateId) as any;
if (!octTx) {
  throw new Error('[FAIL] La dépense de septembre ne s\'est pas répétée sur octobre !');
}

if (octTx.date !== '2099-10-12' || octTx.amount !== 45.00 || octTx.status !== 'ACTIVE') {
  throw new Error(`[FAIL] Détails de la transaction répliquée invalides : ${JSON.stringify(octTx)}`);
}

console.log('✅ Test validé : La dépense récurrente saisie sur septembre se reporte bien sur octobre avec le statut Actif et le jour 12 !');

// Nettoyage
db.prepare('DELETE FROM transactions WHERE month_year IN (?, ?)').run(sept, oct);
db.prepare('DELETE FROM monthly_balances WHERE month_year IN (?, ?)').run(sept, oct);
db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(templateId);

console.log('🎉 Succès total.');
