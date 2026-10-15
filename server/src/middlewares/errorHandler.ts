import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Middleware centralisé de gestion des erreurs serveur et validation (Audit Section 4.2)
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API Error]:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Erreur de validation des données',
      details: err.format(),
    });
    return;
  }

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message = err.message || 'Une erreur interne est survenue sur le serveur.';

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
  });
}
