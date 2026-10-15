import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { db } from '../db/index.js';

export const backupRouter = Router();

// Version dynamique lue depuis le package.json (H4)
let appVersion = '0.06';
try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version) appVersion = pkg.version;
  }
} catch {
  appVersion = '0.06';
}

/**
 * Fonction de snapshot automatique de la base SQLite lors de la clôture d'un mois (S3)
 */
export function autoBackupOnClose(monthYear: string): string | null {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    const dbPath = path.resolve(process.cwd(), 'data', 'budget.sqlite');
    if (!fs.existsSync(dbPath)) return null;

    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const targetPath = path.join(backupDir, `budget_auto_${monthYear}.sqlite`);
    fs.copyFileSync(dbPath, targetPath);

    // Conserver les 12 dernières sauvegardes automatiques glissantes
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('budget_auto_') && f.endsWith('.sqlite'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 12) {
      files.slice(12).forEach((f) => {
        try {
          fs.unlinkSync(path.join(backupDir, f.name));
        } catch {}
      });
    }

    console.log(`[Backup] Snapshot automatique créé pour le mois ${monthYear}: ${targetPath}`);
    return targetPath;
  } catch (err) {
    console.error(`[Backup] Erreur lors de la sauvegarde automatique du mois ${monthYear}:`, err);
    return null;
  }
}

/**
 * GET /api/backup/export/json
 * Export complet JSON des données (H4 : version dynamique, avec savings & budget_limit)
 */
