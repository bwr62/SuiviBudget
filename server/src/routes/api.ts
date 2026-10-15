import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import { requireAuth } from '../middlewares/auth.js';

export const apiRouter = Router();

// Middleware d'authentification sur toutes les routes financières
apiRouter.use(requireAuth);

// Validation Schemas Zod
const monthParamSchema = z.object({
  monthYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

const transactionCreateSchema = z.object({
  template_id: z.string().nullable().optional(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']),
  category_id: z.string().min(1),
  subcategory_id: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PENDING']).default('ACTIVE'),
  notes: z.string().nullable().optional(),
  is_recurring: z.boolean().optional(), // Si true, crée un modèle récurrent automatiquement
});

const transactionUpdateSchema = z.object({
  template_id: z.string().nullable().optional(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().min(1).max(255).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']).optional(),
  category_id: z.string().min(1).optional(),
  subcategory_id: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PENDING']).optional(),
  notes: z.string().nullable().optional(),
  scope: z.enum(['CURRENT_MONTH_ONLY', 'CURRENT_AND_FUTURE']).optional(),
});

const toggleStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PENDING']),
  stopFutureRepetitions: z.boolean().optional(),
});

const recurringTemplateCreateSchema = z.object({
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE']),
  category_id: z.string().min(1),
  subcategory_id: z.string().nullable().optional(),
  day_of_month: z.number().int().min(1).max(31),
  status: z.enum(['ACTIVE', 'PENDING_PAUSED']).default('ACTIVE'),
  carry_over: z.number().int().min(0).max(1).default(1),
  end_month_year: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
});

const recurringTemplateUpdateSchema = recurringTemplateCreateSchema.partial();

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']),
  icon: z.string().min(1),
  color: z.string().min(1),
  subcategories: z.array(z.string().min(1)).optional(),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']).optional(),
  icon: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  is_active: z.number().min(0).max(1).optional(),
});

const subcategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

const subcategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100),
});

// ==========================================
// 1. MOIS & TABLEAU DE BORD (Rollover Engine)
// ==========================================

/**
 * Initialise le mois (report idempotent) et retourne KPIs et transactions
 */
apiRouter.get('/months/:monthYear', (req: Request, res: Response) => {
  const parseResult = monthParamSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format monthYear invalide (attendu: YYYY-MM)' });
    return;
  }

  const { monthYear } = parseResult.data;
  const autoCarryOver = req.query['carryOverBalance'] === 'true';

  // Déclencher le moteur de report mensuel
  rolloverService.initializeOrSyncMonth(monthYear, autoCarryOver);

  // Récupérer le résumé financier (avec exclusion stricte de PENDING)
  const summary = rolloverService.getMonthlySummary(monthYear);

  // Récupérer les transactions avec détails des catégories
  const transactions = db
    .prepare(`
      SELECT 
        t.*,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      WHERE t.month_year = ?
      ORDER BY t.date DESC, t.created_at DESC
    `)
    .all(monthYear);

  res.json({
    summary,
    transactions,
  });
});

// ==========================================
// 2. TRANSACTIONS CRUD & TOGGLE STATUT
// ==========================================

