import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { db } from '../db/index.js';

export interface AuthUserPayload {
  userId: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Middleware d'authentification vérifiant le JWT d'accès (15m).
 * En cas d'expiration du token d'accès, il tente un rafraîchissement transparent
 * via le Refresh Token stocké et vérifié en base SQLite (E3).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['auth_token'] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
      req.user = decoded;
      return next();
    } catch (err: any) {
      // Si ce n'est pas une simple expiration, on rejette immédiatement
      if (err.name !== 'TokenExpiredError') {
        res.status(401).json({ error: 'Session invalide. Veuillez vous reconnecter.', code: 'INVALID_TOKEN' });
        return;
      }
    }
  }

  // Tentative de rafraîchissement transparent via Refresh Token
  const rawRefreshToken = req.cookies?.['refresh_token'] || req.headers['x-refresh-token'];
  if (typeof rawRefreshToken === 'string' && rawRefreshToken.length > 0) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const storedToken = db.prepare(`
      SELECT id, user_id, expires_at, revoked 
      FROM refresh_tokens 
      WHERE token_hash = ? AND revoked = 0
    `).get(tokenHash) as { id: string; user_id: string; expires_at: number; revoked: number } | undefined;

    if (storedToken && storedToken.expires_at > Date.now()) {
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(storedToken.user_id) as
        | { id: string; username: string }
        | undefined;

      if (user) {
        // Renouvellement du token d'accès (15 minutes)
        const newAccessToken = jwt.sign(
          { userId: user.id, username: user.username },
          env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        res.cookie('auth_token', newAccessToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        });

        req.user = { userId: user.id, username: user.username };
        return next();
      }
    }
  }

  res.status(401).json({ error: 'Non authentifié ou session expirée.', code: 'SESSION_EXPIRED' });
}
