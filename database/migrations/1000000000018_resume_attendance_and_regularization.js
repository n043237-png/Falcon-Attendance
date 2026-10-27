exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS first_checkout_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS resume_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS final_checkout_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS attendance_resumed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS resume_count INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS attendance_regularization_logs (
      id SERIAL PRIMARY KEY,
      attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_name VARCHAR(255) NOT NULL,
      previous_check_in TIMESTAMP WITH TIME ZONE,
      previous_check_out TIMESTAMP WITH TIME ZONE,
      new_check_in TIMESTAMP WITH TIME ZONE,
      new_check_out TIMESTAMP WITH TIME ZONE,
      previous_status VARCHAR(50),
      new_status VARCHAR(50),
      reason TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reg_logs_attendance_id ON attendance_regularization_logs(attendance_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS attendance_regularization_logs;
    ALTER TABLE attendance
    DROP COLUMN IF EXISTS first_checkout_time,
    DROP COLUMN IF EXISTS resume_time,
    DROP COLUMN IF EXISTS final_checkout_time,
    DROP COLUMN IF EXISTS attendance_resumed,
    DROP COLUMN IF EXISTS resume_count;
  `);
};
