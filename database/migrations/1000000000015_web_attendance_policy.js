exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS allow_web_attendance BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  pgm.sql(`
    ALTER TABLE attendance 
    ADD COLUMN IF NOT EXISTS attendance_source VARCHAR(50) DEFAULT 'Mobile App';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE attendance DROP COLUMN IF EXISTS attendance_source;`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS allow_web_attendance;`);
};
