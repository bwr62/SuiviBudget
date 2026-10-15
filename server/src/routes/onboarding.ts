import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { rolloverService } from '../services/rolloverService.js';
import { HouseholdProfile } from '../db/schema.js';

export const onboardingRouter = Router();

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
      subcategory_name: z.string().optional(),
      day_of_month: z.number().int().min(1).max(31).default(1),
      end_month_year: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
      carry_over: z.number().int().default(1),
    })
  ),
  current_month_year: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * GET /api/onboarding/status
 * Récupère le profil du foyer et l'état d'onboarding
 */
onboardingRouter.get('/status', (_req: Request, res: Response) => {
  const profile = db.prepare<[], HouseholdProfile>('SELECT * FROM household_profile WHERE id = 1').get();
  if (!profile) {
    res.json({ has_completed_onboarding: 0 });
    return;
  }
  res.json(profile);
});

/**
 * POST /api/onboarding/complete
 * Validation finale et enregistrement de l'assistant de première connexion
 */
onboardingRouter.post('/complete', (req: Request, res: Response) => {
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

      if (!subId && tpl.subcategory_name && tpl.subcategory_name.trim()) {
        const existingSub = db
          .prepare<[string, string], { id: string }>('SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?)')
          .get(tpl.category_id, tpl.subcategory_name.trim());

        if (existingSub) {
          subId = existingSub.id;
        } else {
          subId = 'sub-' + crypto.randomUUID().substring(0, 8);
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
    console.error('Erreur onboarding complete:', err);
    res.status(500).json({ error: err.message || "Erreur lors de l'enregistrement de l'onboarding" });
  }
});
