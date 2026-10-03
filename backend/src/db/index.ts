import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.warn('[Postgres Pool Warning] Idle client error:', err.message);
});

// Helper for executing queries
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

