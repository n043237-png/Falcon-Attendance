"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
async function migrate() {
    console.log('Starting migration for Attendance Mode...');
    // 1. Add attendance_mode column to users table if not exists (VARCHAR(50) for future-ready modes)
    await (0, db_1.query)(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS attendance_mode VARCHAR(50) DEFAULT 'Office';
  `);
    console.log('Added attendance_mode to users table.');
    // Set default 'Office' for existing rows where null
    await (0, db_1.query)(`
    UPDATE users 
    SET attendance_mode = 'Office' 
    WHERE attendance_mode IS NULL;
  `);
    console.log('Updated existing users with default attendance_mode = Office.');
    // 2. Add columns to attendance table
    await (0, db_1.query)(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS attendance_mode VARCHAR(50) DEFAULT 'Office',
    ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC,
    ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC,
    ADD COLUMN IF NOT EXISTS check_in_address TEXT,
    ADD COLUMN IF NOT EXISTS check_in_selfie_url TEXT,
    ADD COLUMN IF NOT EXISTS check_out_latitude NUMERIC,
    ADD COLUMN IF NOT EXISTS check_out_longitude NUMERIC,
    ADD COLUMN IF NOT EXISTS check_out_address TEXT,
    ADD COLUMN IF NOT EXISTS check_out_selfie_url TEXT;
  `);
    console.log('Added attendance_mode, coordinates, address, and selfie columns to attendance table.');
    // Populate existing check_in_latitude / check_in_longitude from PostGIS check_in_location if present
    await (0, db_1.query)(`
    UPDATE attendance
    SET 
      attendance_mode = COALESCE(attendance_mode, 'Office'),
      check_in_latitude = COALESCE(check_in_latitude, ST_Y(check_in_location::geometry)),
      check_in_longitude = COALESCE(check_in_longitude, ST_X(check_in_location::geometry)),
      check_out_latitude = COALESCE(check_out_latitude, ST_Y(check_out_location::geometry)),
      check_out_longitude = COALESCE(check_out_longitude, ST_X(check_out_location::geometry))
    WHERE check_in_location IS NOT NULL AND check_in_latitude IS NULL;
  `);
    console.log('Backfilled check_in_latitude & check_in_longitude from geometry for existing rows.');
    // Verify columns
    const uCols = await (0, db_1.query)(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'attendance_mode';
  `);
    console.log('Users attendance_mode column:', uCols.rows);
    const aCols = await (0, db_1.query)(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name IN (
      'attendance_mode', 'check_in_latitude', 'check_in_longitude', 
      'check_in_address', 'check_in_selfie_url', 
      'check_out_latitude', 'check_out_longitude', 
      'check_out_address', 'check_out_selfie_url'
    );
  `);
    console.log('Attendance columns added:', aCols.rows);
    await db_1.pool.end();
    console.log('Migration finished successfully!');
}
migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
