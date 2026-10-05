import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';

export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    if (page < 1) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' } });
      return;
    }
    const offset = (page - 1) * limit;

    const date = req.query.date as string;
    const employeeId = req.query.employeeId as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const shiftId = req.query.shiftId as string;

    let filterQuery = 'WHERE 1=1';
    const queryParams: any[] = [];

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
      } else if (status === 'Checked Out') {
        filterQuery += ` AND a.check_out IS NOT NULL`;
      } else if (status.toUpperCase() === 'LATE') {
        filterQuery += ` AND a.computed_status = 'LATE'`;
      } else if (status.toUpperCase() === 'PRESENT') {
        filterQuery += ` AND a.computed_status = 'PRESENT'`;
      } else {
        queryParams.push(status.toUpperCase());
        filterQuery += ` AND a.computed_status = $${queryParams.length}`;
      }
    }
    if (search) {
      queryParams.push(`%${search}%`);
      filterQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.employee_id ILIKE $${queryParams.length} OR u.employee_code ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length} OR u.designation ILIKE $${queryParams.length})`;
    }

    const countRes = await query(`
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

    const histRes = await query(`
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
               att.check_out_address, att.check_out_selfie_url
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
               a.check_out_address, a.check_out_selfie_url
        FROM attendance a
        UNION ALL
        SELECT NULL::integer as id, el.attendance_date, el.employee_id, 'ON LEAVE' as computed_status, NULL as check_in, NULL as check_out, 0 as working_minutes,
               false as is_late, 0 as late_minutes,
               NULL::numeric as check_in_lat, NULL::numeric as check_in_lng, NULL::numeric as check_out_lat, NULL::numeric as check_out_lng,
               'Office' as attendance_mode, NULL as attendance_source, NULL as check_in_address, NULL as check_in_selfie_url,
               NULL as check_out_address, NULL as check_out_selfie_url
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
            checkInLat: isAbsentOrLeave || !rec.check_in_lat ? null : parseFloat(rec.check_in_lat),
            checkInLng: isAbsentOrLeave || !rec.check_in_lng ? null : parseFloat(rec.check_in_lng),
            checkOutLat: isAbsentOrLeave || !rec.check_out_lat ? null : parseFloat(rec.check_out_lat),
            checkOutLng: isAbsentOrLeave || !rec.check_out_lng ? null : parseFloat(rec.check_out_lng),
          };
        }),
        pagination: { page, limit, total, totalPages }
      }
    });
  } catch (error) {
    console.error('Admin getAttendance error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving attendance.' } });
  }
};

export const getDailySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const date = req.query.date as string;
    if (!date) {
      res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Date parameter is required' } });
      return;
    }

    const usersRes = await query(`SELECT COUNT(*) FROM users WHERE status = 'active'`);
    const totalEmployees = parseInt(usersRes.rows[0].count);

    const attRes = await query(`
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
      } else if (st === 'PRESENT') {
        present++;
      } else if (st === 'ABSENT') {
        absent++;
      } else if (st === 'ON LEAVE' || st.includes('LEAVE')) {
        onLeave++;
      }

      // Checked In/Out only applies if employee actually checked in and is not absent or on leave
      if (st !== 'ABSENT' && !st.includes('LEAVE') && r.check_in) {
        if (r.check_out) checkedOut++;
        else checkedIn++;
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
  } catch (error) {
    console.error('Admin getDailySummary error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving daily summary.' } });
  }
};
