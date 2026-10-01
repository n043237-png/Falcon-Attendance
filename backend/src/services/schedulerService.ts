import cron from 'node-cron';
import { query } from '../db';
import { getAttendanceSettings } from './attendanceStatusService';
import { NotificationService } from './notificationService';
import { checkAndSendLateAttendanceAlerts } from './whatsappService';

export function startScheduler() {
  // 1-Month Retention Policy: Clean up notifications older than 30 days on startup
  cleanupExpiredNotifications().catch((err) =>
    console.error('[Scheduler] Initial notification retention cleanup error:', err)
  );

  // Daily Notification Retention Cleanup - Runs every night at 00:05 AM IST
  cron.schedule('5 0 * * *', async () => {
    try {
      await cleanupExpiredNotifications();
    } catch (e) {
      console.error('[Scheduler] Daily notification cleanup error:', e);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 10:00 AM IST - Daily Morning Attendance Check-In Reminder Push Notification
  cron.schedule('0 10 * * 1-6', async () => {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      // Check holidays
      const holidayRes = await query('SELECT id FROM holidays WHERE holiday_date = $1 AND is_active = true', [dateStr]);
      if (holidayRes.rows.length > 0) return;

      // Find active employees without check-in today and without approved leave
      const missingRes = await query(`
        SELECT u.id, u.name
        FROM users u
        WHERE u.status = 'active'
          AND u.role IN ('employee', 'admin')
          AND NOT EXISTS (
            SELECT 1 FROM attendance a WHERE a.employee_id = u.id AND a.attendance_date = $1
          )
          AND NOT EXISTS (
            SELECT 1 FROM leave_requests lr 
            WHERE lr.employee_id = u.id 
              AND lr.status = 'APPROVED' 
              AND lr.from_date <= $1 
              AND lr.to_date >= $1
          )
      `, [dateStr]);

      for (const emp of missingRes.rows) {
        try {
          const alreadyNotified = await query(
            `SELECT id FROM notifications WHERE recipient_user_id = $1 AND title = '⏰ Reminder' AND attendance_date = $2`,
            [emp.id, dateStr]
          );
          if (alreadyNotified.rows.length === 0) {
            await NotificationService.notifyUser(emp.id, {
              title: '⏰ Reminder',
              message: 'You have not marked your attendance yet. Please check in before 11:00 AM.',
              type: 'Attendance',
              priority: 'High',
              actionUrl: '/home',
              attendanceDate: dateStr,
            });
          }
        } catch (err) {
          console.error(`Failed to send morning reminder to user ${emp.id}:`, err);
        }
      }
    } catch (e) {
      console.error('[Scheduler] 10:00 AM Attendance Reminder error:', e);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 11:00 AM IST - Daily Late Attendance WhatsApp Alerts (Disabled per request)
  /*
  cron.schedule('0 11 * * *', async () => {
    try {
      console.log('[Scheduler] 11:00 AM IST: Checking late attendance and sending WhatsApp alerts...');
      await checkAndSendLateAttendanceAlerts();
    } catch (e) {
      console.error('[Scheduler] 11:00 AM Late Attendance WhatsApp error:', e);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
  */

  // Quarterly Credit Engine - Runs every day at 00:01
  cron.schedule('1 0 * * *', async () => {

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // Only run on Jan 1, Apr 1, Jul 1, Oct 1
      if (day === 1 && [1, 4, 7, 10].includes(month)) {
        const year = now.getFullYear();
        const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
        
        try {
          await client.query('BEGIN');
          
          // Get policy
          const policyRes = await client.query(`SELECT * FROM leave_policy LIMIT 1`);
          const creditDays = policyRes.rows.length > 0 ? parseFloat(policyRes.rows[0].quarterly_leave) : 4.5;
          const probMonths = policyRes.rows.length > 0 ? parseInt(policyRes.rows[0].probation_months) : 6;

          // Find eligible active employees
          const employeesRes = await client.query(`SELECT id, joining_date FROM users WHERE status = 'active' AND joining_date IS NOT NULL`);
          
          for (const emp of employeesRes.rows) {
            const joinDate = new Date(emp.joining_date);
            const probDate = new Date(joinDate);
            probDate.setMonth(probDate.getMonth() + probMonths);

            if (now >= probDate) {
              const balRes = await client.query(`SELECT id, last_credit_date FROM leave_balances WHERE employee_id = $1 AND year = $2`, [emp.id, year]);
              
              if (balRes.rows.length === 0) {
                await client.query(`
                  INSERT INTO leave_balances (employee_id, year, accrued_leave, current_balance, last_credit_date)
                  VALUES ($1, $2, $3, $4, CURRENT_DATE)
                `, [emp.id, year, creditDays, creditDays]);
              } else {
                const b = balRes.rows[0];
                const lastCredit = b.last_credit_date ? new Date(b.last_credit_date) : null;
                
                // Only credit if we haven't credited today
                if (!lastCredit || lastCredit.toDateString() !== now.toDateString()) {
                  await client.query(`
                    UPDATE leave_balances
                    SET accrued_leave = accrued_leave + $1,
                        current_balance = current_balance + $1,
                        last_credit_date = CURRENT_DATE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                  `, [creditDays, b.id]);
                }
              }
            }
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Quarterly credit error:', err);
        } finally {
          client.release();
        }
      }
    } catch (e) {
      console.error('Quarterly credit schedule error:', e);
    }
  });

  // Daily Attendance Processing - Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Current date in IST
      const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      // Current time in IST (HH:MM:SS)
      const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }); // 24hr format

      // 0. FIVE-MINUTE REMINDERS: 5 min before late mark (Login) & 5 min before shift end (Logout)
      await checkAndSendFiveMinuteReminders(dateStr, timeStr);

      const settings = await getAttendanceSettings();

      // Check holidays and weekends
      const isWeekend = new Date(dateStr).getDay() === 0; // Sunday only
      const holidayRes = await query('SELECT id FROM holidays WHERE holiday_date = $1 AND is_active = true', [dateStr]);
      const isHoliday = holidayRes.rows.length > 0;

      if (isWeekend || isHoliday) {
        return; // Don't process absence on holidays/weekends
      }

      // 1. ABSENCE PROCESSING
      // If current time >= absence_cutoff
      if (timeStr >= settings.absence_cutoff) {
        // Find active employees with no check-in today
        const absentRes = await query(`
          SELECT u.id, u.name, u.employee_id as emp_code, u.role
          FROM users u
          WHERE u.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM attendance a WHERE a.employee_id = u.id AND a.attendance_date = $1
          )
        `, [dateStr]);

        const absentCount = absentRes.rows.length;

        for (const user of absentRes.rows) {
          const empCode = user.emp_code || `FISPL${String(user.id).padStart(3, '0')}`;

          // Check for approved leave
          const leaveRes = await query(`
            SELECT leave_type 
            FROM leave_requests 
            WHERE employee_id = $1 
              AND status = 'APPROVED' 
              AND from_date <= $2 
              AND to_date >= $2
          `, [user.id, dateStr]);

          let attendanceStatus = 'ABSENT';
          
          if (leaveRes.rows.length > 0) {
            attendanceStatus = leaveRes.rows[0].leave_type === 'Paid Leave' ? 'PAID LEAVE' : 'LEAVE WITHOUT PAY';
          }

          if (attendanceStatus === 'ABSENT') {
            // Notify Employee
            try {
              const alreadyNotified = await query(
                `SELECT id FROM notifications WHERE recipient_user_id = $1 AND title = 'Attendance Marked Absent' AND attendance_date = $2`,
                [user.id, dateStr]
              );
              if (alreadyNotified.rows.length === 0) {
                await NotificationService.notifyUser(user.id, {
                  title: 'Attendance Marked Absent',
                  message: 'Attendance not marked today. You have been marked absent.',
                  type: 'Attendance',
                  priority: 'Critical',
                  actionUrl: '/my-attendance',
                  attendanceDate: dateStr,
                });
              }
            } catch (e: any) {
              console.error('Failed to insert absence notification:', e);
            }

            // 1. Employee Marked Absent -> Notify Admins
            try {
              const alreadyAdminNotified = await query(
                `SELECT id FROM notifications WHERE role = 'admin' AND title = 'Absent Alert' AND message LIKE $1 AND attendance_date = $2`,
                [`%${empCode}%`, dateStr]
              );
              if (alreadyAdminNotified.rows.length === 0) {
                await NotificationService.notifyAdmins({
                  title: 'Absent Alert',
                  message: `${user.name} (${empCode}) has not marked attendance and has been marked Absent for today.`,
                  type: 'Attendance',
                  priority: 'High',
                  actionUrl: `/attendance?status=Absent&date=${dateStr}&search=${encodeURIComponent(user.name)}`,
                  attendanceDate: dateStr,
                });
              }
            } catch (e: any) {
              console.error('Failed to insert admin absent alert:', e);
            }
          }
          
          try {
            const attCheck = await query(`SELECT id FROM attendance WHERE employee_id = $1 AND attendance_date = $2`, [user.id, dateStr]);
            if (attCheck.rows.length === 0) {
              await query(`
                INSERT INTO attendance (employee_id, office_id, attendance_date, check_in, status)
                VALUES ($1, (SELECT id FROM offices LIMIT 1), $2, NULL, $3)
              `, [user.id, dateStr, attendanceStatus]);
            }
          } catch (e) {
            console.error('Failed to insert absence attendance record:', e);
          }
        }

        // WhatsApp Late Attendance Alerts (Disabled per request)
        /*
        try {
          await checkAndSendLateAttendanceAlerts(dateStr);
        } catch (e: any) {
          console.error('[Scheduler] WhatsApp late alert check error:', e);
        }
        */
      }

      // 3. CHECKOUT MISSING PROCESSING
      // If current time >= checkout_reminder_time
      if (timeStr >= settings.checkout_reminder_time) {
        const missingRes = await query(`
          SELECT a.employee_id, u.name, u.employee_id as emp_code
          FROM attendance a
          JOIN users u ON a.employee_id = u.id
          WHERE u.status = 'active'
            AND a.attendance_date = $1
            AND a.check_out IS NULL
        `, [dateStr]);

        const formattedDate = new Date(dateStr + 'T12:00:00+05:30').toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        });

        for (const att of missingRes.rows) {
          const empCode = att.emp_code || `FISPL${String(att.employee_id).padStart(3, '0')}`;

          // Notify Employee
          try {
            const alreadyNotified = await query(
              `SELECT id FROM notifications WHERE recipient_user_id = $1 AND title = 'Forgot to Check-Out' AND attendance_date = $2`,
              [att.employee_id, dateStr]
            );
            if (alreadyNotified.rows.length === 0) {
              await NotificationService.notifyUser(att.employee_id, {
                title: 'Forgot to Check-Out',
                message: 'You checked in today but have not checked out. Please remember to check out.',
                type: 'Attendance',
                priority: 'High',
                actionUrl: '/my-attendance',
                attendanceDate: dateStr,
              });
            }
          } catch (e: any) {
            console.error('Failed to insert checkout notification:', e);
          }

          // 3. Missing Check-out -> Notify Admins
          try {
            const alreadyAdminNotified = await query(
              `SELECT id FROM notifications WHERE role = 'admin' AND title = 'Missing Check-out' AND message LIKE $1 AND attendance_date = $2`,
              [`%${empCode}%`, dateStr]
            );
            if (alreadyAdminNotified.rows.length === 0) {
              await NotificationService.notifyAdmins({
                title: 'Missing Check-out',
                message: `${att.name} (${empCode}) did not mark check-out for ${formattedDate}.`,
                type: 'Attendance',
                priority: 'Medium',
                actionUrl: `/attendance?date=${dateStr}&search=${encodeURIComponent(att.name)}`,
                attendanceDate: dateStr,
              });
            }
          } catch (e: any) {
            console.error('Failed to insert admin missing check-out notification:', e);
          }
        }
      }

    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });
}

