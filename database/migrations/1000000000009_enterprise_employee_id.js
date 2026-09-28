exports.up = (pgm) => {
  // 1. Add employee_code column to users if not present
  pgm.sql(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
  `);

  // 2. Synchronize existing employee_id into employee_code
  pgm.sql(`
    UPDATE users 
    SET employee_code = employee_id 
    WHERE employee_code IS NULL;
  `);

  // 3. Add is_custom_employee_id flag to users
  pgm.sql(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS is_custom_employee_id BOOLEAN DEFAULT FALSE;
  `);

  // 4. Mark legacy custom IDs as custom (e.g., ADMIN001 and Amit malik)
  pgm.sql(`
    UPDATE users 
    SET is_custom_employee_id = TRUE 
    WHERE NOT (employee_id ~* '^FISPL[0-9]+$');
  `);

  // 5. Create case-insensitive unique indexes on employee_code and employee_id
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_code_lower 
    ON users (LOWER(employee_code));
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_lower 
    ON users (LOWER(employee_id));
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_is_custom_employee_id 
    ON users (is_custom_employee_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_users_is_custom_employee_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_users_employee_id_lower;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_users_employee_code_lower;`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS is_custom_employee_id;`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS employee_code;`);
};
