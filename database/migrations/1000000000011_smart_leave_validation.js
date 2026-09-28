exports.up = (pgm) => {
  // 1. Create leave_settings table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS leave_settings (
      id SERIAL PRIMARY KEY,
      enable_holiday_validation BOOLEAN DEFAULT TRUE,
      enable_sunday_validation BOOLEAN DEFAULT TRUE,
      enable_weekly_off_validation BOOLEAN DEFAULT TRUE,
      show_leave_impact_summary BOOLEAN DEFAULT TRUE,
      weekly_off_days JSONB DEFAULT '[0]'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Insert default row (id = 1)
  pgm.sql(`
    INSERT INTO leave_settings (id, enable_holiday_validation, enable_sunday_validation, enable_weekly_off_validation, show_leave_impact_summary, weekly_off_days)
    VALUES (1, TRUE, TRUE, TRUE, TRUE, '[0]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 3. Add composite index on leave_requests for fast overlap checking
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_overlap
    ON leave_requests(employee_id, status, from_date, to_date);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_leave_requests_overlap;`);
  pgm.sql(`DROP TABLE IF EXISTS leave_settings;`);
};
