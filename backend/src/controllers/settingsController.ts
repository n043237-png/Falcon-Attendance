import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { LeaveValidationService } from '../services/leaveValidationService';
import { z } from 'zod';

const settingsSchema = z.object({
  officeStart: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  officeEnd: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  lateThreshold: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  absenceCutoff: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  halfDayMinutes: z.number().positive().optional(),
  fullDayMinutes: z.number().positive().optional(),
  checkoutReminderTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
});

const holidaySchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  name: z.string().min(1, 'Holiday name is required'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const setRes = await query('SELECT * FROM attendance_settings WHERE id = 1');
    res.json({ success: true, data: setRes.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: 'Invalid data format' } });
      return;
    }
    const d = parsed.data;

    let q = 'UPDATE attendance_settings SET updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [];
    const push = (col: string, val: any) => {
      if (val !== undefined) {
        params.push(val);
        q += `, ${col} = $${params.length}`;
      }
    };

    push('office_start', d.officeStart);
    push('office_end', d.officeEnd);
    push('late_threshold', d.lateThreshold);
    push('absence_cutoff', d.absenceCutoff);
    push('half_day_minutes', d.halfDayMinutes);
    push('full_day_minutes', d.fullDayMinutes);
    push('checkout_reminder_time', d.checkoutReminderTime);

    if (params.length === 0) {
      res.status(400).json({ success: false, error: { message: 'No fields provided' } });
      return;
    }

    q += ` WHERE id = 1`;
    await query(q, params);

    // Synchronize default Day Shift (DS) with settings
    if (d.officeStart || d.officeEnd || d.lateThreshold) {
      await query(`
        UPDATE shifts
        SET start_time = COALESCE($1, start_time),
            end_time = COALESCE($2, end_time),
            late_after = COALESCE($3, late_after),
            updated_at = CURRENT_TIMESTAMP
        WHERE code = 'DS'
      `, [d.officeStart || null, d.officeEnd || null, d.lateThreshold || null]);

      // Automatically recalculate today's attendance so changes to thresholds apply immediately
      await query(`
        UPDATE attendance a
        SET 
          is_late = ((a.check_in AT TIME ZONE 'Asia/Kolkata')::time > s.late_after),
          late_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ((a.check_in AT TIME ZONE 'Asia/Kolkata')::time - s.late_after)) / 60, 2)),
          status = CASE 
            WHEN a.check_out IS NOT NULL AND a.working_minutes < s.half_day_minutes THEN 'INSUFFICIENT_HOURS'
            WHEN a.check_out IS NOT NULL AND a.working_minutes < s.minimum_work_hours * 60 THEN 'HALF_DAY'
            WHEN (a.check_in AT TIME ZONE 'Asia/Kolkata')::time > s.late_after THEN 'LATE'
            ELSE 'PRESENT'
          END
        FROM users u
        JOIN shifts s ON s.id = COALESCE(u.shift_id, 1)
        WHERE a.employee_id = u.id 
          AND a.attendance_date = CURRENT_DATE 
          AND a.check_in IS NOT NULL
      `);
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const yearParam = req.query.year as string;
    let queryText = 'SELECT id, holiday_date as "holidayDate", name, description, is_active as "isActive" FROM holidays WHERE 1=1';
    const queryParams: any[] = [];

    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      queryText += ' AND is_active = true';
    }

    if (yearParam && /^\d{4}$/.test(yearParam)) {
      queryParams.push(`${yearParam}-01-01`, `${yearParam}-12-31`);
      queryText += ` AND holiday_date >= $${queryParams.length - 1} AND holiday_date <= $${queryParams.length}`;
    }

    queryText += ' ORDER BY holiday_date ASC';

    const holRes = await query(queryText, queryParams);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const holidays = holRes.rows.map(r => {
      const dateStr = new Date(r.holidayDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const dateObj = new Date(dateStr + 'T12:00:00+05:30');
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isUpcoming = dateStr >= todayStr;

      const todayDate = new Date(todayStr + 'T12:00:00+05:30');
      const diffTime = dateObj.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        holidayDate: dateStr,
        name: r.name,
        description: r.description || null,
        day: dayName,
        isActive: r.isActive,
        isPast,
        isToday,
        isUpcoming,
        daysAway: diffDays
      };
    });

    res.json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

