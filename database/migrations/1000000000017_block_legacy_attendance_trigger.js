exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION block_outdated_attendance_checkin()
    RETURNS TRIGGER AS $$
    BEGIN
      -- If check_in is being set (not null) but shift_id is null, it is from the legacy backend
      IF NEW.check_in IS NOT NULL AND NEW.shift_id IS NULL THEN
        RAISE EXCEPTION 'Outdated app version. Please update your Falcon Attendance app.';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_block_legacy_attendance ON attendance;
    CREATE TRIGGER trg_block_legacy_attendance
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION block_outdated_attendance_checkin();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_block_legacy_attendance ON attendance;
    DROP FUNCTION IF EXISTS block_outdated_attendance_checkin();
  `);
};
