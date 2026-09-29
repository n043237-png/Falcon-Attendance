import { query, pool } from '../db';

export interface Shift {
  id: number;
  name: string;
  code: string;
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
  breakMinutes: number;
  graceMinutes: number;
  minimumWorkHours: number;
  lateAfter: string; // HH:MM:SS
  halfDayMinutes: number;
  overtimeEnabled: boolean;
  description: string | null;
  status: 'active' | 'inactive';
  isNightShift: boolean;
  assignedEmployeesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function computeLateAfter(startTimeStr: string, graceMinutes: number): string {
  const parts = startTimeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  const totalMins = h * 60 + m + graceMinutes;
  const newH = Math.floor((totalMins / 60) % 24);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function isNightShiftCheck(startTimeStr: string, endTimeStr: string): boolean {
  const [h1, m1] = startTimeStr.split(':').map(Number);
  const [h2, m2] = endTimeStr.split(':').map(Number);
  const startMins = h1 * 60 + (m1 || 0);
  const endMins = h2 * 60 + (m2 || 0);
  return endMins <= startMins;
}

export class ShiftService {
  /**
   * Format DB row to Shift object
   */
  static formatShiftRow(row: any): Shift {
    const isNight = isNightShiftCheck(row.start_time, row.end_time);
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      startTime: row.start_time,
      endTime: row.end_time,
      breakMinutes: parseInt(row.break_minutes, 10) || 0,
      graceMinutes: parseInt(row.grace_minutes, 10) || 0,
      minimumWorkHours: parseFloat(row.minimum_work_hours) || 8.00,
      lateAfter: row.late_after,
      halfDayMinutes: parseInt(row.half_day_minutes, 10) || 240,
      overtimeEnabled: !!row.overtime_enabled,
      description: row.description || null,
      status: row.status || 'active',
      isNightShift: isNight,
      assignedEmployeesCount: row.assigned_count ? parseInt(row.assigned_count, 10) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all shifts with employee assignment count
   */
  static async getAllShifts(statusFilter?: string): Promise<Shift[]> {
    let sql = `
      SELECT 
        s.*,
        COUNT(u.id) as assigned_count
      FROM shifts s
      LEFT JOIN users u ON u.shift_id = s.id AND u.status = 'active'
    `;
    const params: any[] = [];
    if (statusFilter && statusFilter !== 'ALL') {
      params.push(statusFilter.toLowerCase());
      sql += ` WHERE s.status = $${params.length}`;
    }
    sql += ` GROUP BY s.id ORDER BY s.id ASC`;

    const res = await query(sql, params);
    return res.rows.map(this.formatShiftRow);
  }

  /**
   * Get single shift by ID
   */
  static async getShiftById(id: number): Promise<Shift | null> {
    const res = await query(`
      SELECT 
        s.*,
        COUNT(u.id) as assigned_count
      FROM shifts s
      LEFT JOIN users u ON u.shift_id = s.id AND u.status = 'active'
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);

    if (res.rows.length === 0) return null;
    return this.formatShiftRow(res.rows[0]);
  }

  /**
   * Create a new shift
   */
  static async createShift(data: {
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    graceMinutes?: number;
    minimumWorkHours?: number;
    lateAfter?: string;
    halfDayMinutes?: number;
    overtimeEnabled?: boolean;
    description?: string;
    status?: 'active' | 'inactive';
  }): Promise<Shift> {
    const code = data.code.trim().toUpperCase();
    const existing = await query('SELECT id FROM shifts WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      throw new Error(`Shift code "${code}" already exists.`);
    }

    const grace = data.graceMinutes !== undefined ? data.graceMinutes : 15;
    const lateAfter = data.lateAfter || computeLateAfter(data.startTime, grace);
    const breakMins = data.breakMinutes !== undefined ? data.breakMinutes : 0;
    const minHours = data.minimumWorkHours !== undefined ? data.minimumWorkHours : 8.00;
    const halfDay = data.halfDayMinutes !== undefined ? data.halfDayMinutes : 240;
    const overtime = data.overtimeEnabled !== undefined ? data.overtimeEnabled : true;
    const status = data.status || 'active';

    const insertRes = await query(`
      INSERT INTO shifts (
        name, code, start_time, end_time, break_minutes, grace_minutes,
        minimum_work_hours, late_after, half_day_minutes, overtime_enabled,
        description, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING *
    `, [
      data.name.trim(),
      code,
      data.startTime,
      data.endTime,
      breakMins,
      grace,
      minHours,
      lateAfter,
      halfDay,
      overtime,
      data.description?.trim() || null,
      status
    ]);

    return this.formatShiftRow(insertRes.rows[0]);
  }

  /**
   * Update an existing shift
   */
  static async updateShift(id: number, data: {
    name?: string;
    code?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    graceMinutes?: number;
    minimumWorkHours?: number;
    lateAfter?: string;
    halfDayMinutes?: number;
    overtimeEnabled?: boolean;
    description?: string;
    status?: 'active' | 'inactive';
  }): Promise<Shift> {
    const current = await this.getShiftById(id);
    if (!current) throw new Error('Shift not found.');

    const name = data.name !== undefined ? data.name.trim() : current.name;
    const code = data.code !== undefined ? data.code.trim().toUpperCase() : current.code;

    if (code !== current.code) {
      const codeCheck = await query('SELECT id FROM shifts WHERE code = $1 AND id != $2', [code, id]);
      if (codeCheck.rows.length > 0) {
        throw new Error(`Shift code "${code}" is already in use by another shift.`);
      }
    }

    const startTime = data.startTime || current.startTime;
    const endTime = data.endTime || current.endTime;
    const graceMinutes = data.graceMinutes !== undefined ? data.graceMinutes : current.graceMinutes;
    const breakMinutes = data.breakMinutes !== undefined ? data.breakMinutes : current.breakMinutes;
    const minimumWorkHours = data.minimumWorkHours !== undefined ? data.minimumWorkHours : current.minimumWorkHours;
    const halfDayMinutes = data.halfDayMinutes !== undefined ? data.halfDayMinutes : current.halfDayMinutes;
    const overtimeEnabled = data.overtimeEnabled !== undefined ? data.overtimeEnabled : current.overtimeEnabled;
    const description = data.description !== undefined ? data.description : current.description;
    const status = data.status || current.status;

    // Recalculate lateAfter if startTime or graceMinutes changed and no explicit lateAfter provided
    let lateAfter = data.lateAfter;
    if (!lateAfter) {
      if (data.startTime || data.graceMinutes !== undefined) {
        lateAfter = computeLateAfter(startTime, graceMinutes);
      } else {
        lateAfter = current.lateAfter;
      }
    }

    const updateRes = await query(`
      UPDATE shifts
      SET 
        name = $1,
        code = $2,
        start_time = $3,
        end_time = $4,
        break_minutes = $5,
        grace_minutes = $6,
        minimum_work_hours = $7,
        late_after = $8,
        half_day_minutes = $9,
        overtime_enabled = $10,
        description = $11,
        status = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      name,
      code,
      startTime,
      endTime,
      breakMinutes,
      graceMinutes,
      minimumWorkHours,
      lateAfter,
      halfDayMinutes,
      overtimeEnabled,
      description,
      status,
      id
    ]);

    // If shift name changed, sync employee_profiles.shift_assignment for assigned employees
    if (name !== current.name) {
      await query(`
        UPDATE employee_profiles
        SET shift_assignment = $1
        WHERE user_id IN (SELECT id FROM users WHERE shift_id = $2)
      `, [name, id]);
    }

    return this.formatShiftRow(updateRes.rows[0]);
  }

  /**
   * Delete shift (only if not assigned to any employee)
   */
  static async deleteShift(id: number): Promise<{ success: boolean; message: string }> {
    const assignedRes = await query('SELECT COUNT(*) FROM users WHERE shift_id = $1', [id]);
    const assignedCount = parseInt(assignedRes.rows[0].count, 10);

    if (assignedCount > 0) {
      throw new Error(`Cannot delete shift: It is currently assigned to ${assignedCount} employee(s). Please reassign them before deleting.`);
    }

    // Delete assignment history records if any
    await query('DELETE FROM employee_shift_assignments WHERE shift_id = $1', [id]);
    await query('DELETE FROM shifts WHERE id = $1', [id]);

    return { success: true, message: 'Shift deleted successfully.' };
  }

  /**
   * Assign shift to an employee
   */
  static async assignShift(
    employeeId: number, 
    shiftId: number, 
    assignedBy?: number, 
    notes?: string
  ): Promise<Shift> {
    const shift = await this.getShiftById(shiftId);
    if (!shift) throw new Error('Shift not found.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update user shift_id
      await client.query(`
        UPDATE users 
        SET shift_id = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [shiftId, employeeId]);

      // Sync employee profile
      await client.query(`
        UPDATE employee_profiles
        SET shift_assignment = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [shift.name, employeeId]);

      // Insert record into employee_shift_assignments
      await client.query(`
        INSERT INTO employee_shift_assignments (
          employee_id, shift_id, assignment_type, start_date, assigned_by, notes
        ) VALUES (
          $1, $2, 'PERMANENT', CURRENT_DATE, $3, $4
        )
      `, [employeeId, shiftId, assignedBy || null, notes || 'Direct shift assignment']);

      // Log in audit_logs
      try {
        await client.query(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
          VALUES ($1, 'ASSIGN_SHIFT', 'USER', $2, $3)
        `, [
          assignedBy || employeeId,
          employeeId,
          JSON.stringify({ shiftId, shiftName: shift.name, shiftCode: shift.code, notes })
        ]);
      } catch (auditErr) {
        console.warn('Audit log error on shift assignment:', auditErr);
      }

      await client.query('COMMIT');
      return shift;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk assign shift to multiple employees
   */
  static async bulkAssignShift(
    employeeIds: number[], 
    shiftId: number, 
    assignedBy?: number, 
    notes?: string
  ): Promise<{ assignedCount: number; shift: Shift }> {
    if (!employeeIds || employeeIds.length === 0) {
      throw new Error('No employee IDs provided.');
    }

    const shift = await this.getShiftById(shiftId);
    if (!shift) throw new Error('Shift not found.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE users
        SET shift_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::int[])
      `, [shiftId, employeeIds]);

      await client.query(`
        UPDATE employee_profiles
        SET shift_assignment = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ANY($2::int[])
      `, [shift.name, employeeIds]);

      for (const empId of employeeIds) {
        await client.query(`
          INSERT INTO employee_shift_assignments (
            employee_id, shift_id, assignment_type, start_date, assigned_by, notes
          ) VALUES (
            $1, $2, 'PERMANENT', CURRENT_DATE, $3, $4
          )
        `, [empId, shiftId, assignedBy || null, notes || 'Bulk shift assignment']);
      }

      // Audit log
      try {
        await client.query(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
          VALUES ($1, 'BULK_ASSIGN_SHIFT', 'SHIFT', $2, $3)
        `, [
          assignedBy || null,
          shiftId,
          JSON.stringify({ employeeCount: employeeIds.length, employeeIds, shiftName: shift.name, shiftCode: shift.code })
        ]);
      } catch (auditErr) {
        console.warn('Audit log error on bulk shift assignment:', auditErr);
      }

      await client.query('COMMIT');
      return { assignedCount: employeeIds.length, shift };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get all employees assigned to a shift
   */
  static async getShiftEmployees(shiftId: number) {
    const res = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_id as "employeeId",
        u.department,
        u.designation,
        u.phone,
        u.status,
        ep.profile_photo_url as "profilePhotoUrl"
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.shift_id = $1
      ORDER BY u.name ASC
    `, [shiftId]);

    return res.rows;
  }

  /**
   * Get an employee's active assigned shift (with fallback to default Day Shift)
   */
  static async getEmployeeShift(employeeId: number): Promise<Shift> {
    const res = await query(`
      SELECT s.*
      FROM users u
      JOIN shifts s ON s.id = u.shift_id
      WHERE u.id = $1
    `, [employeeId]);

    if (res.rows.length > 0) {
      return this.formatShiftRow(res.rows[0]);
    }

    // Fallback: Default Day Shift
    const fallbackRes = await query(`SELECT * FROM shifts WHERE code = 'DS' LIMIT 1`);
    if (fallbackRes.rows.length > 0) {
      return this.formatShiftRow(fallbackRes.rows[0]);
    }

    // Ultimate fallback if table is empty
    return {
      id: 1,
      name: 'Day Shift',
      code: 'DS',
      startTime: '09:30:00',
      endTime: '18:30:00',
      breakMinutes: 0,
      graceMinutes: 15,
      minimumWorkHours: 8.00,
      lateAfter: '09:45:00',
      halfDayMinutes: 240,
      overtimeEnabled: true,
      description: 'Default shift',
      status: 'active',
      isNightShift: false,
    };
  }

  /**
   * Calculate late, working hours, break deduction, early departure, and overtime for a shift
   */
  static evaluateAttendance(
    shift: Shift | any,
    checkInDate: Date,
    checkOutDate?: Date | null
  ) {
    const startTime = shift.startTime || shift.start_time || '09:30:00';
    const endTime = shift.endTime || shift.end_time || '18:30:00';
    const breakMinutes = shift.breakMinutes !== undefined ? shift.breakMinutes : (shift.break_minutes !== undefined ? shift.break_minutes : 0);
    const graceMinutes = shift.graceMinutes !== undefined ? shift.graceMinutes : (shift.grace_minutes !== undefined ? shift.grace_minutes : 15);
    const lateAfter = shift.lateAfter || shift.late_after || computeLateAfter(startTime, graceMinutes);
    const minimumWorkHours = shift.minimumWorkHours !== undefined ? shift.minimumWorkHours : (shift.minimum_work_hours !== undefined ? parseFloat(shift.minimum_work_hours) : 8.0);
    const halfDayMinutes = shift.halfDayMinutes !== undefined ? shift.halfDayMinutes : (shift.half_day_minutes !== undefined ? shift.half_day_minutes : 240);
    const overtimeEnabled = shift.overtimeEnabled !== undefined ? shift.overtimeEnabled : (shift.overtime_enabled !== undefined ? shift.overtime_enabled : true);
    const isNightShift = shift.isNightShift !== undefined ? shift.isNightShift : (endTime <= startTime);

    // 1. Time string in HH:MM:SS format
    const checkInTimeStr = checkInDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });

    // 2. Late Detection
    let isLate = false;
    let lateMinutes = 0;

    if (isNightShift) {
      const [inH, inM] = checkInTimeStr.split(':').map(Number);
      const inTotalMins = inH * 60 + inM;
      const [lateH, lateM] = lateAfter.split(':').map(Number);
      const lateCutoffMins = lateH * 60 + lateM;

      if (inH < 12) {
        // Checked in after midnight for an overnight shift starting at e.g. 21:00
        isLate = true;
        lateMinutes = (inH + 24) * 60 + inM - lateCutoffMins;
      } else if (inTotalMins > lateCutoffMins) {
        isLate = true;
        lateMinutes = inTotalMins - lateCutoffMins;
      }
    } else {
      // Standard daytime shift
      if (checkInTimeStr > lateAfter) {
        isLate = true;
        const [inH, inM] = checkInTimeStr.split(':').map(Number);
        const [lateH, lateM] = lateAfter.split(':').map(Number);
        lateMinutes = (inH * 60 + inM) - (lateH * 60 + lateM);
      }
    }

    if (lateMinutes < 0) lateMinutes = 0;

    // 3. Working Minutes & Overtime if Check-Out present
    let rawDurationMinutes = 0;
    let workingMinutes = 0;
    let breakToDeduct = 0;
    let overtimeMinutes = 0;
    let earlyDepartureMinutes = 0;
    let status = 'PRESENT';

    if (checkOutDate) {
      rawDurationMinutes = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60);
      if (rawDurationMinutes < 0) rawDurationMinutes = 0;

      // Deduct break duration only if explicitly configured (>0) and duration is longer than break
      if (breakMinutes > 0 && rawDurationMinutes > breakMinutes) {
        breakToDeduct = breakMinutes;
      }
      workingMinutes = Math.max(0, rawDurationMinutes - breakToDeduct);

      // Check Early Departure
      const checkOutTimeStr = checkOutDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
      if (!isNightShift) {
        if (checkOutTimeStr < endTime) {
          const [outH, outM] = checkOutTimeStr.split(':').map(Number);
          const [endH, endM] = endTime.split(':').map(Number);
          earlyDepartureMinutes = Math.max(0, (endH * 60 + endM) - (outH * 60 + outM));
        }
      } else {
        // Overnight shift: end time is e.g. 06:00 AM next day
        const [outH, outM] = checkOutTimeStr.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        if (outH < endH || (outH === endH && outM < endM)) {
          earlyDepartureMinutes = Math.max(0, (endH * 60 + endM) - (outH * 60 + outM));
        }
      }

      // Check Overtime
      const expectedWorkingMinutes = minimumWorkHours * 60;
      if (overtimeEnabled && workingMinutes > expectedWorkingMinutes) {
        overtimeMinutes = Math.round(workingMinutes - expectedWorkingMinutes);
      }

      // Attendance status calculation based on working minutes vs thresholds
      if (workingMinutes < halfDayMinutes) {
        status = 'INSUFFICIENT_HOURS';
      } else if (workingMinutes < expectedWorkingMinutes) {
        status = 'HALF_DAY';
      } else {
        status = 'PRESENT';
      }
    }

    return {
      isLate,
      lateMinutes: Math.round(lateMinutes),
      rawDurationMinutes: Math.round(rawDurationMinutes),
      workingMinutes: Math.round(workingMinutes),
      breakDeducted: Math.round(breakToDeduct),
      overtimeMinutes: Math.round(overtimeMinutes),
      earlyDepartureMinutes: Math.round(earlyDepartureMinutes),
      status
    };
  }
}
