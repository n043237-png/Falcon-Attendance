"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const holidays2025 = [
    {
        holiday_date: '2025-01-01',
        name: 'New Year',
        description: 'First day of the year in the Gregorian calendar.',
    },
    {
        holiday_date: '2025-01-26',
        name: 'India Republic Day',
        description: 'Honoring the date on which the Constitution of India came into effect.',
    },
    {
        holiday_date: '2025-03-14',
        name: 'Holi',
        description: 'The Festival of Colours celebrating the arrival of spring, joy, and new beginnings.',
    },
    {
        holiday_date: '2025-03-31',
        name: 'Eid al-Fitr',
        description: 'Islamic festival marking the joyous conclusion of Ramadan and fasting.',
    },
    {
        holiday_date: '2025-08-15',
        name: 'Independence Day',
        description: 'Commemorating national independence and sovereignty.',
    },
    {
        holiday_date: '2025-08-09',
        name: 'Raksha Bandhan',
        description: 'Celebrating the sacred bond of mutual love, affection, and protection between siblings.',
    },
    {
        holiday_date: '2025-08-16',
        name: 'Janmashtami',
        description: 'Celebrating the birth of Lord Krishna.',
    },
    {
        holiday_date: '2025-10-01',
        name: 'Dussehra',
        description: 'Signifying the victory of good over evil across the nation.',
    },
    {
        holiday_date: '2025-10-02',
        name: 'Gandhi Jayanti',
        description: 'Honoring the birthday of Mahatma Gandhi, Father of the Nation.',
    },
    {
        holiday_date: '2025-10-21',
        name: 'Diwali',
        description: 'The Festival of Lights celebrating spiritual victory of light over darkness.',
    },
];
const holidays2027 = [
    {
        holiday_date: '2027-01-01',
        name: 'New Year',
        description: 'First day of the year in the Gregorian calendar.',
    },
    {
        holiday_date: '2027-01-26',
        name: 'India Republic Day',
        description: 'Honoring the date on which the Constitution of India came into effect.',
    },
    {
        holiday_date: '2027-03-10',
        name: 'Eid al-Fitr',
        description: 'Islamic festival marking the joyous conclusion of Ramadan and fasting.',
    },
    {
        holiday_date: '2027-03-22',
        name: 'Holi',
        description: 'The Festival of Colours celebrating the arrival of spring, joy, and new beginnings.',
    },
    {
        holiday_date: '2027-08-15',
        name: 'Independence Day',
        description: 'Commemorating national independence and sovereignty.',
    },
    {
        holiday_date: '2027-08-17',
        name: 'Raksha Bandhan',
        description: 'Celebrating the sacred bond of mutual love, affection, and protection between siblings.',
    },
    {
        holiday_date: '2027-08-25',
        name: 'Janmashtami',
        description: 'Celebrating the birth of Lord Krishna.',
    },
    {
        holiday_date: '2027-10-02',
        name: 'Gandhi Jayanti',
        description: 'Honoring the birthday of Mahatma Gandhi, Father of the Nation.',
    },
    {
        holiday_date: '2027-10-09',
        name: 'Dussehra',
        description: 'Signifying the victory of good over evil across the nation.',
    },
    {
        holiday_date: '2027-10-29',
        name: 'Diwali',
        description: 'The Festival of Lights celebrating spiritual victory of light over darkness.',
    },
];
async function seedHolidays() {
    console.log('Seeding official company holidays for 2025 and 2027...');
    // Also update 2026 Gandhi Jayanti description if missing
    await (0, db_1.query)(`
    UPDATE holidays 
    SET description = 'Honoring the birthday of Mahatma Gandhi, Father of the Nation.'
    WHERE name = 'Gandhi Jayanti' AND holiday_date >= '2026-01-01' AND holiday_date <= '2026-12-31' AND (description IS NULL OR description = '')
  `);
    const allHolidays = [...holidays2025, ...holidays2027];
    for (const h of allHolidays) {
        await (0, db_1.query)(`
      INSERT INTO holidays (holiday_date, name, description, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (holiday_date) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = true,
          updated_at = NOW()
    `, [h.holiday_date, h.name, h.description]);
        console.log(`✓ Inserted/Updated: ${h.name} on ${h.holiday_date}`);
    }
    // Verification counts
    const res2025 = await (0, db_1.query)(`SELECT count(*) FROM holidays WHERE holiday_date >= '2025-01-01' AND holiday_date <= '2025-12-31'`);
    const res2026 = await (0, db_1.query)(`SELECT count(*) FROM holidays WHERE holiday_date >= '2026-01-01' AND holiday_date <= '2026-12-31'`);
    const res2027 = await (0, db_1.query)(`SELECT count(*) FROM holidays WHERE holiday_date >= '2027-01-01' AND holiday_date <= '2027-12-31'`);
    console.log(`\nVerification:`);
    console.log(`2025 Holidays: ${res2025.rows[0].count}`);
    console.log(`2026 Holidays: ${res2026.rows[0].count}`);
    console.log(`2027 Holidays: ${res2027.rows[0].count}`);
    process.exit(0);
}
seedHolidays().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
});
