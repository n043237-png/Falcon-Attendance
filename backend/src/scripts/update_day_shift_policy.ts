import { query } from '../db';

async function updateDayShiftPolicy() {
  console.log('Applying New Day Shift Configuration & Attendance Rules...');

  // 1. Update Day Shift in shifts table
  const shiftRes = await query(`
    UPDATE shifts
    SET 
      name = 'Day Shift',
      start_time = '09:30:00',
      end_time = '18:30:00',
      late_after = '10:00:00',
      grace_minutes = 30,
      minimum_work_hours = 8.50,
      description = 'Standard corporate day shift (09:30 AM - 06:30 PM, 510 mins required)',
      updated_at = CURRENT_TIMESTAMP
    WHERE code = 'DS' OR id = 1
    RETURNING *;
  `);

  console.log('Updated shift:', shiftRes.rows[0]);

  // 2. Update global attendance_settings
  const settingsRes = await query(`
    UPDATE attendance_settings
    SET 
      office_start = '09:30:00',
      office_end = '18:30:00',
      late_threshold = '10:00:00',
      absence_cutoff = '11:00:00',
      full_day_minutes = 510,
      half_day_minutes = 255,
      checkout_reminder_time = '19:00:00',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *;
  `);

  console.log('Updated attendance_settings:', settingsRes.rows[0]);
  console.log('Day Shift Configuration applied successfully.');
  process.exit(0);
}

updateDayShiftPolicy().catch((err) => {
  console.error('Failed to update day shift policy:', err);
  process.exit(1);
});
