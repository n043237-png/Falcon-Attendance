import { Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { verifyLocation } from '../services/locationService';
import { NotificationService } from '../services/notificationService';
import { getAttendanceSettings, calculateStatus } from '../services/attendanceStatusService';
import { ShiftService } from '../services/shiftService';

const coordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
});

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = coordsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Invalid latitude, longitude, or accuracy.' }});
      return;
    }
    const { latitude, longitude, accuracy } = parsed.data;
    const employeeId = req.user!.id;

    // 1. Verify location
    let locResult;
    try {
      locResult = await verifyLocation(latitude, longitude, accuracy);
    } catch (verr: any) {
      if (verr.status) {
        res.status(verr.status).json({ success: false, error: { code: verr.code, message: verr.message } });
        return;
      }
      throw verr;
    }

    if (!locResult.insideOffice) {
      res.status(403).json({
        success: false,
        error: { 
          code: 'OUTSIDE_OFFICE', 
          message: `You are outside the permitted office location (${locResult.distanceMeters}m away). Check-in is only permitted within ${locResult.allowedRadiusMeters} metres of ${locResult.officeName || 'the office'}.` 
        },
        data: { 
          distanceMeters: locResult.distanceMeters, 
          allowedRadiusMeters: locResult.allowedRadiusMeters,
          officeName: locResult.officeName 
        }
      });
      return;
    }

    // 2. Fetch employee's assigned shift
    const shift = await ShiftService.getEmployeeShift(employeeId);

    // Determine shift attendance date (handling night shifts)
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    let attendanceDate = today;

    if (shift.isNightShift) {
      const currentHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }), 10);
      if (currentHour < 12) {
        // Checking in after midnight belongs to the previous calendar day's shift
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        attendanceDate = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      }
    }

    // Check if already checked in for this shift date
    const existRes = await query(`SELECT id, check_in FROM attendance WHERE employee_id = $1 AND attendance_date = $2`, [employeeId, attendanceDate]);
    if (existRes.rows.length > 0 && existRes.rows[0].check_in !== null) {
      res.status(400).json({ success: false, error: { code: 'ALREADY_CHECKED_IN', message: 'You have already checked in for this shift.' }});
      return;
    }

    // Evaluate shift attendance metrics (late status & late minutes)
    const evalResult = ShiftService.evaluateAttendance(shift, now);
    const checkInStatus = evalResult.isLate ? 'LATE' : 'PRESENT';

    let newRecord;
    if (existRes.rows.length > 0) {
      // Record was auto-created by absence scheduler (check_in is NULL) -> update it!
      const updateRes = await query(`
        UPDATE attendance 
        SET office_id = $1, 
            check_in = CURRENT_TIMESTAMP, 
            check_in_location = ST_SetSRID(ST_MakePoint($2, $3), 4326),
            status = $4,
            shift_id = $5,
            is_late = $6,
            late_minutes = $7
        WHERE id = $8
        RETURNING id, attendance_date, check_in, status, shift_id, is_late, late_minutes
      `, [locResult.officeId, longitude, latitude, checkInStatus, shift.id, evalResult.isLate, evalResult.lateMinutes, existRes.rows[0].id]);
      newRecord = updateRes.rows[0];
    } else {
      // 3. Create attendance
      const insertRes = await query(`
        INSERT INTO attendance (
          employee_id, office_id, attendance_date, check_in, check_out, check_in_location, status,
          shift_id, is_late, late_minutes
        ) VALUES (
          $1, $2, $3, CURRENT_TIMESTAMP, NULL, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6,
          $7, $8, $9
        ) RETURNING id, attendance_date, check_in, status, shift_id, is_late, late_minutes
      `, [employeeId, locResult.officeId, attendanceDate, longitude, latitude, checkInStatus, shift.id, evalResult.isLate, evalResult.lateMinutes]);
      newRecord = insertRes.rows[0];
    }

    // Audit log for location coordinates
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        employeeId,
        'ATTENDANCE_CHECK_IN',
        'ATTENDANCE',
        newRecord.id,
        JSON.stringify({
          latitude,
          longitude,
          accuracy,
          distanceMeters: locResult.distanceMeters,
          allowedRadiusMeters: locResult.allowedRadiusMeters,
          officeId: locResult.officeId,
          officeName: locResult.officeName,
          shiftId: shift.id,
          shiftName: shift.name,
          shiftCode: shift.code,
          isLate: evalResult.isLate,
          lateMinutes: evalResult.lateMinutes,
          insideOffice: true,
          timestamp: new Date().toISOString()
        })
      ]);
    } catch (auditErr) {
      console.error('Check-in audit log error:', auditErr);
    }

    // Trigger Smart Notifications
    try {
      const timeStr12 = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (evalResult.isLate) {
        await NotificationService.notifyUser(employeeId, {
          title: '⚠️ Late Check-In',
          message: `Your attendance has been marked at ${timeStr12} (Past ${shift.name} late threshold of ${shift.lateAfter}).`,
          type: 'Attendance',
          priority: 'High',
          actionUrl: '/my-attendance',
          attendanceDate: attendanceDate,
        });

        const empName = req.user!.name || 'An employee';
        const empCode = req.user!.employee_id || `FISPL${String(employeeId).padStart(3, '0')}`;
        const lateMinutes = Math.round(evalResult.lateMinutes);

        // 2. Employee Checked In Late -> Notify Admins
        await NotificationService.notifyAdmins({
          title: 'Late Check-in',
          message: `${empName} (${empCode}) checked in at ${timeStr12}, which is ${lateMinutes} minutes late.`,
          type: 'Attendance',
          priority: 'Medium',
          actionUrl: `/attendance?status=Late&date=${attendanceDate}&search=${encodeURIComponent(empName)}`,
          attendanceDate: attendanceDate,
        });
      } else {
        await NotificationService.notifyUser(employeeId, {
          title: '✅ Check-In Successful',
          message: `Your attendance has been marked on time for ${shift.name} at ${timeStr12}.`,
          type: 'Attendance',
          priority: 'Low',
          actionUrl: '/my-attendance',
          attendanceDate: attendanceDate,
        });
      }
    } catch (e: any) {
      console.error('Check-in notification error:', e);
    }

    res.json({
      success: true,
      data: {
        attendanceId: newRecord.id,
        attendanceDate: newRecord.attendance_date,
        checkIn: newRecord.check_in,
        status: newRecord.status,
        shift: {
          id: shift.id,
          name: shift.name,
          code: shift.code,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
        isLate: evalResult.isLate,
        lateMinutes: evalResult.lateMinutes,
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred during check-in.' }});
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = coordsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Invalid latitude, longitude, or accuracy.' }});
      return;
    }
    const { latitude, longitude, accuracy } = parsed.data;
    const employeeId = req.user!.id;

    // 1. Verify location
    let locResult;
    try {
      locResult = await verifyLocation(latitude, longitude, accuracy);
    } catch (verr: any) {
      if (verr.status) {
        res.status(verr.status).json({ success: false, error: { code: verr.code, message: verr.message } });
        return;
      }
      throw verr;
    }

    if (!locResult.insideOffice) {
      res.status(403).json({
        success: false,
        error: { 
          code: 'OUTSIDE_OFFICE', 
          message: `You are outside the permitted office location (${locResult.distanceMeters}m away). Check-out is only permitted within ${locResult.allowedRadiusMeters} metres of ${locResult.officeName || 'the office'}.` 
        },
        data: { 
          distanceMeters: locResult.distanceMeters, 
          allowedRadiusMeters: locResult.allowedRadiusMeters,
          officeName: locResult.officeName 
        }
      });
      return;
    }

    // 2. Find open attendance record (supporting night shifts across midnight)
    const openRes = await query(`
      SELECT id, attendance_date, check_in, check_out, shift_id 
      FROM attendance 
      WHERE employee_id = $1 AND check_in IS NOT NULL AND check_out IS NULL
      ORDER BY check_in DESC 
      LIMIT 1
    `, [employeeId]);
    
    if (openRes.rows.length === 0) {
      // Check if already checked out today
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const completedRes = await query(
        `SELECT id FROM attendance WHERE employee_id = $1 AND attendance_date = $2 AND check_out IS NOT NULL`,
        [employeeId, today]
      );
      if (completedRes.rows.length > 0) {
        res.status(400).json({ success: false, error: { code: 'ALREADY_CHECKED_OUT', message: 'You have already checked out today.' }});
        return;
      }
      res.status(400).json({ success: false, error: { code: 'NOT_CHECKED_IN', message: 'You do not have an active check-in session.' }});
      return;
    }

    const attendance = openRes.rows[0];
    const checkInDate = new Date(attendance.check_in);
    const now = new Date();

    // Fetch shift
    const shift = attendance.shift_id 
      ? (await ShiftService.getShiftById(attendance.shift_id)) || (await ShiftService.getEmployeeShift(employeeId))
      : await ShiftService.getEmployeeShift(employeeId);

    // Calculate metrics using ShiftService
    const metrics = ShiftService.evaluateAttendance(shift, checkInDate, now);

    // Determine final status
    const isLateAttendance = attendance.is_late || metrics.isLate;
    let finalStatus = isLateAttendance ? 'LATE' : 'PRESENT';
    if (metrics.workingMinutes >= shift.minimumWorkHours * 60) {
      finalStatus = isLateAttendance ? 'LATE' : 'PRESENT';
    } else if (metrics.workingMinutes >= shift.halfDayMinutes) {
      finalStatus = 'HALF_DAY';
    } else {
      finalStatus = 'INSUFFICIENT_HOURS';
    }

    // 3. Update checkout
    const updateRes = await query(`
      UPDATE attendance 
      SET 
        check_out = CURRENT_TIMESTAMP, 
        check_out_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        working_minutes = $3,
        overtime_minutes = $4,
        early_departure_minutes = $5,
        status = $6,
        shift_id = COALESCE(shift_id, $7),
        is_late = $8,
        late_minutes = $9
      WHERE id = $10
      RETURNING id, attendance_date, check_in, check_out, working_minutes, overtime_minutes, early_departure_minutes, status, shift_id, is_late, late_minutes
    `, [
      longitude, 
      latitude, 
      metrics.workingMinutes, 
      metrics.overtimeMinutes, 
      metrics.earlyDepartureMinutes, 
      finalStatus, 
      shift.id, 
      isLateAttendance,
      metrics.lateMinutes,
      attendance.id
    ]);

    const updated = updateRes.rows[0];

    // Audit log for location coordinates
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        employeeId,
        'ATTENDANCE_CHECK_OUT',
        'ATTENDANCE',
        updated.id,
        JSON.stringify({
          latitude,
          longitude,
          accuracy,
          distanceMeters: locResult.distanceMeters,
          allowedRadiusMeters: locResult.allowedRadiusMeters,
          officeId: locResult.officeId,
          officeName: locResult.officeName,
          shiftId: shift.id,
          shiftName: shift.name,
          shiftCode: shift.code,
          workingMinutes: metrics.workingMinutes,
          overtimeMinutes: metrics.overtimeMinutes,
          earlyDepartureMinutes: metrics.earlyDepartureMinutes,
          breakDeducted: metrics.breakDeducted || 0,
          insideOffice: true,
          timestamp: new Date().toISOString()
        })
      ]);
    } catch (auditErr) {
      console.error('Check-out audit log error:', auditErr);
    }

    // Notification
    try {
      const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return `${h}h ${m}m`;
      };
      let notifMsg = `Checkout completed successfully for ${shift.name}. Duration: ${formatDuration(metrics.workingMinutes)}.`;
      if (metrics.breakDeducted && metrics.breakDeducted > 0) {
        notifMsg = `Checkout completed successfully for ${shift.name}. Duration: ${formatDuration(metrics.workingMinutes)} (Break deducted: ${metrics.breakDeducted}m).`;
      }
      if (metrics.overtimeMinutes > 0) {
        notifMsg += ` Overtime earned: ${formatDuration(metrics.overtimeMinutes)}.`;
      }

      await NotificationService.notifyUser(employeeId, {
        title: 'Check-Out Successful',
        message: notifMsg,
        type: 'Attendance',
        priority: 'Low',
        actionUrl: '/my-attendance',
        attendanceDate: updated.attendance_date,
      });
    } catch (e: any) {
      console.error('Checkout notification error:', e);
    }

    res.json({
      success: true,
      data: {
        attendanceId: updated.id,
        attendanceDate: updated.attendance_date,
        checkIn: updated.check_in,
        checkOut: updated.check_out,
        workingMinutes: Math.round(metrics.workingMinutes),
        overtimeMinutes: Math.round(metrics.overtimeMinutes),
        earlyDepartureMinutes: Math.round(metrics.earlyDepartureMinutes),
        status: updated.status,
        shift: {
          id: shift.id,
          name: shift.name,
          code: shift.code,
        }
      }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred during check-out.' }});
  }
};

