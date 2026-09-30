"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
async function migrate() {
    console.log('Migrating device_push_tokens...');
    // 1. Remove duplicates, keeping the most recent id
    await (0, db_1.query)(`
    DELETE FROM device_push_tokens a
    USING device_push_tokens b
    WHERE a.push_token = b.push_token AND a.id < b.id;
  `);
    console.log('Duplicate push tokens cleaned up.');
    // 2. Drop old constraint and add unique constraint on push_token
    await (0, db_1.query)(`
    ALTER TABLE device_push_tokens DROP CONSTRAINT IF EXISTS unique_user_token;
    ALTER TABLE device_push_tokens DROP CONSTRAINT IF EXISTS unique_device_push_token;
    ALTER TABLE device_push_tokens ADD CONSTRAINT unique_device_push_token UNIQUE (push_token);
  `);
    console.log('Constraint unique_device_push_token added.');
    // 3. Inspect resulting rows
    const res = await (0, db_1.query)(`SELECT id, user_id, push_token, updated_at FROM device_push_tokens`);
    console.log('Current device_push_tokens:', res.rows);
}
migrate()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
