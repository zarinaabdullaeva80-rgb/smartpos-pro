import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env only if running locally (don't override Railway-injected env vars)
dotenv.config({ path: path.join(__dirname, '../../.env'), override: false });

const { Pool } = pg;

// Support DATABASE_URL / DATABASE_PUBLIC_URL for Railway, Neon, etc.
const getConnectionString = () => {
  // Railway internal (private networking) or any standard DATABASE_URL
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')) {
    console.log('[DB] Using DATABASE_URL:', process.env.DATABASE_URL.split('@')[1] || 'set');
    return process.env.DATABASE_URL;
  }
  // Railway public URL fallback
  if (process.env.DATABASE_PUBLIC_URL) {
    console.log('[DB] Using DATABASE_PUBLIC_URL:', process.env.DATABASE_PUBLIC_URL.split('@')[1] || 'set');
    return process.env.DATABASE_PUBLIC_URL;
  }
  // Standard DATABASE_URL (including localhost for dev)
  if (process.env.DATABASE_URL) {
    console.log('[DB] Using DATABASE_URL (local)');
    return process.env.DATABASE_URL;
  }
  return null;
};

const getSSLConfig = () => {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  // Auto-detect SSL based on connection string
  const connStr = getConnectionString();
  // Railway internal private network — no SSL needed
  if (connStr && connStr.includes('postgres.railway.internal')) {
    return false;
  }
  // Railway public TCP proxy — SSL with self-signed cert support
  if (connStr && connStr.includes('.rlwy.')) {
    return { rejectUnauthorized: false };
  }
  // Neon and other cloud providers
  if (connStr && connStr.includes('neon.tech')) {
    return { rejectUnauthorized: false };
  }
  return false;
};

const connectionString = getConnectionString();

const poolConfig = connectionString
  ? {
    connectionString,
    ssl: getSSLConfig(),
    max: 5,                          // Railway has connection limits
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,  // Higher timeout for cloud latency
    allowExitOnIdle: false,
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_1c',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    client_encoding: 'UTF8'
  };

const pool = new Pool(poolConfig);


// Проверка подключения и установка кодировки
pool.on('connect', async (client) => {
  try {
    await client.query('SET client_encoding TO "UTF8"');
    console.log('✓ Подключение к базе данных PostgreSQL установлено');
  } catch (err) {
    console.error('Ошибка установки кодировки:', err);
  }
});

pool.on('error', (err) => {
  // Log but don't crash — Railway drops idle connections periodically
  console.error('⚠️ Pool error (non-fatal):', err.message);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
