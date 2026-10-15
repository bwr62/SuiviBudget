import { Router, Request, Response } from 'express';
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

// Cache en mémoire pour les challenges WebAuthn temporaires (clé: username ou userId)
const currentChallenges = new Map<string, string>();

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

  currentChallenges.set(`reg_${username}`, options.challenge);
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
  const expectedChallenge = currentChallenges.get(`reg_${username}`);

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
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Échec de vérification WebAuthn.' });
      return;
    }

    currentChallenges.delete(`reg_${username}`);

    const { credential } = verification.registrationInfo;

    let recoveryCode = '';
    let recoveryHash = '';

    // Vérifier si l'utilisateur existe déjà
    let user = db.prepare('SELECT id, recovery_hash FROM users WHERE username = ?').get(username) as
      | { id: string; recovery_hash: string }
      | undefined;

    let userId = user?.id;

    if (!user) {
      userId = crypto.randomUUID();
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

    // Génération du JWT de session
    const token = jwt.sign({ userId, username }, env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

  currentChallenges.set(`auth_${username}`, options.challenge);
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
  const expectedChallenge = currentChallenges.get(`auth_${username}`);

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
    });

    if (!verification.verified || !verification.authenticationInfo) {
      res.status(400).json({ error: 'Échec de vérification WebAuthn.' });
      return;
    }

    currentChallenges.delete(`auth_${username}`);

    // Mise à jour du compteur anti-rejeu / anti-clonage
    db.prepare('UPDATE passkeys SET counter = ? WHERE credential_id = ?').run(
      verification.authenticationInfo.newCounter,
      passkey.credential_id
    );

    const token = jwt.sign({ userId: user.id, username }, env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      verified: true,
      user: { id: user.id, username },
    });
  } catch (error: any) {
    console.error('Erreur login WebAuthn:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la connexion' });
  }
});

/**
 * 5. Secours d'urgence (Recovery Code Hash via Argon2id)
 */
authRouter.post('/login/recovery', async (req: Request, res: Response) => {
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

  const token = jwt.sign({ userId: user.id, username }, env.JWT_SECRET, { expiresIn: '7d' });

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    verified: true,
    user: { id: user.id, username },
  });
});

/**
 * 6. Déconnexion
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

/**
 * 7. Obtenir l'utilisateur connecté actuellement
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