export const addHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: 'Invalid data format' } });
      return;
    }
    const { holidayDate, name, description, isActive } = parsed.data;
    await query(`
      INSERT INTO holidays (holiday_date, name, description, is_active) 
      VALUES ($1, $2, $3, COALESCE($4, true))
      ON CONFLICT (holiday_date) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()
    `, [holidayDate, name, description ? description.trim() : null, isActive]);
    res.json({ success: true, message: 'Holiday saved successfully' });
  } catch (error: any) {
    if (error.code === '23505') res.status(400).json({ success: false, error: { message: 'Holiday already exists on this date' } });
    else res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await query('DELETE FROM holidays WHERE id = $1', [id]);
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

const officeSettingsSchema = z.object({
  name: z.string().min(1, 'Office name is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(5, 'Radius must be at least 5 metres').max(1000, 'Radius cannot exceed 1000 metres'),
  status: z.enum(['active', 'inactive']).optional()
});

export const getOfficeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const officeRes = await query(`
      SELECT 
        id, 
        name, 
        radius_meters as "radiusMeters", 
        ST_Y(location::geometry) as "latitude", 
        ST_X(location::geometry) as "longitude", 
        status, 
        updated_at as "updatedAt"
      FROM offices 
      WHERE status = 'active' 
      ORDER BY id ASC 
      LIMIT 1
    `);
    
    if (officeRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: 'No active office configured' } });
      return;
    }

    const row = officeRes.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        radiusMeters: row.radiusMeters,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        status: row.status,
        updatedAt: row.updatedAt
      }
    });
  } catch (error) {
    console.error('getOfficeSettings error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error retrieving office settings' } });
  }
};

export const updateOfficeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = officeSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ 
        success: false, 
        error: { message: parsed.error.issues[0]?.message || 'Invalid office settings data' } 
      });
      return;
    }

    const { name, latitude, longitude, radiusMeters, status } = parsed.data;

    const existRes = await query(`SELECT id FROM offices WHERE status = 'active' ORDER BY id ASC LIMIT 1`);
    let officeId = existRes.rows.length > 0 ? existRes.rows[0].id : 1;

    let updatedRow;
    if (existRes.rows.length > 0) {
      const updateRes = await query(`
        UPDATE offices 
        SET 
          name = $1, 
          latitude = $2::numeric, 
          longitude = $3::numeric, 
          location = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326),
          radius_meters = $4,
          status = COALESCE($5, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, name, radius_meters as "radiusMeters", ST_Y(location::geometry) as "latitude", ST_X(location::geometry) as "longitude", status, updated_at as "updatedAt"
      `, [name, latitude, longitude, radiusMeters, status || 'active', officeId]);
      updatedRow = updateRes.rows[0];
    } else {
      const insertRes = await query(`
        INSERT INTO offices (name, latitude, longitude, location, radius_meters, status)
        VALUES ($1, $2::numeric, $3::numeric, ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326), $4, 'active')
        RETURNING id, name, radius_meters as "radiusMeters", ST_Y(location::geometry) as "latitude", ST_X(location::geometry) as "longitude", status, updated_at as "updatedAt"
      `, [name, latitude, longitude, radiusMeters]);
      updatedRow = insertRes.rows[0];
    }

    // Audit log
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user?.id, 
        'UPDATE_OFFICE_SETTINGS', 
        'OFFICE', 
        updatedRow.id, 
        JSON.stringify({ name, latitude, longitude, radiusMeters, status: updatedRow.status })
      ]);
    } catch (auditErr) {
      console.error('Audit log error updating office settings:', auditErr);
    }

    res.json({
      success: true,
      message: 'Office location and geo-fence radius updated successfully',
      data: {
        id: updatedRow.id,
        name: updatedRow.name,
        radiusMeters: updatedRow.radiusMeters,
        latitude: parseFloat(updatedRow.latitude),
        longitude: parseFloat(updatedRow.longitude),
        status: updatedRow.status,
        updatedAt: updatedRow.updatedAt
      }
    });
  } catch (error) {
    console.error('updateOfficeSettings error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error updating office settings' } });
  }
};

export const getLeaveSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await LeaveValidationService.getLeaveSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error fetching leave settings' } });
  }
};

export const updateLeaveSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await LeaveValidationService.updateLeaveSettings(req.body);
    res.json({ success: true, data: updated, message: 'Leave settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Server error updating leave settings' } });
  }
};

