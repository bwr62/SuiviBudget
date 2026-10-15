import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';

export const statsRouter = Router();

/**
 * GET /api/stats/annual
 * Analyse annuelle des entrées vs dépenses par catégorie (exclusion PENDING garantie)
 */
statsRouter.get('/annual', (req: Request, res: Response) => {
  const year = req.query['year'] || new Date().getFullYear().toString();

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

/**
 * GET /api/stats/category-distribution
 * Distribution des dépenses actives par catégorie pour le DonutChart
 */
statsRouter.get('/category-distribution', (req: Request, res: Response) => {
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
        ROUND(SUM(t.amount), 2) as total_amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.month_year = ? AND t.type != 'INCOME' AND t.status = 'ACTIVE'
      GROUP BY c.id
      ORDER BY total_amount DESC
    `)
    .all(monthYear);

  res.json(distribution);
});

/**
 * GET /api/stats/top-categories (N6)
 * Top 5 des postes de dépenses du mois avec calcul des pourcentages
 */
statsRouter.get('/top-categories', (req: Request, res: Response) => {
  const monthYear = (req.query['monthYear'] as string) || new Date().toISOString().substring(0, 7);

  const totalRow = db.prepare<[string], { total: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE month_year = ? AND type != 'INCOME' AND status = 'ACTIVE'
  `).get(monthYear);

  const totalExpense = totalRow?.total || 0;

  const topCategories = db.prepare<[string], {
    category_id: string;
    category_name: string;
    category_color: string;
    category_icon: string;
    category_type: string;
    total_amount: number;
  }>(`
    SELECT 
      c.id as category_id,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      c.type as category_type,
      ROUND(SUM(t.amount), 2) as total_amount
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.month_year = ? AND t.type != 'INCOME' AND t.status = 'ACTIVE'
    GROUP BY c.id
    ORDER BY total_amount DESC
    LIMIT 5
  `).all(monthYear);

  const formatted = topCategories.map((cat) => ({
    ...cat,
    percentage: totalExpense > 0 ? Math.round((cat.total_amount / totalExpense) * 1000) / 10 : 0,
  }));

  res.json({
    monthYear,
    totalExpense,
    topCategories: formatted,
  });
});