/**
 * Checks for 5-minute pre-late login reminder and 5-minute pre-shift-end logout reminder
 * Executed every minute across all active shifts
 */
export async function checkAndSendFiveMinuteReminders(dateStr: string, timeStr: string) {
  try {
    const isWeekend = new Date(dateStr).getDay() === 0;
    if (isWeekend) return;

    const holidayRes = await query(
      'SELECT id FROM holidays WHERE holiday_date = $1 AND is_active = true',
      [dateStr]
    );
    if (holidayRes.rows.length > 0) return;

    const shiftsRes = await query('SELECT * FROM shifts WHERE status = $1', ['active']);
    if (shiftsRes.rows.length === 0) return;

    const [currH, currM] = timeStr.split(':').map(Number);
    const currentTotalMins = currH * 60 + currM;

    for (const shift of shiftsRes.rows) {
      // -------------------------------------------------------------
      // 1. Alert 5 minutes before late mark login
      // -------------------------------------------------------------
      const lateThresholdTime = shift.late_after || shift.start_time;
      const [lateH, lateM] = lateThresholdTime.split(':').map(Number);
      const lateThresholdTotalMins = lateH * 60 + lateM;
      const loginAlertMins = (lateThresholdTotalMins - 5 + 1440) % 1440;

      if (currentTotalMins === loginAlertMins) {
        // Find employees assigned to this shift (or default shift) who haven't checked in today
        const missingLoginRes = await query(`
          SELECT u.id, u.name, u.employee_id
          FROM users u
          WHERE u.status = 'active'
            AND (u.shift_id = $1 OR (u.shift_id IS NULL AND $1 = (SELECT id FROM shifts ORDER BY id ASC LIMIT 1)))
            AND NOT EXISTS (
              SELECT 1 FROM attendance a 
              WHERE a.employee_id = u.id AND a.attendance_date = $2 AND a.check_in IS NOT NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM leave_requests lr 
              WHERE lr.employee_id = u.id 
                AND lr.status = 'APPROVED' 
                AND lr.from_date <= $2 
                AND lr.to_date >= $2
            )
        `, [shift.id, dateStr]);

        const format12 = (tStr: string) => {
          const [h, m] = tStr.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
        };
        const formattedLate = format12(lateThresholdTime);

        for (const emp of missingLoginRes.rows) {
          try {
            const alreadyNotified = await query(
              `SELECT id FROM notifications 
               WHERE recipient_user_id = $1 
                 AND title = '⏰ 5 Mins Left: Check In Soon!' 
                 AND attendance_date = $2`,
              [emp.id, dateStr]
            );

            if (alreadyNotified.rows.length === 0) {
              await NotificationService.notifyUser(emp.id, {
                title: '⏰ 5 Mins Left: Check In Soon!',
                message: `Only 5 minutes left! Please check in before ${formattedLate} to avoid being marked late today.`,
                type: 'Attendance',
                priority: 'High',
                actionUrl: '/home',
                attendanceDate: dateStr,
              });
              console.log(`[Scheduler] 5-min pre-late reminder sent to ${emp.name} (${emp.employee_id}) for shift ${shift.name}`);
            }
          } catch (err) {
            console.error(`Failed to send 5-min pre-late reminder to ${emp.id}:`, err);
          }
        }
      }

      // -------------------------------------------------------------
      // 2. Alert 5 minutes before shift end / logout
      // -------------------------------------------------------------
      const [endH, endM] = shift.end_time.split(':').map(Number);
      const endTotalMins = endH * 60 + endM;
      const logoutAlertMins = (endTotalMins - 5 + 1440) % 1440;

      if (currentTotalMins === logoutAlertMins) {
        // Find employees who checked in today but have not checked out yet
        const missingLogoutRes = await query(`
          SELECT u.id, u.name, u.employee_id
          FROM users u
          JOIN attendance a ON a.employee_id = u.id AND a.attendance_date = $2
          WHERE u.status = 'active'
            AND (u.shift_id = $1 OR (u.shift_id IS NULL AND $1 = (SELECT id FROM shifts ORDER BY id ASC LIMIT 1)))
            AND a.check_in IS NOT NULL
            AND a.check_out IS NULL
        `, [shift.id, dateStr]);

        const format12 = (tStr: string) => {
          const [h, m] = tStr.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
        };
        const formattedEnd = format12(shift.end_time);

        for (const emp of missingLogoutRes.rows) {
          try {
            const alreadyNotified = await query(
              `SELECT id FROM notifications 
               WHERE recipient_user_id = $1 
                 AND title = '⏰ 5 Mins Left: Shift Ending Soon' 
                 AND attendance_date = $2`,
              [emp.id, dateStr]
            );

            if (alreadyNotified.rows.length === 0) {
              await NotificationService.notifyUser(emp.id, {
                title: '⏰ 5 Mins Left: Shift Ending Soon',
                message: `Your shift ends at ${formattedEnd}. Please remember to check out before leaving.`,
                type: 'Attendance',
                priority: 'High',
                actionUrl: '/home',
                attendanceDate: dateStr,
              });
              console.log(`[Scheduler] 5-min pre-logout reminder sent to ${emp.name} (${emp.employee_id}) for shift ${shift.name}`);
            }
          } catch (err) {
            console.error(`Failed to send 5-min pre-logout reminder to ${emp.id}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in checkAndSendFiveMinuteReminders:', err);
  }
}

/**
 * Automatically purge notifications older than 30 days (1 month)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    const res = await query(
      `DELETE FROM notifications WHERE created_at < (NOW() - INTERVAL '30 days') RETURNING id`
    );
    const count = res.rows.length;
    if (count > 0) {
      console.log(`[Retention Policy] Purged ${count} notification(s) older than 30 days (1 month).`);
    }
    return count;
  } catch (error) {
    console.error('[Retention Policy] Failed to cleanup expired notifications:', error);
    return 0;
  }
}


