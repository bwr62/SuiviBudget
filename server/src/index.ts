import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';

const app = express();

// 1. Protection HTTP & Sécurité applicative
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:3001'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
}));

app.use(cors({
  origin: env.CLIENT_ORIGIN,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// 2. Limitation du taux de requêtes (Anti Brute-Force) sur l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de tentatives, veuillez patienter 15 minutes.' },
});

// 3. Route de santé système publique
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.07',
    serverTime: new Date().toISOString(),
  });
});

// 4. Montage des routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api', apiRouter);

app.listen(env.PORT, () => {
  console.log(`\x1b[32m🚀 [Suivi Budget PC v0.01] Serveur démarré sur http://localhost:${env.PORT}\x1b[0m`);
  console.log(`🔒 [Sécurité] Validation JWT_SECRET: OK (>= 32 caractères)`);
  console.log(`🌐 [CORS] Origine client autorisée: ${env.CLIENT_ORIGIN}`);
});

export default app;
