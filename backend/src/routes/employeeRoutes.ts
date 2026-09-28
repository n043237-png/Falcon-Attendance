import express from 'express';
import { authenticateToken, employeeOnly } from '../middlewares/auth';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { NotificationService } from '../services/notificationService';
import { LeaveValidationService } from '../services/leaveValidationService';
import { ShiftService } from '../services/shiftService';
import { getMyShift } from '../controllers/shiftController';

const router = express.Router();

router.use(authenticateToken);
router.use(employeeOnly);

// 1. Dashboard summary
router.get('/dashboard', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Today's attendance
    const todayRes = await query(
      `SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2`,
      [userId, today]
    );

    // Leave Balances
    const leaveRes = await query(
      `SELECT accrued_leave, used_paid_leave, leave_without_pay, current_balance 
       FROM leave_balances 
       WHERE employee_id = $1 AND year = $2`,
      [userId, new Date().getFullYear()]
    );
    
    let leave_balances: any[] = [];
    if (leaveRes.rows[0]) {
      leave_balances = [
        { name: 'Paid Leave', allocated_days: parseFloat(leaveRes.rows[0].accrued_leave), used_days: parseFloat(leaveRes.rows[0].used_paid_leave) },
        { name: 'Leave Without Pay', allocated_days: 0, used_days: parseFloat(leaveRes.rows[0].leave_without_pay) }
      ];
    }

    // Recent Notifications
    const notifRes = await query(
      `SELECT * FROM notifications WHERE employee_id = $1 ORDER BY sent_at DESC LIMIT 5`,
      [userId]
    );

    // Assigned Shift
    const assignedShift = await ShiftService.getEmployeeShift(userId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    // Current month attendance stats
    const monthStatsRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PRESENT') as present_count,
        COUNT(*) FILTER (WHERE status = 'LATE') as late_count,
        COUNT(*) FILTER (WHERE status = 'HALF_DAY') as half_day_count,
        COUNT(*) FILTER (WHERE status = 'ABSENT') as absent_count,
        COUNT(*) FILTER (WHERE status = 'ON_LEAVE') as leave_count,
        COALESCE(SUM(working_minutes), 0) as total_working_minutes
      FROM attendance 
      WHERE employee_id = $1 
        AND attendance_date >= $2 
        AND attendance_date <= $3
    `, [userId, startOfMonth, today]);

    // User profile info
    const userRes = await query(`
      SELECT id, name, employee_id as employee_code, email, phone, designation, department, profile_photo_url, role
      FROM users WHERE id = $1
    `, [userId]);

    // Latest payslip
    const payslipRes = await query(`
      SELECT month, year, file_url as "fileUrl", generated_date as "generatedDate"
      FROM salary_slips
      WHERE employee_id = $1
      ORDER BY year DESC, month DESC
      LIMIT 1
    `, [userId]);

    const mRow = monthStatsRes.rows[0] || {};
    const presentCount = parseInt(mRow.present_count || '0');
    const lateCount = parseInt(mRow.late_count || '0');
    const halfDayCount = parseInt(mRow.half_day_count || '0');
    const absentCount = parseInt(mRow.absent_count || '0');
    const leaveCount = parseInt(mRow.leave_count || '0');
    const totalWorkingMinutes = parseInt(mRow.total_working_minutes || '0');

    res.json({
      today_status: todayRes.rows[0] || null,
      leave_balances,
      recent_notifications: notifRes.rows,
      assigned_shift: assignedShift,
      profile: userRes.rows[0] || null,
      month_stats: {
        present: presentCount,
        late: lateCount,
        half_day: halfDayCount,
        absent: absentCount,
        leave: leaveCount,
        total_working_minutes: totalWorkingMinutes,
        total_days_worked: presentCount + lateCount + halfDayCount
      },
      latest_payslip: payslipRes.rows[0] || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching dashboard' });
  }
});

// Assigned Shift endpoint
router.get('/shift', getMyShift);

// 2. My Attendance (Full month daily details)
router.get('/attendance', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { month, year } = req.query;
  
  try {
    const y = year ? parseInt(String(year)) : new Date().getFullYear();
    const m = month ? parseInt(String(month)) : new Date().getMonth() + 1;
    const startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0);
    const endDateStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Stop at end of month or today, whichever is earlier, to avoid marking future days as absent
    // Actually, to show the whole month in the UI (including future days as '-'), we should loop up to endDateStr.
    // calculateStatus handles future days by leaving them as NOT_MARKED if currentTime < absenceCutoff.

    const [attRes, settingsRes, holRes, leaveRes] = await Promise.all([
      query(`SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date >= $2 AND attendance_date <= $3`, [userId, startDateStr, endDateStr]),
      query('SELECT * FROM attendance_settings WHERE id = 1'),
      query(`SELECT holiday_date, name FROM holidays WHERE is_active = true AND holiday_date >= $1 AND holiday_date <= $2`, [startDateStr, endDateStr]),
      query(`SELECT *, from_date as start_date, to_date as end_date FROM leave_requests WHERE employee_id = $1 AND status = 'APPROVED' AND from_date <= $3 AND to_date >= $2`, [userId, startDateStr, endDateStr])
    ]);

    const settings = settingsRes.rows[0];
    const { calculateStatus } = require('../services/attendanceStatusService');

    const attMap = new Map();
    for (const r of attRes.rows) {
      const d = new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      attMap.set(d, r);
    }

    const holMap = new Map(holRes.rows.map(r => [new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
    
    const leaveMap = new Map();
    for (const lr of leaveRes.rows) {
      let d = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      while (d <= end) {
        const dStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        leaveMap.set(dStr, lr);
        d.setDate(d.getDate() + 1);
      }
    }

    const dailyRecords = [];
    let curr = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (curr <= end) {
      const dStr = curr.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const rec = attMap.get(dStr);
      const hol = holMap.has(dStr) ? { holiday_date: dStr, name: holMap.get(dStr).name } : null;
      const lve = leaveMap.get(dStr);
      
      const result = calculateStatus(dStr, rec, settings, hol, lve, new Date());

      // If it's a future day and NOT_MARKED, we'll just send it as NOT_MARKED or empty.
      // But the frontend expects something. Let's just push everything.
      dailyRecords.push({
        date: dStr,
        day: curr.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
        status: result.status,
        checkIn: result.checkIn ? result.checkIn.toISOString() : null,
        checkOut: result.checkOut ? result.checkOut.toISOString() : null,
        workingMinutes: Math.round(result.workingMinutes),
        leaveType: lve ? lve.leave_type : null,
        holidayName: hol ? hol.name : null,
        isLate: result.status === 'PRESENT' && result.isLate
      });

      curr.setDate(curr.getDate() + 1);
    }

    // Return in reverse chronological order for the table, or forward. Forward is usually better for a calendar, reverse for a list. 
    // The admin modal uses forward. Let's stick to forward.
    res.json(dailyRecords);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching attendance' });
  }
});

// 3. My Leaves
router.get('/leave-balances', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT accrued_leave, used_paid_leave, leave_without_pay, current_balance 
       FROM leave_balances 
       WHERE employee_id = $1 AND year = $2`,
      [userId, new Date().getFullYear()]
    );
    const balance = result.rows[0];
    if (!balance) return res.json([]);
    
    res.json([
      { leave_type_id: 'Paid Leave', name: 'Paid Leave', allocated_days: parseFloat(balance.accrued_leave), used_days: parseFloat(balance.used_paid_leave) },
      { leave_type_id: 'Leave Without Pay', name: 'Leave Without Pay', allocated_days: 0, used_days: parseFloat(balance.leave_without_pay) }
    ]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching leave balances' });
  }
});