export const getToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const [existRes, setRes, holRes, leaveRes, officeRes] = await Promise.all([
      query(`
        SELECT id, attendance_date, check_in, check_out, working_minutes, status 
        FROM attendance WHERE employee_id = $1 AND attendance_date = $2
      `, [employeeId, today]),
      getAttendanceSettings(),
      query('SELECT name FROM holidays WHERE holiday_date = $1 AND is_active = true', [today]),
      query(`
        SELECT lr.leave_type, lr.status, lr.days, lr.from_date as start_date, lr.to_date as end_date
        FROM leave_requests lr
        WHERE lr.employee_id = $1 AND lr.status = 'APPROVED' AND lr.from_date <= $2 AND lr.to_date >= $2
        LIMIT 1
      `, [employeeId, today]),
      query(`
        SELECT id, name, radius_meters as "radiusMeters"
        FROM offices
        WHERE status = 'active'
        ORDER BY id ASC
        LIMIT 1
      `)
    ]);

    const record = existRes.rows[0];
    const holiday = holRes.rows[0];
    const leave = leaveRes.rows[0];
    const officeInfo = officeRes.rows[0] ? {
      id: officeRes.rows[0].id,
      name: officeRes.rows[0].name,
      radiusMeters: officeRes.rows[0].radiusMeters
    } : null;

    // Fetch employee shift details for local reminder sync
    const userShiftRes = await query(`
      SELECT s.id, s.name, s.start_time as "startTime", s.end_time as "endTime", s.grace_minutes as "graceMinutes", s.late_after as "lateAfter"
      FROM users u
      LEFT JOIN shifts s ON s.id = COALESCE(u.shift_id, (SELECT id FROM shifts ORDER BY id ASC LIMIT 1))
      WHERE u.id = $1
    `, [employeeId]);
    const userShift = userShiftRes.rows[0] || null;

    // Compute absolute state
    const result = calculateStatus(today, record, setRes, holiday, leave, new Date());

    if (result.status === 'NOT_MARKED') {
      res.json({ success: true, data: { attendance: null, shift: userShift, office: officeInfo } });
      return;
    }

    // Compute real-time working minutes (elapsed time if checked in but not yet checked out)
    const liveWorkingMinutes = result.checkIn
      ? (result.checkOut
          ? Math.round(result.workingMinutes)
          : Math.max(0, Math.round((new Date().getTime() - new Date(result.checkIn).getTime()) / (1000 * 60))))
      : 0;

    res.json({
      success: true,
      data: {
        attendance: {
          attendanceId: result.attendanceId,
          date: today,
          checkIn: result.checkIn,
          checkOut: result.checkOut,
          workingMinutes: liveWorkingMinutes,
          status: result.status,
          isLate: result.isLate,
          holidayName: holiday ? holiday.name : null,
          leaveType: leave ? leave.leave_type : null
        },
        shift: userShift,
        office: officeInfo
      }
    });
  } catch (error) {
    console.error('Get today error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving today attendance.' }});
  }
};

