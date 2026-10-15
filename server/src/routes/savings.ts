import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { SavingsGoal, SavingsAllocation } from '../db/schema.js';
import { roundCurrency } from '../utils/dbHelpers.js';

export const savingsRouter = Router();

const goalCreateSchema = z.object({
  title: z.string().min(1).max(100),
  target_amount: z.number().positive(),
  current_amount: z.number().min(0).default(0),
  target_date: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  icon: z.string().default('PiggyBank'),
  color: z.string().default('#10B981'),
});

const goalUpdateSchema = goalCreateSchema.partial();

const allocateSchema = z.object({
  goal_id: z.string().min(1),
  month_year: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number(), // Peut être positif (ajout) ou négatif (retrait)
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * GET /api/savings/goals
 * Liste tous les objectifs d'épargne avec leur pourcentage d'atteinte
 */
savingsRouter.get('/goals', (_req: Request, res: Response) => {
  const goals = db.prepare<[], SavingsGoal>('SELECT * FROM savings_goals ORDER BY created_at ASC').all();
  res.json(goals);
});

/**
 * POST /api/savings/goals
 * Création d'une nouvelle tirelire/objectif d'épargne
 */
savingsRouter.post('/goals', (req: Request, res: Response) => {
  const parse = goalCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const data = parse.data;
  const id = 'goal-' + crypto.randomUUID().substring(0, 8);

  db.prepare(`
    INSERT INTO savings_goals (id, title, target_amount, current_amount, target_date, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title,
    roundCurrency(data.target_amount),
    roundCurrency(data.current_amount),
    data.target_date ?? null,
    data.icon,
    data.color
  );

  const created = db.prepare<[string], SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?').get(id);
  res.status(201).json(created);
});

/**
 * PATCH /api/savings/goals/:id
 * Modification d'un objectif d'épargne
 */
savingsRouter.patch('/goals/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const goal = db.prepare<[string], SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?').get(id);
  if (!goal) {
    res.status(404).json({ error: 'Objectif introuvable' });
    return;
  }

  const parse = goalUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const data = parse.data;
  const updates: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.target_amount !== undefined) {
    updates.push('target_amount = ?');
    values.push(roundCurrency(data.target_amount));
  }
  if (data.current_amount !== undefined) {
    updates.push('current_amount = ?');
    values.push(roundCurrency(data.current_amount));
  }
  if (data.target_date !== undefined) {
    updates.push('target_date = ?');
    values.push(data.target_date);
  }
  if (data.icon !== undefined) {
    updates.push('icon = ?');
    values.push(data.icon);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    values.push(data.color);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE savings_goals SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const updated = db.prepare<[string], SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?').get(id);
  res.json(updated);
});

/**
 * DELETE /api/savings/goals/:id
 * Suppression d'un objectif d'épargne
 */
savingsRouter.delete('/goals/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Objectif introuvable' });
    return;
  }
  res.json({ success: true });
});

/**
 * POST /api/savings/allocate
 * Allouer un montant de sa capacité d'épargne vers un objectif (avec mise à jour ACID du solde de l'objectif)
 */
savingsRouter.post('/allocate', (req: Request, res: Response) => {
  const parse = allocateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Données invalides', details: parse.error.format() });
    return;
  }

  const { goal_id, month_year, amount } = parse.data;
  const date = parse.data.date || new Date().toISOString().substring(0, 10);

  const goal = db.prepare<[string], SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?').get(goal_id);
  if (!goal) {
    res.status(404).json({ error: 'Objectif introuvable' });
    return;
  }

  const allocationId = 'alloc-' + crypto.randomUUID().substring(0, 8);

  const tx = db.transaction(() => {
    // Insérer l'historique d'allocation
    db.prepare(`
      INSERT INTO savings_allocations (id, goal_id, month_year, amount, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(allocationId, goal_id, month_year, roundCurrency(amount), date);

    // Mettre à jour le solde actuel de l'objectif
    const newAmount = Math.max(0, roundCurrency(goal.current_amount + amount));
    db.prepare('UPDATE savings_goals SET current_amount = ? WHERE id = ?').run(newAmount, goal_id);
  });

  tx();

  const updatedGoal = db.prepare<[string], SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?').get(goal_id);
  res.json({
    success: true,
    allocationId,
    goal: updatedGoal,
  });
});

/**
 * GET /api/savings/allocations/:monthYear
 * Récupère toutes les allocations faites pour un mois donné
 */
savingsRouter.get('/allocations/:monthYear', (req: Request, res: Response) => {
  const monthYear = req.params.monthYear as string;
  const allocations = db.prepare<[string], SavingsAllocation & { goal_title: string; goal_color: string }>(`
    SELECT a.*, g.title as goal_title, g.color as goal_color
    FROM savings_allocations a
    JOIN savings_goals g ON a.goal_id = g.id
    WHERE a.month_year = ?
    ORDER BY a.date DESC
  `).all(monthYear);

  res.json(allocations);
});