router.get('/leave-requests', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT id, from_date as start_date, to_date as end_date, days as total_days, reason, status, leave_type as leave_type_name 
       FROM leave_requests
       WHERE employee_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching leave requests' });
  }
});

router.get('/validate-leave', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const startDate = (req.query.startDate as string) || (req.query.start_date as string);
  const endDate = (req.query.endDate as string) || (req.query.end_date as string);

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const result = await LeaveValidationService.validateLeaveRequest(userId, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('validate-leave error:', error);
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

router.post('/validate-leave', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const startDate = req.body?.startDate || req.body?.start_date;
  const endDate = req.body?.endDate || req.body?.end_date;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const result = await LeaveValidationService.validateLeaveRequest(userId, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('validate-leave error:', error);
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

router.post('/leave-requests', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { leave_type_id, start_date, end_date, total_days, reason } = req.body;
  try {
    // Run Smart Leave Validation Engine before saving
    const validation = await LeaveValidationService.validateLeaveRequest(userId, start_date, end_date);
    if (!validation.canSubmit) {
      return res.status(400).json({
        error: validation.blockReason || 'Cannot submit leave request',
        validation
      });
    }

    const leaveType = validation.paidLeaveRequired === 0
      ? (validation.allWeeklyOffs ? 'Weekly Off' : 'Company Holiday')
      : (leave_type_id || 'Paid Leave');

    await query(
      `INSERT INTO leave_requests (employee_id, leave_type, from_date, to_date, days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
      [userId, leaveType, start_date, end_date, validation.totalDays, reason]
    );

    // Notify admins and employee
    try {
      await NotificationService.notifyAdmins({
        title: 'New Leave Request',
        message: `${req.user?.name || 'An employee'} applied for ${leaveType} from ${start_date} to ${end_date}.`,
        type: 'Leave',
        priority: 'Medium',
        actionUrl: '/leave',
      });
      await NotificationService.notifyUser(userId, {
        title: 'Leave Request Submitted',
        message: `Your leave request for ${start_date} to ${end_date} has been submitted for approval.`,
        type: 'Leave',
        priority: 'Low',
        actionUrl: '/my-leave',
      });
    } catch (notifErr) {
      console.warn('Leave apply notification error:', notifErr);
    }

    res.json({ success: true, validation });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error applying leave' });
  }
});

// 4. Salary Slips
router.get('/salary-slips', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT 
        s.*,
        pi.net_salary,
        pi.gross_pay,
        pi.total_deductions,
        pi.payable_days,
        pi.working_days
       FROM salary_slips s
       LEFT JOIN payroll_cycles c ON c.month = s.month AND c.year = s.year
       LEFT JOIN payroll_items pi ON pi.cycle_id = c.id AND pi.employee_id = s.employee_id
       WHERE s.employee_id = $1 
       ORDER BY s.year DESC, s.month DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching salary slips' });
  }
});

// 5. Notifications
router.get('/notifications', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE employee_id = $1 ORDER BY sent_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
});

export default router;