export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    if (page < 1) return res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' } }) as any;
    
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    // Fetch user details for joining date
    const uRes = await query('SELECT joining_date, created_at FROM users WHERE id = $1', [employeeId]);
    const startDateRaw = uRes.rows[0].joining_date || uRes.rows[0].created_at;
    const startDate = new Date(startDateRaw).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    let filterYear = !isNaN(year) ? year : null;
    let filterMonth = !isNaN(month) ? month : null;

    // Fetch all related data in parallel
    const [attRes, settings, holRes, leaveRes] = await Promise.all([
      query(`SELECT * FROM attendance WHERE employee_id = $1`, [employeeId]),
      getAttendanceSettings(),
      query(`SELECT holiday_date FROM holidays WHERE is_active = true`),
      query(`SELECT *, from_date as start_date, to_date as end_date FROM leave_requests WHERE employee_id = $1 AND status = 'APPROVED'`, [employeeId])
    ]);

    // Build hash maps for O(1) lookup
    const attMap = new Map(attRes.rows.map(r => [new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
    const holMap = new Set(holRes.rows.map(r => new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })));
    const leaveMap = new Map();
    for (const lr of leaveRes.rows) {
      const d = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      while (d <= end) {
        leaveMap.set(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), lr);
        d.setDate(d.getDate() + 1);
      }
    }

    // Generate date sequence
    let current = new Date(startDate);
    const endBound = new Date(today);
    let allRecords = [];

    while (current <= endBound) {
      const dStr = current.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const cYear = current.getFullYear();
      const cMonth = current.getMonth() + 1;

      if ((!filterYear || cYear === filterYear) && (!filterMonth || cMonth === filterMonth)) {
        const rec = attMap.get(dStr);
        const hol = holMap.has(dStr) ? { holiday_date: dStr } : null;
        const lve = leaveMap.get(dStr);
        
        const result = calculateStatus(dStr, rec, settings, hol, lve, new Date());
        
        if (result.status !== 'NOT_MARKED') {
          allRecords.push({
            attendanceId: result.attendanceId,
            date: dStr,
            checkIn: result.checkIn,
            checkOut: result.checkOut,
            workingMinutes: Math.round(result.workingMinutes),
            status: result.status,
            isLate: result.isLate
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // Sort descending
    allRecords.sort((a, b) => b.date.localeCompare(a.date));

    // Paginate
    const total = allRecords.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = allRecords.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        items: paginated,
        pagination: { page, limit, total, totalPages }
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving attendance history.' }});
  }
};

export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMETERS', message: 'Valid year and month are required' } });
      return;
    }

    // Date range for the requested month
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const startDate = new Date(startStr);
    const endDate = new Date(year, month, 0); // Last day of month
    
    // But don't go beyond today or before joining date
    // Explicitly parse current date in Asia/Kolkata
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date(todayStr);
    
    const uRes = await query('SELECT joining_date, created_at FROM users WHERE id = $1', [employeeId]);
    const joinDateRaw = uRes.rows[0].joining_date || uRes.rows[0].created_at;
    const joinDateStr = new Date(joinDateRaw).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const joinDate = new Date(joinDateStr);
    
    const actualStart = startDate < joinDate ? joinDate : startDate;
    const actualEnd = endDate > today ? today : endDate;

    let summary: any = {
      present: 0,
      halfDays: 0,
      absent: 0,
      onLeave: 0,
      halfDayLeave: 0,
      late: 0,
      checkoutMissing: 0,
      totalWorkingHours: 0,
      totalWorkingDays: 0,
      attendancePercentage: 0
    };

    if (actualStart <= actualEnd) {
      const [attRes, settings, holRes, leaveRes] = await Promise.all([
        query(`SELECT * FROM attendance WHERE employee_id = $1`, [employeeId]),
        getAttendanceSettings(),
        query(`SELECT holiday_date FROM holidays WHERE is_active = true`),
        query(`SELECT *, from_date as start_date, to_date as end_date FROM leave_requests WHERE employee_id = $1 AND status = 'APPROVED'`, [employeeId])
      ]);

      const attMap = new Map(attRes.rows.map(r => [new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
      const holMap = new Set(holRes.rows.map(r => new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })));
      const leaveMap = new Map();
      for (const lr of leaveRes.rows) {
        const d = new Date(lr.start_date);
        const end = new Date(lr.end_date);
        while (d <= end) {
          leaveMap.set(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), lr);
          d.setDate(d.getDate() + 1);
        }
      }

      let current = new Date(actualStart);
      while (current <= actualEnd) {
        const dStr = current.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const rec = attMap.get(dStr);
        const hol = holMap.has(dStr) ? { holiday_date: dStr } : null;
        const lve = leaveMap.get(dStr);
        
        const result = calculateStatus(dStr, rec, settings, hol, lve, new Date());

        if (result.status === 'PRESENT') summary.present++;
        else if (result.status === 'HALF_DAY') summary.halfDays++;
        else if (result.status === 'ABSENT' || result.status === 'INSUFFICIENT_HOURS') summary.absent++;
        else if (result.status === 'ON_LEAVE') summary.onLeave++;
        else if (result.status === 'HALF_DAY_LEAVE') summary.halfDayLeave++;
        else if (result.status === 'CHECKOUT_MISSING') summary.checkoutMissing++;
        
        if (result.status !== 'HOLIDAY' && result.status !== 'SUNDAY' && result.status !== 'NOT_MARKED') {
          summary.totalWorkingDays++;
        }

        if (result.status === 'PRESENT' && result.isLate) summary.late++;
        summary.totalWorkingHours += (result.workingMinutes / 60);

        current.setDate(current.getDate() + 1);
      }
      
      // Calculate attendance percentage: (Present + (Half Days * 0.5) + (Half Day Leave * 0.5) + Checkout Missing) / (Working Days - Leaves)
      // Actually simpler: (Present + CheckoutMissing + HalfDay/2 + HalfDayLeave/2) / (TotalWorkingDays - FullDayLeaves)
      // The user just requested a logical percentage.
      const attended = summary.present + summary.checkoutMissing + (summary.halfDays * 0.5) + (summary.halfDayLeave * 0.5);
      const required = summary.totalWorkingDays - summary.onLeave;
      if (required > 0) {
        summary.attendancePercentage = Math.round((attended / required) * 100);
      } else {
        summary.attendancePercentage = 100; // If no working days required, percentage is 100
      }
    }

    summary.totalWorkingHours = Math.round(summary.totalWorkingHours * 100) / 100;

    res.json({ success: true, data: { summary } });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving attendance summary.' }});
  }
};

