import { query } from '../db';

async function removeWhatsAppData() {
  console.log('Removing all WhatsApp notifications and logs...');

  const delNotif = await query(
    "DELETE FROM notifications WHERE title ILIKE '%WhatsApp%' OR message ILIKE '%WhatsApp%'"
  );
  console.log(`✓ Deleted ${delNotif.rowCount} WhatsApp notifications from notifications table.`);

  try {
    const delLogs = await query('DELETE FROM whatsapp_logs');
    console.log(`✓ Deleted ${delLogs.rowCount} rows from whatsapp_logs.`);
  } catch (err: any) {
    console.log('whatsapp_logs note:', err.message);
  }

  // Verification
  const check = await query(
    "SELECT count(*) FROM notifications WHERE title ILIKE '%WhatsApp%' OR message ILIKE '%WhatsApp%'"
  );
  console.log(`Remaining WhatsApp notifications: ${check.rows[0].count}`);

  process.exit(0);
}

removeWhatsAppData().catch((err) => {
  console.error('Error removing WhatsApp data:', err);
  process.exit(1);
});
