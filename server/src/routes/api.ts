import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
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
  month_year: z.string().regex(/^\d{4}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']),
  category_id: z.string().min(1),
  subcategory_id: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PENDING']).default('ACTIVE'),
  notes: z.string().nullable().optional(),
});

const transactionUpdateSchema = transactionCreateSchema.partial();

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
});

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']),
  icon: z.string().min(1),
  color: z.string().min(1),
  subcategories: z.array(z.string().min(1)).optional(),
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

  // Si c'est une dépense imprévue, elle n'est jamais reportée ni issue d'un template
  const templateId = data.type === 'UNFORESEEN_EXPENSE' ? null : (data.template_id ?? null);

  db.prepare(`
    INSERT INTO transactions (
      id, template_id, month_year, date, title, amount, type,
      category_id, subcategory_id, status, is_carried_over, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    templateId,
    data.month_year,
    data.date,
    data.title,
    data.amount,
    data.type,
    data.category_id,
    data.subcategory_id ?? null,
    data.status,
    data.notes ?? null
  );

  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.status(201).json(created);
});

apiRouter.patch('/transactions/:id', (req: Request, res: Response) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }

  const parse = transactionUpdateSchema.safeParse(req.body);
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
    db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

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
      id, title, amount, type, category_id, subcategory_id, day_of_month, status, carry_over
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title,
    data.amount,
    data.type,
    data.category_id,
    data.subcategory_id ?? null,
    data.day_of_month,
    data.status,
    data.carry_over
  );

  const created = db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(id);
  res.status(201).json(created);
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
// 4. CATÉGORIES & SOUS-CATÉGORIES
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
