import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  EMBED_WORKER: process.env.EMBED_WORKER || 'true',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  REPO_OWNER: process.env.REPO_OWNER || 'autocorp-sovereign',
  REPO_NAME: process.env.REPO_NAME || 'rea-autonomous-orchestrator-engine',
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  ENFORCE_MTLS: process.env.ENFORCE_MTLS || 'false',
  EXPECTED_SPIFFE_ID: process.env.EXPECTED_SPIFFE_ID || 'spiffe://autocorp.nexus/ns/production/sa/controller',
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rea-autonomous-orchestrator-engine.quantumsync.io',
  RATE_LIMIT_RPM: Number(process.env.RATE_LIMIT_RPM || 6000),
  CREATOR_DID: process.env.CREATOR_DID || 'did:nexus:dcb7f346c0caf740',
  CREATOR_PUBKEY:
    process.env.CREATOR_PUBKEY ||
    'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEK6TgdAXfOpZICOx8ykq03JPkYFEITC8EzqREgHip1K5umawd/9DPqita/q6r4Huo4JX1PhiAlHTg1guRey80N564ClSi6Qmu0EvG6XVAFx4XHi1ZUXd0kw2uXhg5JH0Z',
  SIGNING_PRIVATE_KEY_PEM: process.env.SIGNING_PRIVATE_KEY_PEM,
};

export const logger = {
  info: (objOrMsg: unknown, msg?: string) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[INFO]', msg || '', typeof objOrMsg === 'object' ? JSON.stringify(objOrMsg) : objOrMsg);
    }
  },
  warn: (objOrMsg: unknown, msg?: string) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[WARN]', msg || '', typeof objOrMsg === 'object' ? JSON.stringify(objOrMsg) : objOrMsg);
    }
  },
  error: (objOrMsg: unknown, msg?: string) => {
    console.error('[ERROR]', msg || '', typeof objOrMsg === 'object' ? JSON.stringify(objOrMsg) : objOrMsg);
  },
};
