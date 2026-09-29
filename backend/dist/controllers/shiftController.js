"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyShift = exports.bulkAssignShift = exports.assignShift = exports.getShiftEmployees = exports.deleteShift = exports.updateShift = exports.createShift = exports.getShift = exports.getShifts = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const shiftService_1 = require("../services/shiftService");
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const createShiftSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Shift name must be at least 2 characters').max(100),
    code: zod_1.z.string().min(1, 'Shift code is required').max(50),
    startTime: zod_1.z.string().regex(timeRegex, 'Start time must be in HH:MM or HH:MM:SS format'),
    endTime: zod_1.z.string().regex(timeRegex, 'End time must be in HH:MM or HH:MM:SS format'),
    breakMinutes: zod_1.z.number().int().min(0).max(360).default(0),
    graceMinutes: zod_1.z.number().int().min(0).max(120).default(15),
    minimumWorkHours: zod_1.z.number().min(1).max(24).default(8.00),
    lateAfter: zod_1.z.string().regex(timeRegex, 'Late threshold must be in HH:MM or HH:MM:SS format').optional(),
    halfDayMinutes: zod_1.z.number().int().min(30).max(720).default(240),
    overtimeEnabled: zod_1.z.boolean().default(true),
    description: zod_1.z.string().max(500).optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
const updateShiftSchema = createShiftSchema.partial();
const assignShiftSchema = zod_1.z.object({
    employeeId: zod_1.z.number().int().positive('Invalid employee ID'),
    shiftId: zod_1.z.number().int().positive('Invalid shift ID'),
    notes: zod_1.z.string().max(255).optional(),
});
const bulkAssignShiftSchema = zod_1.z.object({
    employeeIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, 'At least one employee must be selected'),
    shiftId: zod_1.z.number().int().positive('Invalid shift ID'),
    notes: zod_1.z.string().max(255).optional(),
});
const getShifts = async (req, res) => {
    try {
        const status = req.query.status;
        const shifts = await shiftService_1.ShiftService.getAllShifts(status);
        res.json({ success: true, data: shifts });
    }
    catch (error) {
        console.error('getShifts error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch shifts' } });
    }
};
exports.getShifts = getShifts;
const getShift = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const shift = await shiftService_1.ShiftService.getShiftById(id);
        if (!shift) {
            res.status(404).json({ success: false, error: { message: 'Shift not found' } });
            return;
        }
        res.json({ success: true, data: shift });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Server error' } });
    }
};
exports.getShift = getShift;
const createShift = async (req, res) => {
    try {
        const parsed = createShiftSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: { message: parsed.error.issues[0]?.message || 'Invalid shift details' }
            });
            return;
        }
        const shift = await shiftService_1.ShiftService.createShift(parsed.data);
        res.status(201).json({
            success: true,
            message: `Shift "${shift.name}" (${shift.code}) created successfully`,
            data: shift
        });
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to create shift' } });
    }
};
exports.createShift = createShift;
const updateShift = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const parsed = updateShiftSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: { message: parsed.error.issues[0]?.message || 'Invalid shift updates' }
            });
            return;
        }
        const updated = await shiftService_1.ShiftService.updateShift(id, parsed.data);
        // Recalculate today's attendance for employees on this shift
        await (0, db_1.query)(`
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
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to update shift' } });
    }
};
exports.updateShift = updateShift;
const deleteShift = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await shiftService_1.ShiftService.deleteShift(id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to delete shift' } });
    }
};
exports.deleteShift = deleteShift;
const getShiftEmployees = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const employees = await shiftService_1.ShiftService.getShiftEmployees(id);
        res.json({ success: true, data: employees });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch shift employees' } });
    }
};
exports.getShiftEmployees = getShiftEmployees;
const assignShift = async (req, res) => {
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
        const shift = await shiftService_1.ShiftService.assignShift(employeeId, shiftId, assignedBy, notes);
        res.json({
            success: true,
            message: `Employee successfully assigned to shift "${shift.name}" (${shift.code})`,
            data: shift
        });
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to assign shift' } });
    }
};
exports.assignShift = assignShift;
const bulkAssignShift = async (req, res) => {
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
        const result = await shiftService_1.ShiftService.bulkAssignShift(employeeIds, shiftId, assignedBy, notes);
        res.json({
            success: true,
            message: `Successfully reassigned ${result.assignedCount} employee(s) to "${result.shift.name}" (${result.shift.code})`,
            data: result
        });
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to bulk assign shifts' } });
    }
};
exports.bulkAssignShift = bulkAssignShift;
const getMyShift = async (req, res) => {
    try {
        const userId = req.user.id;
        const shift = await shiftService_1.ShiftService.getEmployeeShift(userId);
        res.json({ success: true, data: shift });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to retrieve active shift' } });
    }
};
exports.getMyShift = getMyShift;
