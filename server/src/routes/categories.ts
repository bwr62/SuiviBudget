import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { Category, Subcategory } from '../db/schema.js';
import { buildDynamicUpdate } from '../utils/dbHelpers.js';

export const categoriesRouter = Router();

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']),
  icon: z.string().min(1),
  color: z.string().min(1),
  subcategories: z.array(z.string().min(1)).optional(),
  budget_limit: z.number().positive().nullable().optional(),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['INCOME', 'RECURRING_EXPENSE', 'CURRENT_EXPENSE', 'UNFORESEEN_EXPENSE']).optional(),
  icon: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  is_active: z.number().min(0).max(1).optional(),
  budget_limit: z.number().positive().nullable().optional(),
});

const subcategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

const subcategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * GET /api/categories
 * Récupère toutes les catégories avec leurs sous-catégories associées
 */
categoriesRouter.get('/categories', (_req: Request, res: Response) => {
  const categories = db.prepare<[], Category>('SELECT * FROM categories ORDER BY name ASC').all();
  const subcategories = db.prepare<[], Subcategory>('SELECT * FROM subcategories ORDER BY name ASC').all();

  const fullCategories = categories.map((cat) => ({
    ...cat,
    subcategories: subcategories.filter((sub) => sub.category_id === cat.id),
  }));

  res.json(fullCategories);
});

/**
 * POST /api/categories
 * Création d'une nouvelle catégorie personnalisée
 */
categoriesRouter.post('/categories', (req: Request, res: Response) => {
  const parse = categoryCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { name, type, icon, color, subcategories = [], budget_limit = null } = parse.data;
  const id = 'cat-' + crypto.randomUUID().substring(0, 8);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO categories (id, name, type, icon, color, is_system, is_active, budget_limit)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?)
    `).run(id, name, type, icon, color, budget_limit);

    const insertSub = db.prepare(`
      INSERT INTO subcategories (id, category_id, name)
      VALUES (?, ?, ?)
    `);

    for (const subName of subcategories) {
      insertSub.run('sub-' + crypto.randomUUID().substring(0, 8), id, subName.trim());
    }
  });

  tx();

  const created = db.prepare<[string], Category>('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(created);
});

/**
 * PATCH /api/categories/:id
 * Modification d'une catégorie existante
 */
categoriesRouter.patch('/categories/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const cat = db.prepare<[string], Category>('SELECT * FROM categories WHERE id = ?').get(id);
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
  const hasFields = Object.values(fields).some((v) => v !== undefined);

  if (hasFields) {
    const { sql, values } = buildDynamicUpdate('categories', 'id', id, fields);
    db.prepare(sql).run(...values);
  }

  const updated = db.prepare<[string], Category>('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(updated);
});

/**
 * DELETE /api/categories/:id
 * Suppression d'une catégorie
 */
categoriesRouter.delete('/categories/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const cat = db.prepare<[string], Category>('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) {
    res.status(404).json({ error: 'Catégorie introuvable' });
    return;
  }

  if (cat.is_system === 1) {
    res.status(400).json({ error: 'Impossible de supprimer une catégorie système prédéfinie.' });
    return;
  }

  const deleteTx = db.transaction(() => {
    // Dé-assigner les transactions utilisant cette catégorie
    db.prepare('UPDATE transactions SET subcategory_id = NULL WHERE category_id = ?').run(id);
    db.prepare('UPDATE recurring_templates SET subcategory_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  });

  deleteTx();
  res.json({ success: true });
});

/**
 * POST /api/categories/:id/subcategories
 * Ajout d'une sous-catégorie
 */
categoriesRouter.post('/categories/:id/subcategories', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const cat = db.prepare<[string], Category>('SELECT * FROM categories WHERE id = ?').get(id);
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
  `).run(subId, id, parse.data.name.trim());

  const created = db.prepare<[string], Subcategory>('SELECT * FROM subcategories WHERE id = ?').get(subId);
  res.status(201).json(created);
});

/**
 * PATCH /api/subcategories/:id
 * Modification d'une sous-catégorie
 */
categoriesRouter.patch('/subcategories/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const sub = db.prepare<[string], Subcategory>('SELECT * FROM subcategories WHERE id = ?').get(id);
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
    id
  );

  const updated = db.prepare<[string], Subcategory>('SELECT * FROM subcategories WHERE id = ?').get(id);
  res.json(updated);
});

/**
 * DELETE /api/subcategories/:id
 * Suppression d'une sous-catégorie avec protection des transactions orphelines (Section 5.3 Audit)
 */
categoriesRouter.delete('/subcategories/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleteSubTx = db.transaction(() => {
    // Re-assigner les transactions et templates orphelins à NULL sur subcategory_id
    db.prepare('UPDATE transactions SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);
    db.prepare('UPDATE recurring_templates SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);
    const result = db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
    return result.changes > 0;
  });

  const changed = deleteSubTx();
  if (!changed) {
    res.status(404).json({ error: 'Sous-catégorie introuvable' });
    return;
  }

  res.json({ success: true });
});
