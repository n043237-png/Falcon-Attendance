"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeLeaveBalance = exports.getLeaveAdjustmentHistory = exports.adjustEmployeeLeaveBalance = exports.rejectLeave = exports.approveLeave = exports.getAdminLeaves = exports.initializeLeaves = exports.isInitialized = void 0;
const db_1 = require("../db");
const zod_1 = require("zod");
const notificationService_1 = require("../services/notificationService");
const isInitialized = async (req, res) => {
    try {
        const resCount = await (0, db_1.query)(`SELECT COUNT(*) as count FROM leave_balances`);
        const initialized = parseInt(resCount.rows[0].count) > 0;
        res.json({ success: true, data: { initialized } });
    }
    catch (error) {
        console.error('isInitialized error:', error);
        res.status(500).json({ success: false, error: { message: 'Error checking initialization status' } });
    }
};
exports.isInitialized = isInitialized;
const initializeSchema = zod_1.z.object({
    quarter: zod_1.z.number().min(1).max(4),
    employees: zod_1.z.array(zod_1.z.object({
        employeeId: zod_1.z.number(),
        usedPaidLeave: zod_1.z.number().min(0)
    }))
});
const initializeLeaves = async (req, res) => {
    const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
    try {
        const parsed = initializeSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: { message: 'Invalid data provided' } });
            return;
        }
        const { quarter, employees } = parsed.data;
        const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);
        const check = await client.query(`SELECT COUNT(*) FROM leave_balances`);
        if (parseInt(check.rows[0].count) > 0) {
            res.status(400).json({ success: false, error: { message: 'Leave balances already initialized' } });
            return;
        }
        await client.query('BEGIN');
        for (const emp of employees) {
            const accrued = quarter * 4.5;
            const currentBalance = accrued - emp.usedPaidLeave;
            await client.query(`
        INSERT INTO leave_balances (employee_id, year, accrued_leave, used_paid_leave, current_balance, last_credit_date)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      `, [emp.employeeId, year, accrued, emp.usedPaidLeave, currentBalance]);
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Leave initialized successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('initializeLeaves error:', error);
        res.status(500).json({ success: false, error: { message: 'Initialization failed' } });
    }
    finally {
        client.release();
    }
};
exports.initializeLeaves = initializeLeaves;
const getAdminLeaves = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        if (limit > 100)
            limit = 100;
        if (limit < 1)
            limit = 1;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const employeeId = req.query.employeeId;
        const search = req.query.search;
        let filterQuery = 'WHERE 1=1';
        const queryParams = [];
        if (status && status !== 'All') {
            queryParams.push(status.toUpperCase());
            filterQuery += ` AND lr.status = $${queryParams.length}`;
        }
        if (employeeId) {
            queryParams.push(employeeId);
            filterQuery += ` AND u.employee_id = $${queryParams.length}`;
        }
        if (search) {
            queryParams.push(`%${search}%`);
            filterQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.employee_id ILIKE $${queryParams.length} OR u.employee_code ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length} OR u.designation ILIKE $${queryParams.length})`;
        }
        const countRes = await (0, db_1.query)(`
      SELECT COUNT(*) 
      FROM leave_requests lr
      JOIN users u ON lr.employee_id = u.id
      ${filterQuery}
    `, queryParams);
        const total = parseInt(countRes.rows[0].count);
        const histRes = await (0, db_1.query)(`
      SELECT lr.id, lr.employee_id as employee_user_id, u.name as employee_name, u.employee_id as employee_code, lr.leave_type as "leaveType",
             lr.from_date, lr.to_date, lr.days, lr.reason, lr.status, lr.created_at, u.profile_photo_url as profile_photo_url,
             lr.assigned_to, u_assigned.name as assigned_to_name, u_assigned.email as assigned_to_email,
             lr.approved_by, u_admin.name as reviewer_name, u_admin.email as reviewer_email, lr.remarks as admin_comment
      FROM leave_requests lr
      JOIN users u ON lr.employee_id = u.id
      LEFT JOIN users u_assigned ON lr.assigned_to = u_assigned.id
      LEFT JOIN users u_admin ON lr.approved_by = u_admin.id
      ${filterQuery}
      ORDER BY lr.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);
        res.json({
            success: true,
            data: {
                items: histRes.rows.map(rec => ({
                    id: rec.id,
                    userId: rec.employee_user_id,
                    employeeName: rec.employee_name,
                    employeeId: rec.employee_code,
                    profilePhotoUrl: rec.profile_photo_url,
                    leaveType: rec.leaveType,
                    startDate: new Date(rec.from_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                    endDate: new Date(rec.to_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                    totalDays: parseFloat(rec.days),
                    reason: rec.reason,
                    status: rec.status,
                    createdAt: rec.created_at,
                    assignedTo: rec.assigned_to,
                    assignedToName: rec.assigned_to_name,
                    assignedToEmail: rec.assigned_to_email,
                    reviewerName: rec.reviewer_name,
                    reviewerEmail: rec.reviewer_email,
                    adminComment: rec.admin_comment
                })),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
            }
        });
    }
    catch (error) {
        console.error('getAdminLeaves error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error retrieving leaves.' } });
    }
};
exports.getAdminLeaves = getAdminLeaves;
const approveLeave = async (req, res) => {
    const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
    try {
        const adminId = req.user.id;
        const leaveId = parseInt(req.params.id);
        await client.query('BEGIN');
        const lrRes = await client.query(`
      SELECT lr.employee_id, lr.leave_type, lr.from_date, lr.days, lr.status, lr.assigned_to,
             u_assigned.name as assigned_to_name
      FROM leave_requests lr
      LEFT JOIN users u_assigned ON lr.assigned_to = u_assigned.id
      WHERE lr.id = $1 FOR UPDATE OF lr
    `, [leaveId]);
        if (lrRes.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ success: false, error: { code: 'LEAVE_NOT_FOUND', message: 'Request not found' } });
            return;
        }
        const lr = lrRes.rows[0];
        if (lr.status !== 'PENDING') {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, error: { code: 'LEAVE_NOT_PENDING', message: 'Leave is not pending' } });
            return;
        }
        // Restriction check: if assigned_to is set and the approving admin is NOT the assigned admin:
        if (lr.assigned_to && Number(lr.assigned_to) !== Number(adminId)) {
            await client.query('ROLLBACK');
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN_NOT_ASSIGNED',
                    message: `This leave request is specifically assigned to ${lr.assigned_to_name || 'another manager'} for review. Only the designated manager can approve or reject it.`
                }
            });
            return;
        }
        if (lr.leave_type === 'Paid Leave') {
            const year = new Date(lr.from_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);
            const balRes = await client.query(`
        SELECT id, current_balance FROM leave_balances 
        WHERE employee_id = $1 AND year = $2 FOR UPDATE
      `, [lr.employee_id, year]);
            if (balRes.rows.length === 0 || parseFloat(balRes.rows[0].current_balance) < parseFloat(lr.days)) {
                await client.query('ROLLBACK');
                res.status(400).json({ success: false, error: { code: 'INSUFFICIENT_LEAVE_BALANCE', message: 'Insufficient balance' } });
                return;
            }
            await client.query(`
        UPDATE leave_balances 
        SET used_paid_leave = used_paid_leave + $1, current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [lr.days, balRes.rows[0].id]);
        }
        else if (lr.leave_type === 'Leave Without Pay') {
            const year = new Date(lr.from_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);
            // Upsert logic for leave without pay if balance row doesn't exist?
            // Since it's Leave Without Pay, they might not have a balance row (ineligible yet).
            const balRes = await client.query(`
        SELECT id FROM leave_balances WHERE employee_id = $1 AND year = $2 FOR UPDATE
      `, [lr.employee_id, year]);
            if (balRes.rows.length > 0) {
                await client.query(`
          UPDATE leave_balances 
          SET leave_without_pay = leave_without_pay + $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [lr.days, balRes.rows[0].id]);
            }
            else {
                await client.query(`
          INSERT INTO leave_balances (employee_id, year, leave_without_pay)
          VALUES ($1, $2, $3)
        `, [lr.employee_id, year, lr.days]);
            }
        }
        // Update Request
        await client.query(`
      UPDATE leave_requests 
      SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [adminId, leaveId]);
        await client.query('COMMIT');
        // Notify employee of approval
        try {
            const fromDateObj = new Date(lr.from_date);
            const formattedDate = !isNaN(fromDateObj.getTime())
                ? fromDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
                : lr.from_date;
            await notificationService_1.NotificationService.notifyUser(lr.employee_id, {
                title: '🎉 Leave Approved',
                message: `Your leave request for ${formattedDate} has been approved.`,
                type: 'Leave',
                priority: 'High',
                actionUrl: '/leave',
            });
        }
        catch (notifErr) {
            console.warn('Approve leave notification error:', notifErr);
        }
        res.json({ success: true, message: 'Leave approved' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('approveLeave error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Approval failed' } });
    }
    finally {
        client.release();
    }
};
exports.approveLeave = approveLeave;
const rejectSchema = zod_1.z.object({ comment: zod_1.z.string().min(3).max(500) });
const rejectLeave = async (req, res) => {
    try {
        const adminId = req.user.id;
        const leaveId = parseInt(req.params.id);
        const parsed = rejectSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required (min 3 chars).' } });
            return;
        }
        const existRes = await (0, db_1.query)(`
      SELECT lr.employee_id, lr.leave_type, lr.from_date, lr.days, lr.status, lr.assigned_to,
             u_assigned.name as assigned_to_name
      FROM leave_requests lr
      LEFT JOIN users u_assigned ON lr.assigned_to = u_assigned.id
      WHERE lr.id = $1
    `, [leaveId]);
        if (existRes.rows.length === 0) {
            res.status(404).json({ success: false, error: { code: 'LEAVE_NOT_FOUND', message: 'Request not found' } });
            return;
        }
        if (existRes.rows[0].status !== 'PENDING') {
            res.status(400).json({ success: false, error: { code: 'LEAVE_NOT_PENDING', message: 'Leave is not pending' } });
            return;
        }
        // Restriction check: if assigned_to is set and the rejecting admin is NOT the assigned admin:
        if (existRes.rows[0].assigned_to && Number(existRes.rows[0].assigned_to) !== Number(adminId)) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN_NOT_ASSIGNED',
                    message: `This leave request is specifically assigned to ${existRes.rows[0].assigned_to_name || 'another manager'} for review. Only the designated manager can approve or reject it.`
                }
            });
            return;
        }
        await (0, db_1.query)(`
      UPDATE leave_requests 
      SET status = 'REJECTED', remarks = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [parsed.data.comment, adminId, leaveId]);
        // Notify employee of rejection
        try {
            await notificationService_1.NotificationService.notifyUser(existRes.rows[0].employee_id, {
                title: 'Leave Request Rejected',
                message: `Your ${existRes.rows[0].leave_type} request was rejected. Reason: ${parsed.data.comment}`,
                type: 'Leave',
                priority: 'High',
                actionUrl: '/my-leave',
            });
        }
        catch (notifErr) {
            console.warn('Reject leave notification error:', notifErr);
        }
        res.json({ success: true, message: 'Leave rejected' });
    }
    catch (error) {
        console.error('rejectLeave error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Rejection failed' } });
    }
};
exports.rejectLeave = rejectLeave;
const adjustLeaveSchema = zod_1.z.object({
    employeeId: zod_1.z.number().int().positive(),
    actionType: zod_1.z.enum(['ADD', 'DEDUCT']),
    days: zod_1.z.number().positive(),
    reason: zod_1.z.string().min(3).max(500),
    year: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
});
const adjustEmployeeLeaveBalance = async (req, res) => {
    const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
    try {
        const adminId = req.user.id;
        const parsed = adjustLeaveSchema.safeParse(req.body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0]?.message || 'Invalid adjustment data';
            res.status(400).json({ success: false, error: { message: issue } });
            return;
        }
        const { employeeId, actionType, days, reason } = parsed.data;
        const year = String(parsed.data.year || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4));
        await client.query('BEGIN');
        // Verify employee
        const empRes = await client.query(`SELECT id, name FROM users WHERE id = $1`, [employeeId]);
        if (empRes.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ success: false, error: { message: 'Employee not found' } });
            return;
        }
        // Get current leave balance
        let balRes = await client.query(`
      SELECT id, accrued_leave, used_paid_leave, leave_without_pay, current_balance
      FROM leave_balances
      WHERE employee_id = $1 AND year = $2
      FOR UPDATE
    `, [employeeId, year]);
        let previousBalance = 0;
        let balanceId;
        let currentAccrued = 0;
        if (balRes.rows.length === 0) {
            // Initialize if not present
            const insertRes = await client.query(`
        INSERT INTO leave_balances (employee_id, year, accrued_leave, used_paid_leave, leave_without_pay, current_balance, last_credit_date)
        VALUES ($1, $2, 0, 0, 0, 0, CURRENT_DATE)
        RETURNING id
      `, [employeeId, year]);
            balanceId = insertRes.rows[0].id;
            previousBalance = 0;
            currentAccrued = 0;
        }
        else {
            balanceId = balRes.rows[0].id;
            previousBalance = parseFloat(balRes.rows[0].current_balance || '0');
            currentAccrued = parseFloat(balRes.rows[0].accrued_leave || '0');
        }
        let newBalance = previousBalance;
        let newAccrued = currentAccrued;
        if (actionType === 'ADD') {
            newBalance = Math.round((previousBalance + days) * 100) / 100;
            newAccrued = Math.round((currentAccrued + days) * 100) / 100;
        }
        else {
            if (previousBalance < days) {
                await client.query('ROLLBACK');
                res.status(400).json({
                    success: false,
                    error: {
                        message: `Cannot deduct ${days} day(s). Employee only has ${previousBalance} day(s) available.`
                    }
                });
                return;
            }
            newBalance = Math.round((previousBalance - days) * 100) / 100;
            newAccrued = Math.max(0, Math.round((currentAccrued - days) * 100) / 100);
        }
        // Update leave balance
        await client.query(`
      UPDATE leave_balances
      SET current_balance = $1, accrued_leave = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newBalance, newAccrued, balanceId]);
        // Insert audit log
        await client.query(`
      INSERT INTO leave_balance_adjustments
        (employee_id, admin_id, year, action_type, days, previous_balance, new_balance, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [employeeId, adminId, year, actionType, days, previousBalance, newBalance, reason]);
        await client.query('COMMIT');
        // Notify employee of adjustment
        try {
            const sign = actionType === 'ADD' ? '+' : '-';
            await notificationService_1.NotificationService.notifyUser(employeeId, {
                title: 'Leave Balance Adjusted',
                message: `Your leave balance was adjusted by admin: ${sign}${days} day(s). New balance: ${newBalance} days. Reason: ${reason}`,
                type: 'Leave',
                priority: 'Medium',
                actionUrl: '/my-leave',
            });
        }
        catch (notifErr) {
            console.warn('Adjust leave balance notification error:', notifErr);
        }
        res.json({
            success: true,
            message: `Leave balance successfully updated (${actionType === 'ADD' ? '+' : '-'}${days} days).`,
            data: {
                employeeId,
                previousBalance,
                newBalance,
                days,
                actionType,
                reason,
                year
            }
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('adjustEmployeeLeaveBalance error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to adjust leave balance' } });
    }
    finally {
        client.release();
    }
};
exports.adjustEmployeeLeaveBalance = adjustEmployeeLeaveBalance;
const getLeaveAdjustmentHistory = async (req, res) => {
    try {
        const employeeId = parseInt(req.params.employeeId);
        if (!employeeId || isNaN(employeeId)) {
            res.status(400).json({ success: false, error: { message: 'Valid employee ID required' } });
            return;
        }
        const result = await (0, db_1.query)(`
      SELECT 
        lba.id,
        lba.employee_id as "employeeId",
        lba.admin_id as "adminId",
        u_admin.name as "adminName",
        lba.year,
        lba.action_type as "actionType",
        lba.days::float as "days",
        lba.previous_balance::float as "previousBalance",
        lba.new_balance::float as "newBalance",
        lba.reason,
        lba.created_at as "createdAt"
      FROM leave_balance_adjustments lba
      LEFT JOIN users u_admin ON lba.admin_id = u_admin.id
      WHERE lba.employee_id = $1
      ORDER BY lba.created_at DESC
      LIMIT 50
    `, [employeeId]);
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('getLeaveAdjustmentHistory error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch adjustment history' } });
    }
};
exports.getLeaveAdjustmentHistory = getLeaveAdjustmentHistory;
const getEmployeeLeaveBalance = async (req, res) => {
    try {
        const employeeId = parseInt(req.params.employeeId);
        if (!employeeId || isNaN(employeeId)) {
            res.status(400).json({ success: false, error: { message: 'Valid employee ID required' } });
            return;
        }
        const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);
        const result = await (0, db_1.query)(`
      SELECT 
        id,
        employee_id as "employeeId",
        year,
        accrued_leave::float as "accruedLeave",
        used_paid_leave::float as "usedPaidLeave",
        leave_without_pay::float as "leaveWithoutPay",
        current_balance::float as "currentBalance",
        last_credit_date as "lastCreditDate"
      FROM leave_balances
      WHERE employee_id = $1 AND year = $2
    `, [employeeId, year]);
        if (result.rows.length === 0) {
            res.json({
                success: true,
                data: {
                    employeeId,
                    year: parseInt(year),
                    accruedLeave: 0,
                    usedPaidLeave: 0,
                    leaveWithoutPay: 0,
                    currentBalance: 0,
                    isInitialized: false
                }
            });
            return;
        }
        res.json({
            success: true,
            data: {
                ...result.rows[0],
                isInitialized: true
            }
        });
    }
    catch (error) {
        console.error('getEmployeeLeaveBalance error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch leave balance' } });
    }
};
exports.getEmployeeLeaveBalance = getEmployeeLeaveBalance;
