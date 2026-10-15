import { Router, Request, Response } from 'express';
import path from 'path';
import { z } from 'zod';
import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import { MonthlyBalance, Transaction } from '../db/schema.js';
import { roundCurrency } from '../utils/dbHelpers.js';
import { autoBackupOnClose } from './backup.js';

export const monthsRouter = Router();

const monthParamSchema = z.object({
  monthYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

/**
 * GET /api/months/:monthYear
 * Initialise le mois (report idempotent) et retourne KPIs et transactions
 */
monthsRouter.get('/:monthYear', (req: Request, res: Response) => {
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

  // État de clôture du mois (N4)
  const balanceRow = db
    .prepare('SELECT is_closed FROM monthly_balances WHERE month_year = ?')
    .get(monthYear) as { is_closed: number } | undefined;

  const isClosed = balanceRow ? Boolean(balanceRow.is_closed) : false;

  // Récupérer les transactions avec détails des catégories
  const transactions = db
    .prepare<[string], Transaction & { category_name: string; category_icon: string; category_color: string; subcategory_name: string | null }>(`
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
    isClosed,
  });
});

/**
 * POST /api/months/:monthYear/sync
 * Forcer une synchronisation du report
 */
monthsRouter.post('/:monthYear/sync', (req: Request, res: Response) => {
  const parseResult = monthParamSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format monthYear invalide' });
    return;
  }

  const { monthYear } = parseResult.data;
  const autoCarryOver = req.body?.carryOverBalance === true;

  rolloverService.initializeOrSyncMonth(monthYear, autoCarryOver);
  const summary = rolloverService.getMonthlySummary(monthYear);

  res.json({ success: true, summary });
});

/**
 * PATCH /api/months/:monthYear/close (N4)
 * Clôturer définitivement un mois
 */
monthsRouter.patch('/:monthYear/close', (req: Request, res: Response) => {
  const parseResult = monthParamSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format monthYear invalide' });
    return;
  }

  const { monthYear } = parseResult.data;

  db.prepare(`
    INSERT INTO monthly_balances (month_year, carried_over_from_previous, is_closed)
    VALUES (?, 0, 1)
    ON CONFLICT(month_year) DO UPDATE SET is_closed = 1
  `).run(monthYear);

  // Snapshot automatique de la base SQLite à la clôture (S3)
  const backupPath = autoBackupOnClose(monthYear);

  res.json({
    success: true,
    isClosed: true,
    autoBackup: backupPath ? path.basename(backupPath) : null,
    message: `Le mois ${monthYear} a été clôturé et sauvegardé automatiquement.`,
  });
});

/**
 * PATCH /api/months/:monthYear/reopen (N4)
 * Réouvrir un mois précédemment clôturé
 */
monthsRouter.patch('/:monthYear/reopen', (req: Request, res: Response) => {
  const parseResult = monthParamSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format monthYear invalide' });
    return;
  }

  const { monthYear } = parseResult.data;

  db.prepare(`
    UPDATE monthly_balances SET is_closed = 0 WHERE month_year = ?
  `).run(monthYear);

  res.json({ success: true, isClosed: false, message: `Le mois ${monthYear} a été réouvert.` });
});

/**
 * GET /api/months/:monthYear/daily-curve (N5)
 * Données quotidiennes d'évolution de la trésorerie pour le graphique AreaChart
 */
monthsRouter.get('/:monthYear/daily-curve', (req: Request, res: Response) => {
  const parseResult = monthParamSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format monthYear invalide' });
    return;
  }

  const { monthYear } = parseResult.data;
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '10', 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Solde initial reporté
  const balanceRow = db
    .prepare('SELECT carried_over_from_previous FROM monthly_balances WHERE month_year = ?')
    .get(monthYear) as MonthlyBalance | undefined;
  
  const startBalance = balanceRow?.carried_over_from_previous || 0;

  // Récupérer les transactions actives du mois groupées par date
  const txRows = db.prepare<[string], { date: string; type: string; total: number }>(`
    SELECT date, type, SUM(amount) as total
    FROM transactions
    WHERE month_year = ? AND status = 'ACTIVE'
    GROUP BY date, type
  `).all(monthYear);

  const dayMap = new Map<number, { income: number; expense: number }>();
  for (let d = 1; d <= daysInMonth; d++) {
    dayMap.set(d, { income: 0, expense: 0 });
  }

  for (const row of txRows) {
    const day = parseInt(row.date.substring(8, 10), 10);
    const current = dayMap.get(day) || { income: 0, expense: 0 };
    if (row.type === 'INCOME') {
      current.income += row.total;
    } else {
      current.expense += row.total;
    }
    dayMap.set(day, current);
  }

  let runningBalance = startBalance;
  const dailyPoints: Array<{ day: number; date: string; income: number; expense: number; runningBalance: number }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const info = dayMap.get(d) || { income: 0, expense: 0 };
    runningBalance = roundCurrency(runningBalance + info.income - info.expense);
    const dateStr = `${monthYear}-${String(d).padStart(2, '0')}`;
    dailyPoints.push({
      day: d,
      date: dateStr,
      income: roundCurrency(info.income),
      expense: roundCurrency(info.expense),
      runningBalance,
    });
  }

  res.json({
    monthYear,
    startBalance: roundCurrency(startBalance),
    points: dailyPoints,
  });
});
