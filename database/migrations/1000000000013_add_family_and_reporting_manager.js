exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE employee_profiles 
    ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS father_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS reporting_manager VARCHAR(100);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE employee_profiles 
    DROP COLUMN IF EXISTS mother_name,
    DROP COLUMN IF EXISTS father_name,
    DROP COLUMN IF EXISTS reporting_manager;
  `);
};
