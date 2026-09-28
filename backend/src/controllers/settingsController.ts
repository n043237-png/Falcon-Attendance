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
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
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
    const holRes = await query('SELECT id, holiday_date as "holidayDate", name, is_active as "isActive" FROM holidays ORDER BY holiday_date DESC');
    res.json({ success: true, data: holRes.rows.map(r => ({ ...r, holidayDate: new Date(r.holidayDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) })) });
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
    const { holidayDate, name, isActive } = parsed.data;
    await query(`
      INSERT INTO holidays (holiday_date, name, is_active) 
      VALUES ($1, $2, COALESCE($3, true))
    `, [holidayDate, name, isActive]);
    res.json({ success: true, message: 'Holiday added' });
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

