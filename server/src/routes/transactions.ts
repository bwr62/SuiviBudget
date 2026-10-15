import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import { Transaction, RecurringTemplate } from '../db/schema.js';
import { buildDynamicUpdate } from '../utils/dbHelpers.js';

export const transactionsRouter = Router();

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
  is_recurring: z.boolean().optional(),
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

// ==========================================
// TRANSACTIONS CRUD
// ==========================================

transactionsRouter.post('/transactions', (req: Request, res: Response) => {
  const parse = transactionCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const data = parse.data;
  const id = crypto.randomUUID();
  const derivedMonthYear = data.date.substring(0, 7);

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

  const created = db.prepare<[string], Transaction>('SELECT * FROM transactions WHERE id = ?').get(id);
  res.status(201).json(created);
});

transactionsRouter.patch('/transactions/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tx = db.prepare<[string], Transaction>('SELECT * FROM transactions WHERE id = ?').get(id);
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

  if (fields.date && !fields.month_year) {
    fields.month_year = fields.date.substring(0, 7);
  }

  rolloverService.updateTransactionWithScope({
    transactionId: id,
    data: fields,
    scope,
  });

  const updated = db.prepare<[string], Transaction>('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(updated);
});

transactionsRouter.patch('/transactions/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parse = toggleStatusSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }

  try {
    rolloverService.toggleTransactionStatus({
      transactionId: id,
      newStatus: parse.data.status,
      stopFutureRepetitions: parse.data.stopFutureRepetitions,
    });

    const updated = db.prepare<[string], Transaction>('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

transactionsRouter.delete('/transactions/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }
  res.json({ success: true });
});

/**
 * GET /api/transactions/search (F5 - Recherche Transverse Multi-Mois)
 */
transactionsRouter.get('/search', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const categoryId = (req.query.categoryId as string) || '';
  const type = (req.query.type as string) || '';

  if (!q && !categoryId && !type) {
    res.json([]);
    return;
  }

  let sql = `
    SELECT 
      t.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      s.name as subcategory_name
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    sql += ` AND (t.title LIKE ? OR t.notes LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (categoryId) {
    sql += ` AND t.category_id = ?`;
    params.push(categoryId);
  }
  if (type) {
    sql += ` AND t.type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY t.date DESC LIMIT 100`;

  const results = db.prepare(sql).all(...params);
  res.json(results);
});

/**
 * PATCH /api/transactions/batch/status (U4 - Batch toggle status)
 */
transactionsRouter.patch('/batch/status', (req: Request, res: Response) => {
  const schema = z.object({
    ids: z.array(z.string().min(1)).min(1),
    status: z.enum(['ACTIVE', 'PENDING']),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { ids, status } = parse.data;
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`UPDATE transactions SET status = ? WHERE id IN (${placeholders})`);
  const result = stmt.run(status, ...ids);

  res.json({ success: true, count: result.changes });
});

/**
 * POST /api/transactions/batch/delete (U4 - Batch delete)
 */
transactionsRouter.post('/batch/delete', (req: Request, res: Response) => {
  const schema = z.object({
    ids: z.array(z.string().min(1)).min(1),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { ids } = parse.data;
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`);
  const result = stmt.run(...ids);

  res.json({ success: true, count: result.changes });
});

/**
 * GET /api/transactions/export/csv (F4 - Export CSV)
 */
transactionsRouter.get('/export/csv', (req: Request, res: Response) => {
  const monthYear = req.query.monthYear as string | undefined;
  let sql = `
    SELECT 
      t.date,
      t.title,
      t.amount,
      t.type,
      c.name as category,
      COALESCE(s.name, '') as subcategory,
      t.status,
      COALESCE(t.notes, '') as notes
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
  `;
  const params: any[] = [];
  if (monthYear && /^\d{4}-\d{2}$/.test(monthYear)) {
    sql += ` WHERE t.month_year = ?`;
    params.push(monthYear);
  }
  sql += ` ORDER BY t.date ASC`;

  const rows = db.prepare(sql).all(...params) as Array<{
    date: string;
    title: string;
    amount: number;
    type: string;
    category: string;
    subcategory: string;
    status: string;
    notes: string;
  }>;

  // Création CSV avec en-tête UTF-8 BOM
  const header = ['Date', 'Libellé', 'Montant (€)', 'Type', 'Catégorie', 'Sous-Catégorie', 'Statut', 'Notes'];
  const csvLines = [header.join(';')];

  for (const row of rows) {
    const cleanNotes = (row.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const cleanTitle = (row.title || '').replace(/"/g, '""');
    csvLines.push([
      row.date,
      `"${cleanTitle}"`,
      row.amount.toFixed(2).replace('.', ','),
      row.type,
      `"${row.category}"`,
      `"${row.subcategory}"`,
      row.status,
      `"${cleanNotes}"`
    ].join(';'));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const filename = monthYear ? `budget_${monthYear}.csv` : `budget_export_complet.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// ==========================================
// RECURRING TEMPLATES
// ==========================================

transactionsRouter.get('/recurring-templates', (_req: Request, res: Response) => {
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

transactionsRouter.post('/recurring-templates', (req: Request, res: Response) => {
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

  const created = db.prepare<[string], RecurringTemplate>('SELECT * FROM recurring_templates WHERE id = ?').get(id);
  res.status(201).json(created);
});

transactionsRouter.patch('/recurring-templates/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tpl = db.prepare<[string], RecurringTemplate>('SELECT * FROM recurring_templates WHERE id = ?').get(id);
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
  const hasFields = Object.values(fields).some((v) => v !== undefined);

  if (hasFields) {
    const { sql, values } = buildDynamicUpdate('recurring_templates', 'id', id, fields);
    db.prepare(sql).run(...values);
  }

  const updated = db.prepare<[string], RecurringTemplate>('SELECT * FROM recurring_templates WHERE id = ?').get(id);
  res.json(updated);
});

transactionsRouter.delete('/recurring-templates/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Modèle introuvable' });
    return;
  }
  res.json({ success: true });
});