export const getCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMETERS', message: 'Valid year and month are required' } });
      return;
    }

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const startDate = new Date(startStr);
    const endDate = new Date(year, month, 0); 
    
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date(todayStr);

    const actualStart = startDate;
    const actualEnd = endDate;

    let calendar = [];

    const [attRes, settings, holRes, leaveRes] = await Promise.all([
      query(`SELECT * FROM attendance WHERE employee_id = $1`, [employeeId]),
      getAttendanceSettings(),
      query(`SELECT holiday_date, name FROM holidays WHERE is_active = true`),
      query(`
        SELECT *, from_date as start_date, to_date as end_date 
        FROM leave_requests 
        WHERE employee_id = $1 AND status = 'APPROVED'
      `, [employeeId])
    ]);

    const attMap = new Map(attRes.rows.map(r => [new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
    const holMap = new Map(holRes.rows.map(r => [new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
    const leaveMap = new Map();
    for (const lr of leaveRes.rows) {
      const d = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      while (d <= end) {
        leaveMap.set(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), lr);
        d.setDate(d.getDate() + 1);
      }
    }

    let current = new Date(actualStart);
    while (current <= actualEnd) {
      const dStr = current.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      
      // If the date is strictly in the future, check for holiday, leave, or sunday.
      if (current > today) {
        let futureStatus = 'NOT_MARKED';
        let leaveType = null;
        let holidayName = null;

        if (holMap.has(dStr)) {
          futureStatus = 'HOLIDAY';
          holidayName = holMap.get(dStr).name;
        } else if (leaveMap.has(dStr)) {
          futureStatus = 'ON_LEAVE';
          leaveType = leaveMap.get(dStr).leave_type;
        } else if (current.getDay() === 0) {
          futureStatus = 'SUNDAY';
        }

        calendar.push({
          date: dStr,
          status: futureStatus,
          check_in: null,
          check_out: null,
          working_minutes: 0,
          leave_type: leaveType,
          holiday_name: holidayName,
          is_sunday: current.getDay() === 0
        });
        current.setDate(current.getDate() + 1);
        continue;
      }

      const rec = attMap.get(dStr);
      const hol = holMap.has(dStr) ? { holiday_date: dStr, name: holMap.get(dStr).name } : null;
      const lve = leaveMap.get(dStr);
      
      const result = calculateStatus(dStr, rec, settings, hol, lve, new Date());

      calendar.push({
        date: dStr,
        status: result.status,
        check_in: result.checkIn ? result.checkIn.toISOString() : null,
        check_out: result.checkOut ? result.checkOut.toISOString() : null,
        working_minutes: Math.round(result.workingMinutes),
        leave_type: lve ? lve.leave_type : null,
        holiday_name: (result as any).holidayName || null,
        is_sunday: current.getDay() === 0
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({ success: true, data: calendar });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving calendar.' }});
  }
};

