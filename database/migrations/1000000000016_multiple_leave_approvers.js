exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE leave_requests 
    ADD COLUMN IF NOT EXISTS assigned_to_ids INTEGER[] DEFAULT '{}';
  `);

  pgm.sql(`
    UPDATE leave_requests 
    SET assigned_to_ids = ARRAY[assigned_to] 
    WHERE assigned_to IS NOT NULL AND (assigned_to_ids IS NULL OR cardinality(assigned_to_ids) = 0);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE leave_requests DROP COLUMN IF EXISTS assigned_to_ids;`);
};