apiRouter.post('/transactions', (req: Request, res: Response) => {
  const parse = transactionCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const data = parse.data;
  const id = crypto.randomUUID();

  // CORRECTION CLÉ : Le month_year DOIT être dérivé de la date saisie (ex: 2026-09-15 -> 2026-09)
  const derivedMonthYear = data.date.substring(0, 7);

  // Vérifier si la transaction doit automatiquement créer un modèle de récurrence
  let templateId: string | null = null;
  const shouldRecur =
    data.type !== 'UNFORESEEN_EXPENSE' &&
    (data.is_recurring === true || data.type === 'RECURRING_EXPENSE');

  const tx = db.transaction(() => {
    if (shouldRecur) {
      templateId = crypto.randomUUID();
      const dayOfMonth = parseInt(data.date.substring(8, 10), 10) || 1;

      db.prepare(`
        INSERT INTO recurring_templates (
          id, title, amount, type, category_id, subcategory_id, day_of_month, status, carry_over
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        templateId,
        data.title,
        data.amount,
        data.type,
        data.category_id,
        data.subcategory_id ?? null,
        dayOfMonth,
        data.status === 'PENDING' ? 'PENDING_PAUSED' : 'ACTIVE'
      );
    } else if (data.template_id && data.type !== 'UNFORESEEN_EXPENSE') {
      templateId = data.template_id;
    }

    db.prepare(`
      INSERT INTO transactions (
        id, template_id, month_year, date, title, amount, type,
        category_id, subcategory_id, status, is_carried_over, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      templateId,
      derivedMonthYear,
      data.date,
      data.title,
      data.amount,
      data.type,
      data.category_id,
      data.subcategory_id ?? null,
      data.status,
      data.notes ?? null
    );
  });

  tx();

  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.status(201).json(created);
});

apiRouter.patch('/transactions/:id', (req: Request, res: Response) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as any;
  if (!tx) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }

  const parse = transactionUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { scope = 'CURRENT_MONTH_ONLY', ...fields } = parse.data;

  // Si la date change, synchroniser automatiquement month_year
  if (fields.date && !fields.month_year) {
    fields.month_year = fields.date.substring(0, 7);
  }

  // Utiliser le moteur avec portée de propagation temporelle
  rolloverService.updateTransactionWithScope({
    transactionId: req.params.id as string,
    data: fields,
    scope,
  });

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  res.json(updated);
});

apiRouter.patch('/transactions/:id/status', (req: Request, res: Response) => {
  const parse = toggleStatusSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }

  try {
    rolloverService.toggleTransactionStatus({
      transactionId: req.params.id as string,
      newStatus: parse.data.status,
      stopFutureRepetitions: parse.data.stopFutureRepetitions,
    });

    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/transactions/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }
  res.json({ success: true });
});

// ==========================================
// 3. RECURRING TEMPLATES (Modèles Récurrents)
// ==========================================

apiRouter.get('/recurring-templates', (_req: Request, res: Response) => {
  const templates = db
    .prepare(`
      SELECT 
        rt.*,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM recurring_templates rt
      JOIN categories c ON rt.category_id = c.id
      LEFT JOIN subcategories s ON rt.subcategory_id = s.id
      ORDER BY rt.day_of_month ASC
    `)
    .all();
  res.json(templates);
});

apiRouter.post('/recurring-templates', (req: Request, res: Response) => {
  const parse = recurringTemplateCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const data = parse.data;
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO recurring_templates (
      id, title, amount, type, category_id, subcategory_id, day_of_month, status, carry_over, end_month_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title,
    data.amount,
    data.type,
    data.category_id,
    data.subcategory_id ?? null,
    data.day_of_month,
    data.status,
    data.carry_over,
    data.end_month_year ?? null
  );

  const created = db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(id);
  res.status(201).json(created);
});

apiRouter.patch('/recurring-templates/:id', (req: Request, res: Response) => {
  const tpl = db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(req.params.id);
  if (!tpl) {
    res.status(404).json({ error: 'Modèle introuvable' });
    return;
  }

  const parse = recurringTemplateUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const fields = parse.data;
  const updates: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(val);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE recurring_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const updated = db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(req.params.id);
  res.json(updated);
});

apiRouter.delete('/recurring-templates/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Modèle introuvable' });
    return;
  }
  res.json({ success: true });
});

// ==========================================
// 4. CATÉGORIES & SOUS-CATÉGORIES (CRUD COMPLET)
// ==========================================

apiRouter.get('/categories', (_req: Request, res: Response) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  const subcategories = db.prepare('SELECT * FROM subcategories ORDER BY name ASC').all();

  const fullCategories = categories.map((cat: any) => ({
    ...cat,
    subcategories: subcategories.filter((sub: any) => sub.category_id === cat.id),
  }));

  res.json(fullCategories);
});

