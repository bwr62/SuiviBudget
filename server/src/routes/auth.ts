import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { z } from 'zod';
import { db } from '../db/index.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middlewares/auth.js';

export const authRouter = Router();

// Persistance SQLite des challenges temporaires WebAuthn avec TTL (5 minutes)
function saveChallenge(key: string, challenge: string): void {
  // Nettoyer les challenges expirés (> 5 minutes)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  db.prepare('DELETE FROM auth_challenges WHERE created_at < ?').run(fiveMinAgo);

  db.prepare(`
    INSERT OR REPLACE INTO auth_challenges (key, challenge, created_at)
    VALUES (?, ?, ?)
  `).run(key, challenge, Date.now());
}

function getAndConsumeChallenge(key: string): string | null {
  const row = db.prepare('SELECT challenge, created_at FROM auth_challenges WHERE key = ?').get(key) as { challenge: string; created_at: number } | undefined;
  if (!row) return null;

  // Supprimer après lecture (usage unique)
  db.prepare('DELETE FROM auth_challenges WHERE key = ?').run(key);

  // Vérifier TTL (5 minutes)
  if (Date.now() - row.created_at > 5 * 60 * 1000) {
    return null;
  }

  return row.challenge;
}

/**
 * Génère un Access Token (15m) et un Refresh Token cryptographique (7d) persisté en base SQLite (E3)
 */
export function issueAuthTokens(res: Response, userId: string, username: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ userId, username }, env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked)
    VALUES (?, ?, ?, ?, 0)
  `).run(crypto.randomUUID(), userId, tokenHash, expiresAt);

  res.cookie('auth_token', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
}

const registerStartSchema = z.object({
  username: z.string().min(2).max(50),
});

const registerFinishSchema = z.object({
  username: z.string().min(2).max(50),
  response: z.custom<RegistrationResponseJSON>(),
});

const loginStartSchema = z.object({
  username: z.string().min(2).max(50),
});

const loginFinishSchema = z.object({
  username: z.string().min(2).max(50),
  response: z.custom<AuthenticationResponseJSON>(),
});

const recoveryLoginSchema = z.object({
  username: z.string().min(2).max(50),
  recoveryCode: z.string().min(6),
});

/**
 * 0. État d'initialisation du système : y a-t-il déjà un utilisateur configuré ?
 */
authRouter.get('/status', (_req: Request, res: Response) => {
  const user = db.prepare('SELECT id, username, created_at FROM users LIMIT 1').get() as { id: string; username: string; created_at: string } | undefined;
  res.json({
    hasUser: !!user,
    user: user ? { id: user.id, username: user.username } : null,
  });
});

/**
 * 1. Enregistrement WebAuthn - Étape 1 : Options
 */
authRouter.post('/register/start', async (req: Request, res: Response) => {
  const parseResult = registerStartSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format invalide', details: parseResult.error.format() });
    return;
  }

  const { username } = parseResult.data;

  // Récupérer ou pré-générer l'utilisateur
  let user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  const userId = user ? user.id : crypto.randomUUID();

  // Clés existantes pour exclusion
  const existingPasskeys = db
    .prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?')
    .all(userId) as Array<{ credential_id: string; transports: string | null }>;

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userID: new Uint8Array(Buffer.from(userId)),
    userName: username,
    userDisplayName: username,
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((p) => ({
      id: p.credential_id,
      transports: p.transports ? JSON.parse(p.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  saveChallenge(`reg_${username}`, options.challenge);
  res.json(options);
});

/**
 * 2. Enregistrement WebAuthn - Étape 2 : Vérification et stockage
 */
authRouter.post('/register/finish', async (req: Request, res: Response) => {
  const parseResult = registerFinishSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format invalide', details: parseResult.error.format() });
    return;
  }

  const { username, response } = parseResult.data;
  const expectedChallenge = getAndConsumeChallenge(`reg_${username}`);

  if (!expectedChallenge) {
    res.status(400).json({ error: 'Challenge expiré ou non trouvé.' });
    return;
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.CLIENT_ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Échec de vérification WebAuthn.' });
      return;
    }

    const { credential } = verification.registrationInfo;

    let recoveryCode = '';
    let recoveryHash = '';

    // Vérifier si l'utilisateur existe déjà
    let user = db.prepare('SELECT id, recovery_hash FROM users WHERE username = ?').get(username) as
      | { id: string; recovery_hash: string }
      | undefined;

    const userId = user?.id ?? crypto.randomUUID();

    if (!user) {
      // Générer un code de secours maître sécurisé (ex: 4 blocs de 4 lettres/chiffres)
      recoveryCode = crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-') || 'RECOVERY-CODE-1234';
      recoveryHash = await argon2.hash(recoveryCode);

      db.prepare(`
        INSERT INTO users (id, username, recovery_hash)
        VALUES (?, ?, ?)
      `).run(userId, username, recoveryHash);
    }

    // Sauvegarde de la passkey
    db.prepare(`
      INSERT OR REPLACE INTO passkeys (credential_id, user_id, public_key, counter, transports)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      credential.id,
      userId,
      Buffer.from(credential.publicKey),
      credential.counter,
      response.response.transports ? JSON.stringify(response.response.transports) : null
    );

    // Génération de la paire Access Token (15m) + Refresh Token (7d)
    issueAuthTokens(res, userId, username);

    res.json({
      verified: true,
      recoveryCode: recoveryCode || undefined, // Fourni à la création initiale pour archivage sécurisé
      user: { id: userId, username },
    });
  } catch (error: any) {
    console.error('Erreur register WebAuthn:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la vérification' });
  }
});

