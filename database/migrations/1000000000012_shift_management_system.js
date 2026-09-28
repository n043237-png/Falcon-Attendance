exports.up = (pgm) => {
  // 1. Create shifts table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_minutes INTEGER NOT NULL DEFAULT 60,
      grace_minutes INTEGER NOT NULL DEFAULT 15,
      minimum_work_hours NUMERIC(4,2) NOT NULL DEFAULT 8.00,
      late_after TIME NOT NULL,
      half_day_minutes INTEGER NOT NULL DEFAULT 240,
      overtime_enabled BOOLEAN NOT NULL DEFAULT true,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Add shift_id to users table
  pgm.sql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_users_shift_id ON users(shift_id);`);

  // 3. Create employee_shift_assignments table for history and future rotation
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employee_shift_assignments (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
      assignment_type VARCHAR(50) NOT NULL DEFAULT 'PERMANENT',
      start_date DATE NOT NULL,
      end_date DATE,
      assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_emp_shift_assign ON employee_shift_assignments(employee_id, start_date, end_date);`);

  // 4. Add shift tracking columns to attendance table
  pgm.sql(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS late_minutes NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overtime_minutes NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS early_departure_minutes NUMERIC(6,2) DEFAULT 0;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON attendance(shift_id);`);

  // 5. Seed default Day Shift (DS) and Night Shift (NS)
  pgm.sql(`
    INSERT INTO shifts (name, code, start_time, end_time, break_minutes, grace_minutes, minimum_work_hours, late_after, half_day_minutes, overtime_enabled, description, status)
    VALUES 
      ('Day Shift', 'DS', '09:30:00', '18:30:00', 60, 15, 8.00, '09:45:00', 240, true, 'Standard corporate day shift (09:30 AM - 06:30 PM)', 'active'),
      ('Night Shift', 'NS', '21:00:00', '06:00:00', 60, 15, 8.00, '21:15:00', 240, true, 'Overnight operations shift across midnight (09:00 PM - 06:00 AM)', 'active')
    ON CONFLICT (code) DO NOTHING;
  `);

  // 6. Map all existing users to default Day Shift (DS)
  pgm.sql(`
    UPDATE users
    SET shift_id = (SELECT id FROM shifts WHERE code = 'DS' LIMIT 1)
    WHERE shift_id IS NULL;
  `);

  // 7. Seed initial permanent assignment records for all existing employees
  pgm.sql(`
    INSERT INTO employee_shift_assignments (employee_id, shift_id, assignment_type, start_date, notes)
    SELECT u.id, u.shift_id, 'PERMANENT', CURRENT_DATE, 'Initial default shift assignment'
    FROM users u
    WHERE u.shift_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM employee_shift_assignments esa WHERE esa.employee_id = u.id
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS employee_shift_assignments;`);
  pgm.sql(`ALTER TABLE attendance DROP COLUMN IF EXISTS early_departure_minutes, DROP COLUMN IF EXISTS overtime_minutes, DROP COLUMN IF EXISTS late_minutes, DROP COLUMN IF EXISTS is_late, DROP COLUMN IF EXISTS shift_id;`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS shift_id;`);
  pgm.sql(`DROP TABLE IF EXISTS shifts;`);
};
