"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
async function run() {
    try {
        const res = await (0, index_1.query)(`
      SELECT id, title, message, action_url, attendance_date,
             to_char(attendance_date, 'YYYY-MM-DD') as att_date_str,
             to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as ist_created_date
      FROM notifications
      WHERE title IN ('Daily Attendance Alert', 'Employee Checked In Late')
      ORDER BY id DESC
    `);
        console.log(`Found ${res.rows.length} notifications to review.`);
        for (const row of res.rows) {
            const dateStr = row.att_date_str || row.ist_created_date;
            let newActionUrl = row.action_url;
            if (row.title === 'Daily Attendance Alert') {
                newActionUrl = `/attendance?status=Absent&date=${dateStr}`;
            }
            else if (row.title === 'Employee Checked In Late') {
                // Extract employee name from message: e.g. "Mangesh Bansal checked in late today..."
                const match = row.message.match(/^(.+?)\s+checked in late/i);
                const empName = match ? match[1].trim() : '';
                newActionUrl = `/attendance?status=Late&date=${dateStr}${empName ? `&search=${encodeURIComponent(empName)}` : ''}`;
            }
            if (newActionUrl !== row.action_url) {
                console.log(`Updating ID ${row.id}: ${row.action_url} -> ${newActionUrl}`);
                await (0, index_1.query)(`UPDATE notifications SET action_url = $1 WHERE id = $2`, [newActionUrl, row.id]);
            }
        }
        console.log('Update complete.');
    }
    catch (err) {
        console.error('Error running script:', err);
    }
    finally {
        await index_1.pool.end();
    }
}
run();