/**
 * 3. Authentification WebAuthn - Étape 1 : Options
 */
authRouter.post('/login/start', async (req: Request, res: Response) => {
  const parseResult = loginStartSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format invalide', details: parseResult.error.format() });
    return;
  }

  const { username } = parseResult.data;
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  const userPasskeys = db
    .prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?')
    .all(user.id) as Array<{ credential_id: string; transports: string | null }>;

  if (userPasskeys.length === 0) {
    res.status(400).json({ error: 'Aucune clé Passkey enregistrée pour cet utilisateur.' });
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    allowCredentials: userPasskeys.map((p) => ({
      id: p.credential_id,
      transports: p.transports ? JSON.parse(p.transports) : undefined,
    })),
    userVerification: 'preferred',
  });

  saveChallenge(`auth_${username}`, options.challenge);
  res.json(options);
});

/**
 * 4. Authentification WebAuthn - Étape 2 : Vérification
 */
authRouter.post('/login/finish', async (req: Request, res: Response) => {
  const parseResult = loginFinishSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format invalide', details: parseResult.error.format() });
    return;
  }

  const { username, response } = parseResult.data;
  const expectedChallenge = getAndConsumeChallenge(`auth_${username}`);

  if (!expectedChallenge) {
    res.status(400).json({ error: 'Challenge expiré ou non trouvé.' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  const passkey = db
    .prepare('SELECT credential_id, public_key, counter, transports FROM passkeys WHERE credential_id = ? AND user_id = ?')
    .get(response.id, user.id) as { credential_id: string; public_key: Buffer; counter: number; transports: string | null } | undefined;

  if (!passkey) {
    res.status(400).json({ error: 'Passkey inconnue pour cet utilisateur.' });
    return;
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.CLIENT_ORIGIN,
      expectedRPID: env.RP_ID,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      res.status(400).json({ error: 'Échec de vérification WebAuthn.' });
      return;
    }

    // Mise à jour du compteur anti-rejeu / anti-clonage
    db.prepare('UPDATE passkeys SET counter = ? WHERE credential_id = ?').run(
      verification.authenticationInfo.newCounter,
      passkey.credential_id
    );

    issueAuthTokens(res, user.id, username);

    res.json({
      verified: true,
      user: { id: user.id, username },
    });
  } catch (error: any) {
    console.error('Erreur login WebAuthn:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la connexion' });
  }
});

const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // Maximum 5 tentatives de code de secours par heure
  message: { error: 'Trop de tentatives de code de secours. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 5. Secours d'urgence (Recovery Code Hash via Argon2id)
 */
authRouter.post('/login/recovery', recoveryLimiter, async (req: Request, res: Response) => {
  const parseResult = recoveryLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Format invalide' });
    return;
  }

  const { username, recoveryCode } = parseResult.data;
  const user = db.prepare('SELECT id, recovery_hash FROM users WHERE username = ?').get(username) as
    | { id: string; recovery_hash: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  const isValid = await argon2.verify(user.recovery_hash, recoveryCode.trim().toUpperCase());
  if (!isValid) {
    res.status(401).json({ error: 'Code de secours invalide.' });
    return;
  }

  issueAuthTokens(res, user.id, username);

  res.json({
    verified: true,
    user: { id: user.id, username },
  });
});

/**
 * 6. Renouvellement de session via Refresh Token (E3)
 */
authRouter.post('/refresh', (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.['refresh_token'] || req.body?.refreshToken;
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    res.status(401).json({ error: 'Refresh token manquant.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const stored = db.prepare(`
    SELECT id, user_id, expires_at, revoked 
    FROM refresh_tokens 
    WHERE token_hash = ? AND revoked = 0
  `).get(tokenHash) as { id: string; user_id: string; expires_at: number; revoked: number } | undefined;

  if (!stored || stored.expires_at <= Date.now()) {
    res.clearCookie('auth_token');
    res.clearCookie('refresh_token');
    res.status(401).json({ error: 'Refresh token invalide ou expiré.' });
    return;
  }

  // Révocation de l'ancien token (rotation stricte)
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(stored.user_id) as
    | { id: string; username: string }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  issueAuthTokens(res, user.id, user.username);
  res.json({ success: true, user: { id: user.id, username: user.username } });
});

/**
 * 7. Déconnexion avec révocation du Refresh Token
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.['refresh_token'];
  if (rawRefreshToken && typeof rawRefreshToken === 'string') {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }
  res.clearCookie('auth_token');
  res.clearCookie('refresh_token');
  res.json({ success: true });
});

/**
 * 7. Obtenir l'utilisateur connecté actuellement
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