apiRouter.post('/categories', (req: Request, res: Response) => {
  const parse = categoryCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { name, type, icon, color, subcategories = [] } = parse.data;
  const id = 'cat-' + crypto.randomUUID().substring(0, 8);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO categories (id, name, type, icon, color, is_system, is_active)
      VALUES (?, ?, ?, ?, ?, 0, 1)
    `).run(id, name, type, icon, color);

    const insertSub = db.prepare(`
      INSERT INTO subcategories (id, category_id, name)
      VALUES (?, ?, ?)
    `);

    for (const subName of subcategories) {
      insertSub.run('sub-' + crypto.randomUUID().substring(0, 8), id, subName);
    }
  });

  tx();

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(created);
});

// MODIFICATION D'UNE CATÉGORIE EXISTANTE
apiRouter.patch('/categories/:id', (req: Request, res: Response) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) {
    res.status(404).json({ error: 'Catégorie introuvable' });
    return;
  }

  const parse = categoryUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const fields = parse.data;
  const updates: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(val);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// AJOUT D'UNE SOUS-CATÉGORIE DANS UNE CATÉGORIE EXISTANTE
apiRouter.post('/categories/:id/subcategories', (req: Request, res: Response) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) {
    res.status(404).json({ error: 'Catégorie introuvable' });
    return;
  }

  const parse = subcategoryCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Nom de sous-catégorie invalide' });
    return;
  }

  const subId = 'sub-' + crypto.randomUUID().substring(0, 8);
  db.prepare(`
    INSERT INTO subcategories (id, category_id, name)
    VALUES (?, ?, ?)
  `).run(subId, req.params.id, parse.data.name.trim());

  const created = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(subId);
  res.status(201).json(created);
});

// MODIFICATION D'UNE SOUS-CATÉGORIE
apiRouter.patch('/subcategories/:id', (req: Request, res: Response) => {
  const sub = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Sous-catégorie introuvable' });
    return;
  }

  const parse = subcategoryUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Nom de sous-catégorie invalide' });
    return;
  }

  db.prepare('UPDATE subcategories SET name = ? WHERE id = ?').run(
    parse.data.name.trim(),
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// SUPPRESSION D'UNE SOUS-CATÉGORIE
apiRouter.delete('/subcategories/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM subcategories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Sous-catégorie introuvable' });
    return;
  }
  res.json({ success: true });
});

// ==========================================
// 5. STATISTIQUES & ANALYSES (RECHARTS)
// ==========================================

apiRouter.get('/stats/annual', (req: Request, res: Response) => {
  const year = req.query['year'] || new Date().getFullYear().toString();

  // Entrées vs Sorties groupées par mois sur l'année demandée
  // RÈGLE MÉTIER : Exclusion stricte des statuts PENDING !
  const rows = db
    .prepare(`
      SELECT 
        month_year,
        COALESCE(SUM(CASE WHEN type = 'INCOME' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'RECURRING_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as recurring,
        COALESCE(SUM(CASE WHEN type = 'CURRENT_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as current,
        COALESCE(SUM(CASE WHEN type = 'UNFORESEEN_EXPENSE' AND status = 'ACTIVE' THEN amount ELSE 0 END), 0) as unforeseen
      FROM transactions
      WHERE month_year LIKE ?
      GROUP BY month_year
      ORDER BY month_year ASC
    `)
    .all(`${year}-%`);

  res.json(rows);
});

apiRouter.get('/stats/category-distribution', (req: Request, res: Response) => {
  const monthYear = req.query['monthYear'] as string;
  if (!monthYear) {
    res.status(400).json({ error: 'Paramètre monthYear requis' });
    return;
  }

  const distribution = db
    .prepare(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        c.type as category_type,
        SUM(t.amount) as total_amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.month_year = ? AND t.type != 'INCOME' AND t.status = 'ACTIVE'
      GROUP BY c.id
      ORDER BY total_amount DESC
    `)
    .all(monthYear);

  res.json(distribution);
});

// ==========================================
// 6. SAUVEGARDE & EXPORT / IMPORT (P1)
// ==========================================

/**
 * Export JSON complet de toutes les données de l'application
 */
apiRouter.get('/backup/export/json', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, created_at FROM users').all();
  const categories = db.prepare('SELECT * FROM categories').all();
  const subcategories = db.prepare('SELECT * FROM subcategories').all();
  const templates = db.prepare('SELECT * FROM recurring_templates').all();
  const transactions = db.prepare('SELECT * FROM transactions').all();
  const balances = db.prepare('SELECT * FROM monthly_balances').all();

  const backupData = {
    exportedAt: new Date().toISOString(),
    version: '0.02',
    data: {
      users,
      categories,
      subcategories,
      recurring_templates: templates,
      transactions,
      monthly_balances: balances,
    },
  };

  const filename = `budget_backup_${new Date().toISOString().substring(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backupData, null, 2));
});

/**
 * Téléchargement direct du fichier SQLite local (backup binaire brut)
 */
apiRouter.get('/backup/export/db', (_req: Request, res: Response) => {
  // Pragma checkpoint WAL pour garantir que toutes les écritures sont consolidées
  db.pragma('wal_checkpoint(TRUNCATE)');

  const dbPath = path.resolve(process.cwd(), 'data', 'budget.sqlite');
  if (!fs.existsSync(dbPath)) {
    res.status(404).json({ error: 'Fichier de base de données introuvable.' });
    return;
  }

  const filename = `budget_backup_${new Date().toISOString().substring(0, 10)}.sqlite`;
  res.download(dbPath, filename);
});

// ==========================================
// 7. ASSISTANT DE PREMIÈRE CONNEXION (ONBOARDING)
// ==========================================

const onboardingCompleteSchema = z.object({
  profile: z.object({
    adults_count: z.number().int().min(1).default(1),
    children_count: z.number().int().min(0).default(0),
    pets_count: z.number().int().min(0).default(0),
    housing_status: z.enum(['TENANT', 'OWNER_WITH_LOAN', 'OWNER_PAID_OFF', 'FREE_HOUSING']),
    payday_default: z.number().int().min(1).max(31).default(1),
  }),
  templates: z.array(
    z.object({
      title: z.string().min(1),
      amount: z.number().positive(),
      type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE']),
      category_id: z.string().min(1),
      subcategory_id: z.string().nullable().optional(),
      subcategory_name: z.string().optional(), // Si nouvelle sous-catégorie créée à la volée
      day_of_month: z.number().int().min(1).max(31).default(1),
      end_month_year: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
      carry_over: z.number().int().default(1),
    })
  ),
  current_month_year: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * Récupère le profil du foyer et l'état d'onboarding
 */
apiRouter.get('/onboarding/status', (_req: Request, res: Response) => {
  const profile = db.prepare('SELECT * FROM household_profile WHERE id = 1').get() as any;
  if (!profile) {
    res.json({ has_completed_onboarding: 0 });
    return;
  }
  res.json(profile);
});

/**
 * Validation finale et enregistrement de l'assistant de première connexion
 */
apiRouter.post('/onboarding/complete', (req: Request, res: Response) => {
  const parse = onboardingCompleteSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { profile, templates, current_month_year } = parse.data;

  const completeTx = db.transaction(() => {
    // 1. Sauvegarder ou mettre à jour household_profile
    db.prepare(`
      INSERT INTO household_profile (
        id, has_completed_onboarding, adults_count, children_count, pets_count, housing_status, payday_default, updated_at
      ) VALUES (1, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        has_completed_onboarding = 1,
        adults_count = excluded.adults_count,
        children_count = excluded.children_count,
        pets_count = excluded.pets_count,
        housing_status = excluded.housing_status,
        payday_default = excluded.payday_default,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      profile.adults_count,
      profile.children_count,
      profile.pets_count,
      profile.housing_status,
      profile.payday_default
    );

    // 2. Insérer tous les templates récurrents
    for (const tpl of templates) {
      let subId = tpl.subcategory_id ?? null;

      // Si un nom de sous-catégorie personnalisé a été fourni sans ID
      if (!subId && tpl.subcategory_name && tpl.subcategory_name.trim()) {
        const existingSub = db
          .prepare('SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?)')
          .get(tpl.category_id, tpl.subcategory_name.trim()) as { id: string } | undefined;

        if (existingSub) {
          subId = existingSub.id;
        } else {
          subId = crypto.randomUUID();
          db.prepare('INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)').run(
            subId,
            tpl.category_id,
            tpl.subcategory_name.trim()
          );
        }
      }

      const templateId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO recurring_templates (
          id, title, amount, type, category_id, subcategory_id, day_of_month, status, carry_over, end_month_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        templateId,
        tpl.title,
        tpl.amount,
        tpl.type,
        tpl.category_id,
        subId,
        tpl.day_of_month,
        tpl.carry_over,
        tpl.end_month_year ?? null
      );
    }

    // 3. Initialiser ou synchroniser immédiatement le mois courant
    rolloverService.initializeOrSyncMonth(current_month_year, false);
  });

  try {
    completeTx();
    res.json({ success: true, message: 'Onboarding terminé avec succès !' });
  } catch (err: any) {
    console.error("Erreur onboarding complete:", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'enregistrement de l'onboarding" });
  }
});