backupRouter.get('/export/json', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, created_at FROM users').all();
  const profile = db.prepare('SELECT * FROM household_profile WHERE id = 1').get();
  const categories = db.prepare('SELECT * FROM categories').all();
  const subcategories = db.prepare('SELECT * FROM subcategories').all();
  const templates = db.prepare('SELECT * FROM recurring_templates').all();
  const transactions = db.prepare('SELECT * FROM transactions').all();
  const balances = db.prepare('SELECT * FROM monthly_balances').all();
  const savingsGoals = db.prepare('SELECT * FROM savings_goals').all();
  const savingsAllocations = db.prepare('SELECT * FROM savings_allocations').all();

  const backupData = {
    exportedAt: new Date().toISOString(),
    version: appVersion,
    data: {
      users,
      household_profile: profile ? [profile] : [],
      categories,
      subcategories,
      recurring_templates: templates,
      transactions,
      monthly_balances: balances,
      savings_goals: savingsGoals,
      savings_allocations: savingsAllocations,
    },
  };

  const filename = `budget_backup_${new Date().toISOString().substring(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backupData, null, 2));
});

/**
 * GET /api/backup/export/db
 * Téléchargement direct du fichier SQLite local (backup binaire consolidé)
 */
backupRouter.get('/export/db', (_req: Request, res: Response) => {
  db.pragma('wal_checkpoint(TRUNCATE)');

  const dbPath = path.resolve(process.cwd(), 'data', 'budget.sqlite');
  if (!fs.existsSync(dbPath)) {
    res.status(404).json({ error: 'Fichier de base de données introuvable.' });
    return;
  }

  const filename = `budget_backup_${new Date().toISOString().substring(0, 10)}.sqlite`;
  res.download(dbPath, filename);
});

const backupImportSchema = z.object({
  version: z.string().optional(),
  data: z.object({
    household_profile: z.array(z.any()).optional(),
    categories: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        icon: z.string(),
        color: z.string(),
        is_system: z.number().optional().default(0),
        is_active: z.number().optional().default(1),
        user_id: z.string().optional(),
      })
    ),
    subcategories: z.array(
      z.object({
        id: z.string(),
        category_id: z.string(),
        name: z.string(),
      })
    ).optional().default([]),
    recurring_templates: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        amount: z.number(),
        type: z.string(),
        category_id: z.string(),
        subcategory_id: z.string().nullable().optional(),
        day_of_month: z.number(),
        status: z.string(),
        carry_over: z.number().optional().default(1),
        end_month_year: z.string().nullable().optional(),
        user_id: z.string().optional(),
      })
    ).optional().default([]),
    transactions: z.array(
      z.object({
        id: z.string(),
        template_id: z.string().nullable().optional(),
        month_year: z.string(),
        date: z.string(),
        title: z.string(),
        amount: z.number(),
        type: z.string(),
        category_id: z.string(),
        subcategory_id: z.string().nullable().optional(),
        status: z.string(),
        is_carried_over: z.number().optional().default(0),
        notes: z.string().nullable().optional(),
        user_id: z.string().optional(),
      })
    ).optional().default([]),
    monthly_balances: z.array(
      z.object({
        month_year: z.string(),
        carried_over_from_previous: z.number().optional().default(0),
        is_closed: z.number().optional().default(0),
        user_id: z.string().optional(),
      })
    ).optional().default([]),
  }),
});

/**
 * POST /api/backup/import/json (C2)
 * Restauration complète depuis une sauvegarde JSON dans une transaction SQLite ACID
 */
backupRouter.post('/import/json', (req: Request, res: Response) => {
  const parse = backupImportSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Format de sauvegarde JSON invalide', details: parse.error.format() });
    return;
  }

  const { data } = parse.data;

  const importTx = db.transaction(() => {
    // 1. Vider les tables de données financières existantes (l'utilisateur reste authentifié)
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM recurring_templates').run();
    db.prepare('DELETE FROM subcategories').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM monthly_balances').run();

    // 2. Restaurer categories
    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, type, icon, color, is_system, is_active, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of data.categories) {
      insertCat.run(c.id, c.name, c.type, c.icon, c.color, c.is_system ?? 0, c.is_active ?? 1, c.user_id ?? 'default_user');
    }

    // 3. Restaurer subcategories
    const insertSub = db.prepare(`
      INSERT INTO subcategories (id, category_id, name)
      VALUES (?, ?, ?)
    `);
    for (const s of data.subcategories) {
      insertSub.run(s.id, s.category_id, s.name);
    }

    // 4. Restaurer recurring_templates
    const insertTpl = db.prepare(`
      INSERT INTO recurring_templates (id, title, amount, type, category_id, subcategory_id, day_of_month, status, carry_over, end_month_year, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of data.recurring_templates) {
      insertTpl.run(
        t.id,
        t.title,
        t.amount,
        t.type,
        t.category_id,
        t.subcategory_id ?? null,
        t.day_of_month,
        t.status,
        t.carry_over ?? 1,
        t.end_month_year ?? null,
        t.user_id ?? 'default_user'
      );
    }

    // 5. Restaurer transactions
    const insertTx = db.prepare(`
      INSERT INTO transactions (id, template_id, month_year, date, title, amount, type, category_id, subcategory_id, status, is_carried_over, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tx of data.transactions) {
      insertTx.run(
        tx.id,
        tx.template_id ?? null,
        tx.month_year,
        tx.date,
        tx.title,
        tx.amount,
        tx.type,
        tx.category_id,
        tx.subcategory_id ?? null,
        tx.status,
        tx.is_carried_over ?? 0,
        tx.notes ?? null,
        tx.user_id ?? 'default_user'
      );
    }

    // 6. Restaurer monthly_balances
    const insertMb = db.prepare(`
      INSERT INTO monthly_balances (month_year, carried_over_from_previous, is_closed, user_id)
      VALUES (?, ?, ?, ?)
    `);
    for (const mb of data.monthly_balances) {
      insertMb.run(mb.month_year, mb.carried_over_from_previous ?? 0, mb.is_closed ?? 0, mb.user_id ?? 'default_user');
    }

    // 7. Restaurer household_profile si fourni
    if (data.household_profile && data.household_profile.length > 0) {
      const p = data.household_profile[0];
      db.prepare(`
        INSERT OR REPLACE INTO household_profile (id, has_completed_onboarding, adults_count, children_count, pets_count, housing_status, payday_default)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `).run(
        p.has_completed_onboarding ?? 1,
        p.adults_count ?? 1,
        p.children_count ?? 0,
        p.pets_count ?? 0,
        p.housing_status ?? 'TENANT',
        p.payday_default ?? 1
      );
    }
  });

  try {
    importTx();
    res.json({
      success: true,
      message: 'Sauvegarde restaurée avec succès !',
      stats: {
        categories: data.categories.length,
        subcategories: data.subcategories.length,
        templates: data.recurring_templates.length,
        transactions: data.transactions.length,
        monthly_balances: data.monthly_balances.length,
      },
    });
  } catch (err: any) {
    console.error('Erreur import JSON:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la restauration de la sauvegarde' });
  }
});
