import { query } from '../db';

async function migrateLateMessages() {
  console.log('Migrating historical late notifications to hours and minutes...');
  const res = await query("SELECT id, message FROM notifications WHERE message LIKE '%minutes late%'");
  console.log(`Found ${res.rows.length} notifications to update.`);

  let count = 0;
  for (const row of res.rows) {
    const match = row.message.match(/which is (\d+)\s*minutes late/i);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const lateH = Math.floor(minutes / 60);
      const lateM = minutes % 60;
      let lateDurationStr = `${minutes} minutes`;
      if (lateH > 0 && lateM > 0) {
        lateDurationStr = `${lateH}h ${lateM}m (${lateH} hour${lateH > 1 ? 's' : ''} ${lateM} mins)`;
      } else if (lateH > 0) {
        lateDurationStr = `${lateH} hour${lateH > 1 ? 's' : ''} (${lateH}h)`;
      } else {
        lateDurationStr = `${lateM} minute${lateM !== 1 ? 's' : ''}`;
      }

      const updatedMessage = row.message.replace(
        /which is \d+\s*minutes late/i,
        `which is ${lateDurationStr} late`
      );

      await query('UPDATE notifications SET message = $1 WHERE id = $2', [updatedMessage, row.id]);
      count++;
    }
  }

  console.log(`Successfully updated ${count} notifications.`);
  process.exit(0);
}

migrateLateMessages().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
