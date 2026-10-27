import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db';
import migration from '../../database/migrations/1000000000018_resume_attendance_and_regularization';

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running migration 1000000000018_resume_attendance_and_regularization...');
    await client.query('BEGIN');

    const queries: string[] = [];
    const fakePgm = {
      sql: (sqlText: string) => {
        queries.push(sqlText);
      }
    };

    migration.up(fakePgm);

    for (const q of queries) {
      console.log('Executing SQL:', q.trim().substring(0, 60), '...');
      await client.query(q);
    }

    const existing = await client.query('SELECT id FROM pgmigrations WHERE name = $1', ['1000000000018_resume_attendance_and_regularization']);
    if (existing.rows.length === 0) {
      await client.query('INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())', ['1000000000018_resume_attendance_and_regularization']);
    }

    await client.query('COMMIT');
    console.log('Migration 1000000000018 completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
