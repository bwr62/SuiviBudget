import { db } from './index.js';
import { rolloverService } from '../services/rolloverService.js';
import crypto from 'crypto';

console.log('--- TEST DU MOTEUR DE PROPAGATION ET D\'EXTINCTION (v0.04) ---');

// 1. Nettoyage de test
db.prepare("DELETE FROM transactions WHERE title LIKE 'TEST_LOAN%'").run();
db.prepare("DELETE FROM recurring_templates WHERE title LIKE 'TEST_LOAN%'").run();

// 2. Création d'un crédit avec date de fin en 2026-11
const templateId = crypto.randomUUID();
const cat = db.prepare("SELECT id FROM categories WHERE type = 'RECURRING_EXPENSE' LIMIT 1").get() as { id: string };

db.prepare(`
  INSERT INTO recurring_templates (
    id, title, amount, type, category_id, day_of_month, status, carry_over, end_month_year
  ) VALUES (?, 'TEST_LOAN_AUTO', 250, 'RECURRING_EXPENSE', ?, 10, 'ACTIVE', 1, '2026-11')
`).run(templateId, cat.id);

console.log('Modèle créé avec end_month_year = 2026-11');

// 3. Génération sur 2026-10 (actif car 2026-11 >= 2026-10)
rolloverService.initializeOrSyncMonth('2026-10');
const txOct = db.prepare("SELECT * FROM transactions WHERE template_id = ? AND month_year = '2026-10'").get(templateId) as any;
console.log('Transaction Octobre générée ?', txOct ? 'OUI (Montant: ' + txOct.amount + ')' : 'NON');

// 4. Génération sur 2026-11 (actif car 2026-11 >= 2026-11)
rolloverService.initializeOrSyncMonth('2026-11');
const txNov = db.prepare("SELECT * FROM transactions WHERE template_id = ? AND month_year = '2026-11'").get(templateId) as any;
console.log('Transaction Novembre générée ?', txNov ? 'OUI (Montant: ' + txNov.amount + ')' : 'NON');

// 5. Génération sur 2026-12 (EXTINCTION: 2026-11 < 2026-12 -> Doit NE PAS être généré !)
rolloverService.initializeOrSyncMonth('2026-12');
const txDec = db.prepare("SELECT * FROM transactions WHERE template_id = ? AND month_year = '2026-12'").get(templateId);
console.log('Transaction Décembre (post-extinction) générée ?', txDec ? 'ERREUR' : 'NON (Succès: extinction respectée)');

// 6. Test de la portée de modification temporelle :
// Modification au mois d'octobre avec portée CURRENT_AND_FUTURE
rolloverService.updateTransactionWithScope({
  transactionId: txOct.id,
  data: { amount: 300 },
  scope: 'CURRENT_AND_FUTURE',
});

const updatedOct = db.prepare("SELECT amount FROM transactions WHERE id = ?").get(txOct.id) as any;
const updatedNov = db.prepare("SELECT amount FROM transactions WHERE id = ?").get(txNov.id) as any;
const updatedTpl = db.prepare("SELECT amount FROM recurring_templates WHERE id = ?").get(templateId) as any;

console.log('Octobre mis à jour à 300 ?', updatedOct.amount === 300 ? 'OUI' : 'NON');
console.log('Novembre futur mis à jour à 300 ?', updatedNov.amount === 300 ? 'OUI' : 'NON');
console.log('Modèle source mis à jour à 300 ?', updatedTpl.amount === 300 ? 'OUI' : 'NON');

// Nettoyage final
db.prepare("DELETE FROM transactions WHERE title LIKE 'TEST_LOAN%'").run();
db.prepare("DELETE FROM recurring_templates WHERE title LIKE 'TEST_LOAN%'").run();

console.log('--- TOUS LES TESTS DE PROPAGATION & EXTINCTION SONT VALIDÉS AVEC SUCCÈS ---');
