import { Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { NotificationService } from '../services/notificationService';
import { LeaveValidationService } from '../services/leaveValidationService';

const applyLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().min(3).max(500),
  assignedToAdminId: z.number().nullable().optional(),
});

export const getBalances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);

    const balanceRes = await query(`
      SELECT accrued_leave, used_paid_leave, leave_without_pay, current_balance, last_credit_date
      FROM leave_balances
      WHERE employee_id = $1 AND year = $2
    `, [employeeId, year]);

    if (balanceRes.rows.length === 0) {
      res.json({
        success: true,
        data: {
          accruedLeave: 0,
          usedPaidLeave: 0,
          leaveWithoutPay: 0,
          currentBalance: 0,
          lastCreditDate: null,
          eligible: false
        }
      });
      return;
    }

    const b = balanceRes.rows[0];
    res.json({
      success: true,
      data: {
        accruedLeave: parseFloat(b.accrued_leave),
        usedPaidLeave: parseFloat(b.used_paid_leave),
        leaveWithoutPay: parseFloat(b.leave_without_pay),
        currentBalance: parseFloat(b.current_balance),
        lastCreditDate: b.last_credit_date,
        eligible: true
      }
    });
  } catch (error) {
    console.error('getBalances error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch leave balances' } });
  }
};

export const validateLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const startDate = (req.query.startDate as string) || req.body?.startDate;
    const endDate = (req.query.endDate as string) || req.body?.endDate;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: { message: 'startDate and endDate (YYYY-MM-DD) are required.' } });
      return;
    }

    const result = await LeaveValidationService.validateLeaveRequest(employeeId, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('validateLeave error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to validate leave' } });
  }
};

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
  
  try {
    const employeeId = req.user!.id;
    const parsed = applyLeaveSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const { startDate, endDate, reason, assignedToAdminId } = parsed.data;
    const targetAdminId = assignedToAdminId || null;

    // Run Smart Leave Validation Engine
    const validation = await LeaveValidationService.validateLeaveRequest(employeeId, startDate, endDate);
    if (!validation.canSubmit) {
      res.status(400).json({
        success: false,
        error: {
          code: validation.hasApprovedOverlap ? 'APPROVED_LEAVE_OVERLAP' : 'LEAVE_OVERLAP',
          message: validation.blockReason || 'You already have a leave request covering these dates.'
        },
        data: validation
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = validation.totalDays;
    const paidLeaveRequired = validation.paidLeaveRequired;

    const year = startDate.substring(0, 4);
    
    await client.query('BEGIN');
    
    const balanceRes = await client.query(`
      SELECT current_balance FROM leave_balances 
      WHERE employee_id = $1 AND year = $2 FOR UPDATE
    `, [employeeId, year]);

    let availableBalance = 0;
    if (balanceRes.rows.length > 0 && balanceRes.rows[0].current_balance !== null) {
      availableBalance = parseFloat(balanceRes.rows[0].current_balance);
    }

    const insertedIds = [];

    if (paidLeaveRequired === 0) {
      // Non-working days only (Sundays or Holidays)
      const leaveType = validation.allWeeklyOffs ? 'Weekly Off' : (validation.allCompanyHolidays ? 'Company Holiday' : 'Paid Leave');
      const insertRes = await client.query(`
        INSERT INTO leave_requests (employee_id, from_date, to_date, days, reason, leave_type, status, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
        RETURNING id
      `, [employeeId, startDate, endDate, totalDays, reason, leaveType, targetAdminId]);
      insertedIds.push(insertRes.rows[0].id);
    } else if (availableBalance >= paidLeaveRequired) {
      // Entire working duration covered by paid leave
      const insertRes = await client.query(`
        INSERT INTO leave_requests (employee_id, from_date, to_date, days, reason, leave_type, status, assigned_to)
        VALUES ($1, $2, $3, $4, $5, 'Paid Leave', 'PENDING', $6)
        RETURNING id
      `, [employeeId, startDate, endDate, totalDays, reason, targetAdminId]);
      insertedIds.push(insertRes.rows[0].id);
    } else {
      // Split into Paid Leave and Leave Without Pay
      let remainingDays = paidLeaveRequired;
      let currentStartDate = new Date(start);

      if (availableBalance > 0) {
        const paidLeaveDays = availableBalance;
        const paidEndDate = new Date(currentStartDate);
        paidEndDate.setDate(paidEndDate.getDate() + paidLeaveDays - 1);

        const insertRes1 = await client.query(`
          INSERT INTO leave_requests (employee_id, from_date, to_date, days, reason, leave_type, status, assigned_to)
          VALUES ($1, $2, $3, $4, $5, 'Paid Leave', 'PENDING', $6)
          RETURNING id
        `, [
          employeeId, 
          currentStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), 
          paidEndDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), 
          paidLeaveDays, 
          reason,
          targetAdminId
        ]);
        insertedIds.push(insertRes1.rows[0].id);

        remainingDays -= paidLeaveDays;
        currentStartDate = new Date(paidEndDate);
        currentStartDate.setDate(currentStartDate.getDate() + 1);
      }

      if (remainingDays > 0) {
        const insertRes2 = await client.query(`
          INSERT INTO leave_requests (employee_id, from_date, to_date, days, reason, leave_type, status, assigned_to)
          VALUES ($1, $2, $3, $4, $5, 'Leave Without Pay', 'PENDING', $6)
          RETURNING id
        `, [
          employeeId, 
          currentStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), 
          endDate, 
          remainingDays, 
          reason,
          targetAdminId
        ]);
        insertedIds.push(insertRes2.rows[0].id);
      }
    }

    await client.query('COMMIT');

    // Trigger Smart Notifications
    try {
      if (targetAdminId) {
        await NotificationService.notifyUser(targetAdminId, {
          title: 'Leave Request Assigned to You',
          message: `${req.user!.name || 'An employee'} applied for leave from ${startDate} to ${endDate} and assigned you as approver.`,
          type: 'Leave',
          priority: 'High',
          actionUrl: '/leave',
        });
      } else {
        await NotificationService.notifyAdmins({
          title: 'New Leave Request',
          message: `${req.user!.name || 'An employee'} applied for leave from ${startDate} to ${endDate}.`,
          type: 'Leave',
          priority: 'Medium',
          actionUrl: '/leave',
        });
      }

      await NotificationService.notifyUser(employeeId, {
        title: 'Leave Request Submitted',
        message: `Your leave request for ${startDate} to ${endDate} has been submitted for approval.`,
        type: 'Leave',
        priority: 'Low',
        actionUrl: '/my-leave',
      });
    } catch (notifErr) {
      console.warn('Leave apply notification error:', notifErr);
    }

    res.json({ success: true, data: { leaveIds: insertedIds, status: 'PENDING' } });
  } catch (error) {
    const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
    await client.query('ROLLBACK');
    client.release();
    
    console.error('applyLeave error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to apply for leave' } });
  }
};

