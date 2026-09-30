exports.up = (pgm) => {
  // Fix existing checkout notifications where recipient_user_id was not populated
  pgm.sql(`
    UPDATE notifications 
    SET recipient_user_id = employee_id,
        title = COALESCE(title, 'Check-Out Successful'),
        type = 'Attendance',
        priority = 'Low'
    WHERE recipient_user_id IS NULL AND employee_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  // No-op rollback as setting recipient_user_id is data correction
};
