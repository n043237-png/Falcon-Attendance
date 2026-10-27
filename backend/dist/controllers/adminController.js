"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regularizeAttendance = exports.getAttendanceTimeline = exports.getDailySummary = exports.getAttendance = void 0;
const db_1 = require("../db");
const shiftService_1 = require("../services/shiftService");
const notificationService_1 = require("../services/notificationService");
const getAttendance = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        if (limit > 100)
            limit = 100;
        if (limit < 1)
            limit = 1;
        if (page < 1) {
            res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' } });
            return;
        }
        const offset = (page - 1) * limit;
        const date = req.query.date;
        const employeeId = req.query.employeeId;
        const status = req.query.status;
        const search = req.query.search;
        const shiftId = req.query.shiftId;
        let filterQuery = 'WHERE 1=1';
        const queryParams = [];
        if (date) {
            queryParams.push(date);
            filterQuery += ` AND a.attendance_date = $${queryParams.length}`;
        }
        if (employeeId) {
            queryParams.push(employeeId);
            filterQuery += ` AND u.employee_id = $${queryParams.length}`;
        }
        if (shiftId && shiftId !== 'All') {
            queryParams.push(parseInt(shiftId, 10));
            filterQuery += ` AND u.shift_id = $${queryParams.length}`;
        }
        if (status && status !== 'All') {
            if (status === 'Checked In') {
                filterQuery += ` AND a.check_out IS NULL AND a.check_in IS NOT NULL`;
            }
            else if (status === 'Checked Out') {
                filterQuery += ` AND a.check_out IS NOT NULL`;
            }
            else if (status.toUpperCase() === 'LATE') {
                filterQuery += ` AND a.computed_status = 'LATE'`;
            }
            else if (status.toUpperCase() === 'PRESENT') {
                filterQuery += ` AND a.computed_status = 'PRESENT'`;
            }
            else {
                queryParams.push(status.toUpperCase());
                filterQuery += ` AND a.computed_status = $${queryParams.length}`;
            }
        }
        if (search) {
            queryParams.push(`%${search}%`);
            filterQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.employee_id ILIKE $${queryParams.length} OR u.employee_code ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length} OR u.designation ILIKE $${queryParams.length})`;
        }
        const countRes = await (0, db_1.query)(`
      WITH expanded_leaves AS (
        SELECT d::date as attendance_date, lr.employee_id
        FROM leave_requests lr
        JOIN generate_series(lr.from_date, lr.to_date, '1 day'::interval) d ON true
        WHERE lr.status = 'APPROVED'
      ),
      combined AS (
        ${date ? `
        SELECT $1::date as attendance_date, u.id as employee_id,
               CASE 
                 WHEN att.is_late = true OR att.status = 'LATE' THEN 'LATE'
                 WHEN att.status IS NOT NULL THEN att.status
                 WHEN el.employee_id IS NOT NULL THEN 'ON_LEAVE'
                 ELSE 'ABSENT'
               END as computed_status,
               att.check_in, att.check_out, att.working_minutes, att.is_late
        FROM users u
        LEFT JOIN attendance att ON u.id = att.employee_id AND att.attendance_date = $1::date
        LEFT JOIN expanded_leaves el ON u.id = el.employee_id AND el.attendance_date = $1::date
        WHERE u.status = 'active'
        ` : `
        SELECT a.attendance_date, a.employee_id, 
               CASE 
                 WHEN a.is_late = true OR a.status = 'LATE' THEN 'LATE'
                 ELSE a.status
               END as computed_status, 
               a.check_in, a.check_out, a.working_minutes, a.is_late
        FROM attendance a
        UNION ALL
        SELECT el.attendance_date, el.employee_id, 'ON LEAVE' as computed_status, NULL as check_in, NULL as check_out, 0 as working_minutes, false as is_late
        FROM expanded_leaves el
        WHERE NOT EXISTS (
          SELECT 1 FROM attendance a 
          WHERE a.employee_id = el.employee_id AND a.attendance_date = el.attendance_date
        )
        `}
      )
      SELECT COUNT(*) 
      FROM combined a
      JOIN users u ON a.employee_id = u.id
      ${filterQuery.replace(/a\.status/g, 'a.computed_status')}
    `, queryParams);
        const total = parseInt(countRes.rows[0].count);
        const totalPages = Math.ceil(total / limit);
        const histRes = await (0, db_1.query)(`
      WITH expanded_leaves AS (
        SELECT d::date as attendance_date, lr.employee_id
        FROM leave_requests lr
        JOIN generate_series(lr.from_date, lr.to_date, '1 day'::interval) d ON true
        WHERE lr.status = 'APPROVED'
      ),
      combined AS (
        ${date ? `
        SELECT att.id, $1::date as attendance_date, u.id as employee_id,
               CASE 
                 WHEN att.is_late = true OR att.status = 'LATE' THEN 'LATE'
                 WHEN att.status IS NOT NULL THEN att.status
                 WHEN el.employee_id IS NOT NULL THEN 'ON LEAVE'
                 ELSE 'ABSENT'
               END as computed_status,
               att.check_in, att.check_out, att.working_minutes,
               att.is_late, att.late_minutes,
               ST_Y(att.check_in_location::geometry) as check_in_lat,
               ST_X(att.check_in_location::geometry) as check_in_lng,
               ST_Y(att.check_out_location::geometry) as check_out_lat,
               ST_X(att.check_out_location::geometry) as check_out_lng,
               COALESCE(att.attendance_mode, u.attendance_mode, 'Office') as attendance_mode,
               COALESCE(att.attendance_source, 'Mobile App') as attendance_source,
               att.check_in_address, att.check_in_selfie_url,
               att.check_out_address, att.check_out_selfie_url,
               att.first_checkout_time, att.resume_time, att.final_checkout_time,
               COALESCE(att.attendance_resumed, false) as attendance_resumed,
               COALESCE(att.resume_count, 0) as resume_count
        FROM users u
        LEFT JOIN attendance att ON u.id = att.employee_id AND att.attendance_date = $1::date
        LEFT JOIN expanded_leaves el ON u.id = el.employee_id AND el.attendance_date = $1::date
        WHERE u.status = 'active'
        ` : `
        SELECT a.id, a.attendance_date, a.employee_id, 
               CASE 
                 WHEN a.is_late = true OR a.status = 'LATE' THEN 'LATE'
                 ELSE a.status
               END as computed_status, 
               a.check_in, a.check_out, a.working_minutes,
               a.is_late, a.late_minutes,
               ST_Y(a.check_in_location::geometry) as check_in_lat,
               ST_X(a.check_in_location::geometry) as check_in_lng,
               ST_Y(a.check_out_location::geometry) as check_out_lat,
               ST_X(a.check_out_location::geometry) as check_out_lng,
               a.attendance_mode, COALESCE(a.attendance_source, 'Mobile App') as attendance_source, a.check_in_address, a.check_in_selfie_url,
               a.check_out_address, a.check_out_selfie_url,
               a.first_checkout_time, a.resume_time, a.final_checkout_time,
               COALESCE(a.attendance_resumed, false) as attendance_resumed,
               COALESCE(a.resume_count, 0) as resume_count
        FROM attendance a
        UNION ALL
        SELECT NULL::integer as id, el.attendance_date, el.employee_id, 'ON LEAVE' as computed_status, NULL as check_in, NULL as check_out, 0 as working_minutes,
               false as is_late, 0 as late_minutes,
               NULL::numeric as check_in_lat, NULL::numeric as check_in_lng, NULL::numeric as check_out_lat, NULL::numeric as check_out_lng,
               'Office' as attendance_mode, NULL as attendance_source, NULL as check_in_address, NULL as check_in_selfie_url,
               NULL as check_out_address, NULL as check_out_selfie_url,
               NULL as first_checkout_time, NULL as resume_time, NULL as final_checkout_time,
               false as attendance_resumed, 0 as resume_count
        FROM expanded_leaves el
        WHERE NOT EXISTS (
          SELECT 1 FROM attendance a 
          WHERE a.employee_id = el.employee_id AND a.attendance_date = el.attendance_date
        )
        `}
      )
      SELECT a.id, a.attendance_date, a.check_in, a.check_out, a.working_minutes, a.computed_status as status,
             a.is_late, a.late_minutes,
             a.check_in_lat, a.check_in_lng, a.check_out_lat, a.check_out_lng,
             COALESCE(a.attendance_mode, u.attendance_mode, 'Office') as attendance_mode,
             a.attendance_source,
             a.check_in_address, a.check_in_selfie_url,
             a.check_out_address, a.check_out_selfie_url,
             a.first_checkout_time, a.resume_time, a.final_checkout_time,
             a.attendance_resumed, a.resume_count,
             u.name as employee_name, u.employee_id as employee_code, u.profile_photo_url as profile_photo_url,
             u.shift_id as shift_id, s.name as shift_name, s.code as shift_code
      FROM combined a
      JOIN users u ON a.employee_id = u.id
      LEFT JOIN shifts s ON s.id = u.shift_id
      ${filterQuery.replace(/a\.status/g, 'a.computed_status')}
      ORDER BY 
        a.attendance_date DESC,
        CASE 
          WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
          WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
          ELSE 2 
        END, 
        NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
        u.employee_id ASC,
        a.check_in DESC NULLS LAST
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);
        res.json({
            success: true,
            data: {
                items: histRes.rows.map(rec => {
                    const st = (rec.status || '').toUpperCase();
                    const isAbsentOrLeave = st === 'ABSENT' || st.includes('LEAVE');
                    const isLateRecord = !!rec.is_late || st === 'LATE';
                    return {
                        attendanceId: rec.id,
                        employeeName: rec.employee_name,
                        employeeId: rec.employee_code,
                        profilePhotoUrl: rec.profile_photo_url,
                        shiftId: rec.shift_id,
                        shiftName: rec.shift_name,
                        shiftCode: rec.shift_code || 'DS',
                        date: new Date(rec.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                        checkIn: isAbsentOrLeave ? null : rec.check_in,
                        checkOut: isAbsentOrLeave ? null : rec.check_out,
                        workingMinutes: isAbsentOrLeave ? 0 : (rec.working_minutes ? Math.round(rec.working_minutes) : 0),
                        status: isLateRecord ? 'LATE' : (rec.status?.toUpperCase() || 'ABSENT'),
                        isLate: isLateRecord,
                        lateMinutes: rec.late_minutes ? Math.round(parseFloat(rec.late_minutes)) : 0,
                        attendanceMode: rec.attendance_mode || 'Office',
                        attendanceSource: rec.attendance_source || 'Mobile App',
                        address: rec.check_in_address || null,
                        selfieUrl: rec.check_in_selfie_url || null,
                        checkOutAddress: rec.check_out_address || null,
                        checkOutSelfieUrl: rec.check_out_selfie_url || null,
                        firstCheckoutTime: rec.first_checkout_time || null,
                        resumeTime: rec.resume_time || null,
                        finalCheckoutTime: rec.final_checkout_time || null,
                        attendanceResumed: !!rec.attendance_resumed,
                        resumeCount: rec.resume_count || 0,
                        checkInLat: isAbsentOrLeave || !rec.check_in_lat ? null : parseFloat(rec.check_in_lat),
                        checkInLng: isAbsentOrLeave || !rec.check_in_lng ? null : parseFloat(rec.check_in_lng),
                        checkOutLat: isAbsentOrLeave || !rec.check_out_lat ? null : parseFloat(rec.check_out_lat),
                        checkOutLng: isAbsentOrLeave || !rec.check_out_lng ? null : parseFloat(rec.check_out_lng),
                    };
                }),
                pagination: { page, limit, total, totalPages }
            }
        });
    }
    catch (error) {
        console.error('Admin getAttendance error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving attendance.' } });
    }
};
exports.getAttendance = getAttendance;
const getDailySummary = async (req, res) => {
    try {
        const date = req.query.date;
        if (!date) {
            res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Date parameter is required' } });
            return;
        }
        const usersRes = await (0, db_1.query)(`SELECT COUNT(*) FROM users WHERE status = 'active'`);
        const totalEmployees = parseInt(usersRes.rows[0].count);
        const attRes = await (0, db_1.query)(`
      SELECT 
        u.id,
        CASE 
          WHEN a.is_late = true OR a.status = 'LATE' THEN 'LATE'
          WHEN a.status IS NOT NULL THEN a.status
          WHEN el.status IS NOT NULL THEN el.status
          ELSE 'ABSENT'
        END as status,
        a.is_late,
        a.check_in,
        a.check_out
      FROM users u
      LEFT JOIN attendance a ON u.id = a.employee_id AND a.attendance_date = $1
      LEFT JOIN (
        SELECT d::date as attendance_date, 'ON LEAVE'::varchar as status, lr.employee_id
        FROM leave_requests lr
        JOIN generate_series(lr.from_date, lr.to_date, '1 day'::interval) d ON true
        WHERE lr.status = 'APPROVED'
      ) el ON u.id = el.employee_id AND el.attendance_date = $1
      WHERE u.status = 'active'
    `, [date]);
        let present = 0;
        let absent = 0;
        let late = 0;
        let onLeave = 0;
        let checkedIn = 0;
        let checkedOut = 0;
        attRes.rows.forEach(r => {
            const st = (r.status || '').toUpperCase();
            if (st === 'LATE' || r.is_late) {
                late++;
                present++; // verified check-in
            }
            else if (st === 'PRESENT') {
                present++;
            }
            else if (st === 'ABSENT') {
                absent++;
            }
            else if (st === 'ON LEAVE' || st.includes('LEAVE')) {
                onLeave++;
            }
            // Checked In/Out only applies if employee actually checked in and is not absent or on leave
            if (st !== 'ABSENT' && !st.includes('LEAVE') && r.check_in) {
                if (r.check_out)
                    checkedOut++;
                else
                    checkedIn++;
            }
        });
        res.json({
            success: true,
            data: {
                totalEmployees,
                present,
                onTime: present - late,
                absent,
                late,
                onLeave,
                checkedIn,
                checkedOut
            }
        });
    }
    catch (error) {
        console.error('Admin getDailySummary error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving daily summary.' } });
    }
};
exports.getDailySummary = getDailySummary;
const getAttendanceTimeline = async (req, res) => {
    try {
        const attendanceId = parseInt(req.params.id, 10);
        if (!attendanceId) {
            res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Valid attendance ID is required.' } });
            return;
        }
        const attRes = await (0, db_1.query)(`
      SELECT a.*, 
             u.name as employee_name, u.employee_id as employee_code, u.profile_photo_url,
             s.name as shift_name, s.start_time, s.end_time, s.code as shift_code
      FROM attendance a
      JOIN users u ON u.id = a.employee_id
      LEFT JOIN shifts s ON s.id = a.shift_id
      WHERE a.id = $1
    `, [attendanceId]);
        if (attRes.rows.length === 0) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } });
            return;
        }
        const record = attRes.rows[0];
        // Fetch regularization logs
        const regLogsRes = await (0, db_1.query)(`
      SELECT * FROM attendance_regularization_logs
      WHERE attendance_id = $1
      ORDER BY created_at DESC
    `, [attendanceId]);
        // Fetch audit logs for this attendance record
        const auditRes = await (0, db_1.query)(`
      SELECT * FROM audit_logs
      WHERE entity_type = 'ATTENDANCE' AND entity_id = $1
      ORDER BY created_at ASC
    `, [attendanceId]);
        // Construct events timeline in chronological order
        const events = [];
        if (record.check_in) {
            events.push({
                type: 'CHECK_IN',
                label: 'Check In',
                timestamp: record.check_in,
                details: record.check_in_address || (record.attendance_mode === 'Field' ? 'Field Location' : 'Office Location'),
                source: record.attendance_source || 'Mobile App',
                isLate: record.is_late,
                lateMinutes: record.late_minutes
            });
        }
        if (record.first_checkout_time) {
            events.push({
                type: record.attendance_resumed ? 'ACCIDENTAL_CHECK_OUT' : 'CHECK_OUT',
                label: record.attendance_resumed ? 'Check Out (Accidental)' : 'Check Out',
                timestamp: record.first_checkout_time,
                details: record.attendance_resumed ? 'Employee accidentally checked out' : (record.check_out_address || 'Office Location'),
                source: record.attendance_source || 'Mobile App'
            });
        }
        if (record.resume_time) {
            events.push({
                type: 'ATTENDANCE_RESUMED',
                label: 'Attendance Resumed',
                timestamp: record.resume_time,
                details: 'Attendance session resumed within allowed 30-minute grace window',
                resumeCount: record.resume_count || 1
            });
        }
        if (record.final_checkout_time || (record.check_out && record.attendance_resumed)) {
            const finalTime = record.final_checkout_time || record.check_out;
            events.push({
                type: 'FINAL_CHECK_OUT',
                label: 'Final Check Out',
                timestamp: finalTime,
                details: record.check_out_address || 'End of workday checkout',
                source: record.attendance_source || 'Mobile App'
            });
        }
        else if (record.check_out && !record.first_checkout_time) {
            events.push({
                type: 'CHECK_OUT',
                label: 'Check Out',
                timestamp: record.check_out,
                details: record.check_out_address || 'End of workday checkout',
                source: record.attendance_source || 'Mobile App'
            });
        }
        // Sort events chronologically
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        res.json({
            success: true,
            data: {
                record: {
                    id: record.id,
                    employeeId: record.employee_id,
                    employeeName: record.employee_name,
                    employeeCode: record.employee_code,
                    profilePhotoUrl: record.profile_photo_url,
                    attendanceDate: record.attendance_date,
                    checkIn: record.check_in,
                    checkOut: record.check_out,
                    firstCheckoutTime: record.first_checkout_time,
                    resumeTime: record.resume_time,
                    finalCheckoutTime: record.final_checkout_time,
                    attendanceResumed: record.attendance_resumed,
                    resumeCount: record.resume_count,
                    workingMinutes: record.working_minutes,
                    status: record.status,
                    shiftName: record.shift_name,
                    shiftCode: record.shift_code
                },
                timeline: events,
                regularizations: regLogsRes.rows,
                auditLogs: auditRes.rows
            }
        });
    }
    catch (error) {
        console.error('getAttendanceTimeline error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving attendance timeline.' } });
    }
};
exports.getAttendanceTimeline = getAttendanceTimeline;
const regularizeAttendance = async (req, res) => {
    try {
        const attendanceId = parseInt(req.params.id, 10);
        const { checkIn, checkOut, reason, statusOverride } = req.body;
        if (!attendanceId) {
            res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Valid attendance ID is required.' } });
            return;
        }
        if (!reason || !reason.trim()) {
            res.status(400).json({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason for modification is required.' } });
            return;
        }
        // Fetch existing attendance record
        const attRes = await (0, db_1.query)(`
      SELECT a.*, u.name as employee_name, u.email as employee_email, u.employee_id as employee_code
      FROM attendance a
      JOIN users u ON u.id = a.employee_id
      WHERE a.id = $1
    `, [attendanceId]);
        if (attRes.rows.length === 0) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } });
            return;
        }
        const attendance = attRes.rows[0];
        const adminUser = req.user;
        const adminName = adminUser.name || adminUser.email || adminUser.employee_id || 'Admin';
        // Parse checkIn and checkOut
        const dateStr = new Date(attendance.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        let newCheckIn = attendance.check_in ? new Date(attendance.check_in) : null;
        let newCheckOut = attendance.check_out ? new Date(attendance.check_out) : null;
        if (checkIn !== undefined) {
            if (checkIn === null || checkIn === '') {
                newCheckIn = null;
            }
            else if (typeof checkIn === 'string' && checkIn.includes('T')) {
                newCheckIn = new Date(checkIn);
            }
            else if (typeof checkIn === 'string' && checkIn.includes(':')) {
                // "HH:MM" or "HH:MM:SS"
                const [h, m, s] = checkIn.split(':');
                newCheckIn = new Date(`${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${(s || '00').padStart(2, '0')}+05:30`);
            }
        }
        if (checkOut !== undefined) {
            if (checkOut === null || checkOut === '') {
                newCheckOut = null;
            }
            else if (typeof checkOut === 'string' && checkOut.includes('T')) {
                newCheckOut = new Date(checkOut);
            }
            else if (typeof checkOut === 'string' && checkOut.includes(':')) {
                // "HH:MM" or "HH:MM:SS"
                const [h, m, s] = checkOut.split(':');
                newCheckOut = new Date(`${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${(s || '00').padStart(2, '0')}+05:30`);
            }
        }
        if (newCheckIn && newCheckOut && newCheckOut.getTime() < newCheckIn.getTime()) {
            res.status(400).json({ success: false, error: { code: 'INVALID_TIMES', message: 'Check-out time cannot be earlier than check-in time.' } });
            return;
        }
        // Fetch shift
        const shift = attendance.shift_id
            ? (await shiftService_1.ShiftService.getShiftById(attendance.shift_id)) || (await shiftService_1.ShiftService.getEmployeeShift(attendance.employee_id))
            : await shiftService_1.ShiftService.getEmployeeShift(attendance.employee_id);
        // Calculate metrics using ShiftService
        let workingMinutes = 0;
        let overtimeMinutes = 0;
        let earlyDepartureMinutes = 0;
        let isLate = attendance.is_late;
        let lateMinutes = attendance.late_minutes ? parseFloat(attendance.late_minutes) : 0;
        let finalStatus = attendance.status;
        if (newCheckIn && newCheckOut) {
            const metrics = shiftService_1.ShiftService.evaluateAttendance(shift, newCheckIn, newCheckOut);
            workingMinutes = metrics.workingMinutes;
            overtimeMinutes = metrics.overtimeMinutes;
            earlyDepartureMinutes = metrics.earlyDepartureMinutes;
            isLate = metrics.isLate;
            lateMinutes = metrics.lateMinutes;
            const requiredWorkingMins = shift.minimumWorkHours ? Math.round(shift.minimumWorkHours * 60) : 510;
            const halfDayMins = shift.halfDayMinutes || Math.round(requiredWorkingMins / 2);
            if (statusOverride && ['PRESENT', 'LATE', 'HALF_DAY', 'INSUFFICIENT_HOURS'].includes(statusOverride.toUpperCase())) {
                finalStatus = statusOverride.toUpperCase();
            }
            else if (workingMinutes >= requiredWorkingMins) {
                finalStatus = isLate ? 'LATE' : 'PRESENT';
            }
            else if (workingMinutes >= halfDayMins) {
                finalStatus = 'HALF_DAY';
            }
            else {
                finalStatus = 'INSUFFICIENT_HOURS';
            }
        }
        else if (newCheckIn && !newCheckOut) {
            const evalResult = shiftService_1.ShiftService.evaluateAttendance(shift, newCheckIn);
            isLate = evalResult.isLate;
            lateMinutes = evalResult.lateMinutes;
            finalStatus = isLate ? 'LATE' : 'PRESENT';
            workingMinutes = 0;
        }
        else if (!newCheckIn) {
            finalStatus = 'ABSENT';
            workingMinutes = 0;
        }
        // Update attendance record
        const updateRes = await (0, db_1.query)(`
      UPDATE attendance
      SET
        check_in = $1,
        check_out = $2,
        final_checkout_time = $2,
        working_minutes = $3,
        overtime_minutes = $4,
        early_departure_minutes = $5,
        is_late = $6,
        late_minutes = $7,
        status = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
            newCheckIn,
            newCheckOut,
            workingMinutes,
            overtimeMinutes,
            earlyDepartureMinutes,
            isLate,
            lateMinutes,
            finalStatus,
            attendanceId
        ]);
        const updated = updateRes.rows[0];
        // Store in attendance_regularization_logs
        await (0, db_1.query)(`
      INSERT INTO attendance_regularization_logs (
        attendance_id, admin_id, admin_name,
        previous_check_in, previous_check_out,
        new_check_in, new_check_out,
        previous_status, new_status,
        reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    `, [
            attendanceId,
            adminUser.id,
            adminName,
            attendance.check_in,
            attendance.check_out,
            newCheckIn,
            newCheckOut,
            attendance.status,
            finalStatus,
            reason.trim()
        ]);
        // Store in audit_logs
        try {
            await (0, db_1.query)(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                adminUser.id,
                'ATTENDANCE_REGULARIZATION',
                'ATTENDANCE',
                attendanceId,
                JSON.stringify({
                    adminName,
                    reason: reason.trim(),
                    previousCheckIn: attendance.check_in,
                    previousCheckOut: attendance.check_out,
                    newCheckIn,
                    newCheckOut,
                    previousStatus: attendance.status,
                    newStatus: finalStatus,
                    workingMinutes,
                    timestamp: new Date().toISOString()
                })
            ]);
        }
        catch (auditErr) {
            console.error('Regularization audit log error:', auditErr);
        }
        // Notify employee of regularization
        try {
            await notificationService_1.NotificationService.notifyUser(attendance.employee_id, {
                title: 'Attendance Regularized',
                message: `Your attendance for ${dateStr} has been regularized by ${adminName}. Reason: ${reason.trim()}`,
                type: 'Attendance',
                priority: 'Medium',
                actionUrl: '/my-attendance',
                attendanceDate: dateStr
            });
        }
        catch (notifErr) {
            console.error('Regularization notification error:', notifErr);
        }
        res.json({
            success: true,
            message: 'Attendance regularized successfully and working hours recalculated.',
            data: {
                record: updated,
                modification: {
                    adminName,
                    dateTime: new Date().toISOString(),
                    reason: reason.trim(),
                    recalculatedWorkingMinutes: workingMinutes,
                    status: finalStatus
                }
            }
        });
    }
    catch (error) {
        console.error('regularizeAttendance error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error regularizing attendance.' } });
    }
};
exports.regularizeAttendance = regularizeAttendance;
