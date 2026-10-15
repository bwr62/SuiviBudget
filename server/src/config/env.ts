import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env['JWT_SECRET'] || 'development_super_secret_key_minimum_32_characters_long_12345';

// RÈGLE ABSOLUE DE SÉCURITÉ : Crash immédiat si le secret JWT fait moins de 32 caractères
if (JWT_SECRET.length < 32) {
  console.error(`\x1b[31m[CRITICAL SECURITY ERROR] JWT_SECRET doit comporter au moins 32 caractères aléatoires (actuel: ${JWT_SECRET.length}). Le serveur refuse de démarrer.\x1b[0m`);
  process.exit(1);
}

export const env = {
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  PORT: parseInt(process.env['PORT'] || '3001', 10),
  CLIENT_ORIGIN: process.env['CLIENT_ORIGIN'] || 'http://localhost:5173',
  RP_NAME: process.env['RP_NAME'] || 'Suivi Budget PC',
  RP_ID: process.env['RP_ID'] || 'localhost',
  JWT_SECRET,
  JWT_EXPIRES_IN: '15m',
  REFRESH_EXPIRES_DAYS: 7,
};