export const getLeaveHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    if (page < 1) return res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' } }) as any;
    
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string;

    let filterQuery = `WHERE lr.employee_id = $1`;
    let queryParams: any[] = [employeeId];

    if (statusFilter && statusFilter !== 'ALL') {
      queryParams.push(statusFilter.toUpperCase());
      filterQuery += ` AND lr.status = $2`;
    }

    const countRes = await query(`SELECT COUNT(*) FROM leave_requests lr ${filterQuery}`, queryParams);
    const total = parseInt(countRes.rows[0].count);

    const histRes = await query(`
      SELECT lr.id, lr.leave_type as "leaveType", lr.from_date, lr.to_date, lr.days as total_days, lr.reason, lr.status,
             lr.remarks as "adminComment", lr.approved_at as "reviewedAt",
             lr.assigned_to as "assignedTo", u_assigned.name as "assignedToName", u_assigned.email as "assignedToEmail",
             u.name as "employeeName", u.employee_id as "employeeCode", u.profile_photo_url as "profilePhotoUrl",
             u_admin.name as "reviewerName", u_admin.email as "reviewerEmail"
      FROM leave_requests lr
      JOIN users u ON lr.employee_id = u.id
      LEFT JOIN users u_admin ON lr.approved_by = u_admin.id
      LEFT JOIN users u_assigned ON lr.assigned_to = u_assigned.id
      ${filterQuery}
      ORDER BY lr.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: {
        items: histRes.rows.map(rec => ({
          id: rec.id,
          employeeName: rec.employeeName,
          employeeId: rec.employeeCode,
          profilePhotoUrl: rec.profilePhotoUrl,
          leaveType: rec.leaveType,
          startDate: new Date(rec.from_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
          endDate: new Date(rec.to_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
          totalDays: parseFloat(rec.total_days),
          reason: rec.reason,
          status: rec.status,
          adminComment: rec.adminComment,
          reviewerName: rec.reviewerName,
          reviewedAt: rec.reviewedAt,
          assignedTo: rec.assignedTo,
          assignedToName: rec.assignedToName,
          assignedToEmail: rec.assignedToEmail
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('getLeaveHistory error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch leave history' } });
  }
};

export const getLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const id = parseInt(req.params.id as string);

    const leaveRes = await query(`
      SELECT lr.id, lr.leave_type as "leaveType", lr.from_date, lr.to_date, lr.days as total_days, lr.reason, lr.status,
             lr.remarks as admin_comment, lr.approved_at as reviewed_at, lr.created_at
      FROM leave_requests lr
      WHERE lr.id = $1 AND lr.employee_id = $2
    `, [id, employeeId]);

    if (leaveRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'LEAVE_NOT_FOUND', message: 'Leave request not found.' } });
      return;
    }

    const rec = leaveRes.rows[0];
    res.json({
      success: true,
      data: {
        id: rec.id,
        leaveType: rec.leaveType,
        startDate: new Date(rec.from_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        endDate: new Date(rec.to_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        totalDays: parseFloat(rec.total_days),
        reason: rec.reason,
        status: rec.status,
        adminComment: rec.admin_comment,
        reviewedAt: rec.reviewed_at,
        createdAt: rec.created_at
      }
    });
  } catch (error) {
    console.error('getLeaveRequest error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch leave request' } });
  }
};

export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const id = parseInt(req.params.id as string);

    const existRes = await query(`SELECT status FROM leave_requests WHERE id = $1 AND employee_id = $2`, [id, employeeId]);
    if (existRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'LEAVE_NOT_FOUND', message: 'Leave request not found.' } });
      return;
    }

    if (existRes.rows[0].status !== 'PENDING') {
      res.status(400).json({ success: false, error: { code: 'LEAVE_NOT_PENDING', message: 'Only pending requests can be cancelled.' } });
      return;
    }

    await query(`UPDATE leave_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error('cancelLeave error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to cancel leave' } });
  }
};

export const getLeaveAdmins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT id, name, email, employee_id
      FROM users
      WHERE (role = 'admin' OR 'admin' = ANY(roles)) AND status = 'active'
      ORDER BY name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('getLeaveAdmins error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to fetch admins' } });
  }
};

