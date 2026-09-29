import { Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { ShiftService } from '../services/shiftService';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const createShiftSchema = z.object({
  name: z.string().min(2, 'Shift name must be at least 2 characters').max(100),
  code: z.string().min(1, 'Shift code is required').max(50),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:MM or HH:MM:SS format'),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:MM or HH:MM:SS format'),
  breakMinutes: z.number().int().min(0).max(360).default(0),
  graceMinutes: z.number().int().min(0).max(120).default(15),
  minimumWorkHours: z.number().min(1).max(24).default(8.00),
  lateAfter: z.string().regex(timeRegex, 'Late threshold must be in HH:MM or HH:MM:SS format').optional(),
  halfDayMinutes: z.number().int().min(30).max(720).default(240),
  overtimeEnabled: z.boolean().default(true),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateShiftSchema = createShiftSchema.partial();

const assignShiftSchema = z.object({
  employeeId: z.number().int().positive('Invalid employee ID'),
  shiftId: z.number().int().positive('Invalid shift ID'),
  notes: z.string().max(255).optional(),
});

const bulkAssignShiftSchema = z.object({
  employeeIds: z.array(z.number().int().positive()).min(1, 'At least one employee must be selected'),
  shiftId: z.number().int().positive('Invalid shift ID'),
  notes: z.string().max(255).optional(),
});

export const getShifts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const shifts = await ShiftService.getAllShifts(status);
    res.json({ success: true, data: shifts });
  } catch (error: any) {
    console.error('getShifts error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch shifts' } });
  }
};

export const getShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const shift = await ShiftService.getShiftById(id);
    if (!shift) {
      res.status(404).json({ success: false, error: { message: 'Shift not found' } });
      return;
    }
    res.json({ success: true, data: shift });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Server error' } });
  }
};

export const createShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = createShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || 'Invalid shift details' }
      });
      return;
    }

    const shift = await ShiftService.createShift(parsed.data);
    res.status(201).json({
      success: true,
      message: `Shift "${shift.name}" (${shift.code}) created successfully`,
      data: shift
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to create shift' } });
  }
};

export const updateShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const parsed = updateShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || 'Invalid shift updates' }
      });
      return;
    }

    const updated = await ShiftService.updateShift(id, parsed.data);

    // Recalculate today's attendance for employees on this shift
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
      JOIN shifts s ON s.id = u.shift_id
      WHERE a.employee_id = u.id 
        AND s.id = $1
        AND a.attendance_date = CURRENT_DATE 
        AND a.check_in IS NOT NULL
    `, [id]);

    res.json({
      success: true,
      message: `Shift "${updated.name}" updated successfully`,
      data: updated
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to update shift' } });
  }
};

export const deleteShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const result = await ShiftService.deleteShift(id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to delete shift' } });
  }
};

export const getShiftEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const employees = await ShiftService.getShiftEmployees(id);
    res.json({ success: true, data: employees });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch shift employees' } });
  }
};

export const assignShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = assignShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || 'Invalid assignment parameters' }
      });
      return;
    }

    const { employeeId, shiftId, notes } = parsed.data;
    const assignedBy = req.user?.id;
    const shift = await ShiftService.assignShift(employeeId, shiftId, assignedBy, notes);

    res.json({
      success: true,
      message: `Employee successfully assigned to shift "${shift.name}" (${shift.code})`,
      data: shift
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to assign shift' } });
  }
};

export const bulkAssignShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = bulkAssignShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || 'Invalid bulk assignment parameters' }
      });
      return;
    }

    const { employeeIds, shiftId, notes } = parsed.data;
    const assignedBy = req.user?.id;
    const result = await ShiftService.bulkAssignShift(employeeIds, shiftId, assignedBy, notes);

    res.json({
      success: true,
      message: `Successfully reassigned ${result.assignedCount} employee(s) to "${result.shift.name}" (${result.shift.code})`,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to bulk assign shifts' } });
  }
};

export const getMyShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const shift = await ShiftService.getEmployeeShift(userId);
    res.json({ success: true, data: shift });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to retrieve active shift' } });
  }
};
