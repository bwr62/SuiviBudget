import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { monthsRouter } from './months.js';
import { transactionsRouter } from './transactions.js';
import { categoriesRouter } from './categories.js';
import { statsRouter } from './stats.js';
import { backupRouter } from './backup.js';
import { onboardingRouter } from './onboarding.js';
import { savingsRouter } from './savings.js';
import { errorHandler } from '../middlewares/errorHandler.js';

export const apiRouter = Router();

// Middleware d'authentification sur l'ensemble de l'API financière
apiRouter.use(requireAuth);

// Montage des sous-routeurs thématiques spécialisés (H1)
apiRouter.use('/months', monthsRouter);
apiRouter.use('/', transactionsRouter);
apiRouter.use('/', categoriesRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/backup', backupRouter);
apiRouter.use('/onboarding', onboardingRouter);
apiRouter.use('/savings', savingsRouter);

// Gestionnaire d'erreurs centralisé
apiRouter.use(errorHandler);
