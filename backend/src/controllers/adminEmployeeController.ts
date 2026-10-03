import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { processAndSaveProfilePhoto, deleteProfilePhotoFile } from '../middlewares/upload';
import { NotificationService } from '../services/notificationService';
import { EmployeeIdService } from '../services/employeeIdService';
import { EmployeeProfileService } from '../services/employeeProfileService';
import { DocumentService } from '../services/documentService';

const createEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().transform((val) => {
    const trimmed = (val || '').trim().toLowerCase();
    return trimmed.includes('@') ? trimmed : `${trimmed}@falconinfo.net`;
  }).pipe(z.string().email()),
  phone: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val === '' || val.length === 10, {
      message: 'Phone number must be exactly 10 digits'
    })
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  joiningDate: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
      z.literal(''),
      z.null()
    ])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (!v || v === '') return null;
      return v.substring(0, 10);
    }),
  role: z.enum(['employee', 'admin']).default('employee'),
  roles: z.array(z.enum(['employee', 'admin'])).min(1).optional(),
  useCustomEmployeeId: z.boolean().default(false).optional(),
  customEmployeeId: z.string().max(20).optional(),
  customIdReason: z.string().max(255).optional(),
  password: z.string().min(6).max(100).optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  jobStatus: z.enum(['Provisional', 'Permanent']).default('Permanent'),
  provisionalStartDate: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
      z.literal(''),
      z.null()
    ])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (!v || v === '') return null;
      return v.substring(0, 10);
    }),
  provisionalEndDate: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
      z.literal(''),
      z.null()
    ])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (!v || v === '') return null;
      return v.substring(0, 10);
    }),
  shiftId: z.number().int().positive().optional(),
  attendanceMode: z.string().default('Office').optional(),
  motherName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  fatherName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  reportingManager: z.string().max(100).optional().or(z.literal('')).or(z.null()),
});

const editEmployeeSchema = createEmployeeSchema.partial();

export const getNextEmployeeIdHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nextId = await EmployeeIdService.getNextEmployeeId();
    res.json({ success: true, data: { nextEmployeeId: nextId } });
  } catch (err: any) {
    console.error('getNextEmployeeId error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to generate Employee ID' } });
  }
};

export const validateEmployeeIdHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = (req.query.employeeId as string) || (req.body?.employeeId as string) || '';
    const result = await EmployeeIdService.validateEmployeeId(employeeId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('validateEmployeeId error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to validate Employee ID' } });
  }
};

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    const offset = (page - 1) * limit;

    const search = req.query.search as string;
    const department = req.query.department as string;
    const designation = req.query.designation as string;
    const status = req.query.status as string;
    const role = req.query.role as string;
    const jobStatus = req.query.jobStatus as string;

    const shiftId = req.query.shiftId as string;

    let filterQuery = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (search) {
      queryParams.push(`%${search}%`);
      filterQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.employee_id ILIKE $${queryParams.length} OR u.employee_code ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.phone ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length} OR u.designation ILIKE $${queryParams.length})`;
    }
    if (department) {
      queryParams.push(department);
      filterQuery += ` AND u.department = $${queryParams.length}`;
    }
    if (designation && designation !== 'All') {
      queryParams.push(designation);
      filterQuery += ` AND u.designation = $${queryParams.length}`;
    }
    if (status && status !== 'All') {
      queryParams.push(status.toLowerCase());
      filterQuery += ` AND u.status = $${queryParams.length}`;
    }
    if (role && role !== 'All') {
      queryParams.push(role.toLowerCase());
      filterQuery += ` AND (u.role = $${queryParams.length} OR u.roles @> jsonb_build_array($${queryParams.length}::text))`;
    }
    if (jobStatus && jobStatus !== 'All') {
      queryParams.push(jobStatus);
      filterQuery += ` AND u.job_status = $${queryParams.length}`;
    }
    if (shiftId && shiftId !== 'All') {
      queryParams.push(parseInt(shiftId, 10));
      filterQuery += ` AND u.shift_id = $${queryParams.length}`;
    }

    const countRes = await query(`SELECT COUNT(*) FROM users u ${filterQuery}`, queryParams);
    const total = parseInt(countRes.rows[0].count);

    const usersRes = await query(`
      SELECT u.id, u.employee_id as "employeeId", u.employee_code as "employeeCode",
             u.is_custom_employee_id as "isCustomEmployeeId",
             u.name, u.email, u.phone, u.department, 
             u.designation, u.joining_date as "joiningDate", u.status, u.role, u.roles,
             COALESCE(u.attendance_mode, 'Office') as "attendanceMode",
             COALESCE(u.job_status, 'Permanent') as "jobStatus",
             u.provisional_start_date as "provisionalStartDate",
             u.provisional_end_date as "provisionalEndDate",
             u.profile_photo_url as "profilePhotoUrl", u.created_at as "createdAt",
             u.shift_id as "shiftId",
             s.name as "shiftName",
             s.code as "shiftCode",
             s.start_time as "shiftStartTime",
             s.end_time as "shiftEndTime",
             lb.current_balance::float as "leaveBalance",
             lb.accrued_leave::float as "accruedLeave",
             lb.used_paid_leave::float as "usedPaidLeave",
             ep.mother_name as "motherName",
             ep.father_name as "fatherName",
             COALESCE(ep.reporting_manager, m.name) as "reportingManager"
      FROM users u
      LEFT JOIN shifts s ON s.id = u.shift_id
      LEFT JOIN leave_balances lb ON lb.employee_id = u.id AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN users m ON ep.reporting_manager_id = m.id
      ${filterQuery}
      ORDER BY 
        CASE 
          WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
          WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
          ELSE 2 
        END,
        NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST,
        u.employee_id ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    const items = usersRes.rows.map(rec => {
      if (rec.joiningDate) {
        rec.joiningDate = new Date(rec.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      }
      if (rec.provisionalStartDate) {
        rec.provisionalStartDate = new Date(rec.provisionalStartDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      }
      if (rec.provisionalEndDate) {
        rec.provisionalEndDate = new Date(rec.provisionalEndDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      }
      rec.roles = Array.isArray(rec.roles) ? rec.roles : [rec.role || 'employee'];
      rec.leaveBalances = rec.leaveBalance !== null && rec.leaveBalance !== undefined ? {
        currentBalance: rec.leaveBalance,
        accruedLeave: rec.accruedLeave || 0,
        usedPaidLeave: rec.usedPaidLeave || 0
      } : { currentBalance: 0, accruedLeave: 0, usedPaidLeave: 0 };
      return rec;
    });

    res.json({
      success: true,
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('getEmployees error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch employees' } });
  }
};

export const getEmployeeDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const userRes = await query(`
      SELECT u.id, u.employee_id as "employeeId", u.name, u.email, u.phone, u.department, 
             u.designation, u.joining_date as "joiningDate", u.status, u.role, u.roles,
             COALESCE(u.attendance_mode, 'Office') as "attendanceMode",
             COALESCE(u.job_status, 'Permanent') as "jobStatus",
             u.provisional_start_date as "provisionalStartDate",
             u.provisional_end_date as "provisionalEndDate",
             u.profile_photo_url as "profilePhotoUrl",
             u.shift_id as "shiftId",
             s.name as "shiftName",
             s.code as "shiftCode",
             s.start_time as "shiftStartTime",
             s.end_time as "shiftEndTime",
             ep.mother_name as "motherName",
             ep.father_name as "fatherName",
             COALESCE(ep.reporting_manager, m.name) as "reportingManager"
      FROM users u
      LEFT JOIN shifts s ON s.id = u.shift_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN users m ON ep.reporting_manager_id = m.id
      WHERE u.id = $1
    `, [id]);

    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    const profile = userRes.rows[0];
    profile.roles = Array.isArray(profile.roles) ? profile.roles : [profile.role || 'employee'];
    if (profile.joiningDate) {
      profile.joiningDate = new Date(profile.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    if (profile.provisionalStartDate) {
      profile.provisionalStartDate = new Date(profile.provisionalStartDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    if (profile.provisionalEndDate) {
      profile.provisionalEndDate = new Date(profile.provisionalEndDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      
      const today = new Date();
      const end = new Date(profile.provisionalEndDate);
      const diffTime = end.getTime() - today.getTime();
      profile.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      profile.daysRemaining = null;
    }

    const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 4);

    // Attendance summary
    const attRes = await query(`
      SELECT 
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late
      FROM attendance
      WHERE employee_id = $1 AND EXTRACT(YEAR FROM attendance_date) = $2
    `, [id, year]);

    // Leave requests summary
    const leaveRes = await query(`
      SELECT 
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
      FROM leave_requests
      WHERE employee_id = $1 AND EXTRACT(YEAR FROM from_date) = $2
    `, [id, year]);

    // Leave balances
    const balRes = await query(`
      SELECT accrued_leave as "accruedLeave", used_paid_leave as "usedPaidLeave", leave_without_pay as "leaveWithoutPay", current_balance as "currentBalance", last_credit_date as "lastCreditDate"
      FROM leave_balances
      WHERE employee_id = $1 AND year = $2
    `, [id, year]);

    res.json({
      success: true,
      data: {
        profile,
        attendanceSummary: {
          present: parseInt(attRes.rows[0].present || '0'),
          absent: parseInt(attRes.rows[0].absent || '0'),
          late: parseInt(attRes.rows[0].late || '0'),
        },
        leaveSummary: {
          approved: parseInt(leaveRes.rows[0].approved || '0'),
          pending: parseInt(leaveRes.rows[0].pending || '0'),
          rejected: parseInt(leaveRes.rows[0].rejected || '0'),
        },
        leaveBalances: balRes.rows.length > 0 ? {
          accruedLeave: parseFloat(balRes.rows[0].accruedLeave),
          usedPaidLeave: parseFloat(balRes.rows[0].usedPaidLeave),
          leaveWithoutPay: parseFloat(balRes.rows[0].leaveWithoutPay),
          currentBalance: parseFloat(balRes.rows[0].currentBalance),
          lastCreditDate: balRes.rows[0].lastCreditDate
        } : null
      }
    });
  } catch (error) {
    console.error('getEmployeeDetail error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch employee details' } });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await require('pg').Pool.prototype.connect.bind(require('../db').pool)();
  try {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const {
      name, email, phone, department, designation, joiningDate,
      role, roles, useCustomEmployeeId, customEmployeeId, customIdReason,
      password, profilePhotoUrl, jobStatus, provisionalStartDate, provisionalEndDate,
      shiftId, attendanceMode,
      motherName, fatherName, reportingManager
    } = parsed.data;

    // Check email uniqueness
    const emailRes = await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (emailRes.rows.length > 0) {
      res.status(400).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'Email already exists' } });
      return;
    }

    // Role check for custom Employee ID
    const userRole = (req.user?.role || '').toLowerCase();
    const userRolesList = Array.isArray(req.user?.roles) ? req.user.roles.map((r: string) => r.toLowerCase()) : [userRole];
    const isAdmin = userRole === 'admin' || userRolesList.includes('admin');

    let employeeCode = '';
    let isCustom = false;

    if (useCustomEmployeeId || (customEmployeeId && customEmployeeId.trim() !== '')) {
      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only administrators can assign custom Employee IDs.' }
        });
        return;
      }

      const valRes = await EmployeeIdService.validateEmployeeId(customEmployeeId || '', undefined, client);
      if (!valRes.valid) {
        res.status(400).json({
          success: false,
          error: { code: 'EMPLOYEE_ID_IN_USE', message: valRes.message || 'Invalid Employee ID.' }
        });
        return;
      }

      employeeCode = (customEmployeeId || '').trim();
      isCustom = true;
    }

    await client.query('BEGIN');

    // If not custom, generate sequential Employee ID safely within the transaction
    if (!isCustom) {
      employeeCode = await EmployeeIdService.getNextEmployeeId(client);
    }

    // Generate or use temp password
    const tempPassword = password || crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 10);

    const userRoles = (roles && roles.length > 0) ? Array.from(new Set(roles.map(r => r.toLowerCase()))) : [role ? role.toLowerCase() : 'employee'];
    const primaryRole = userRoles.includes('admin') ? 'admin' : 'employee';

    // Resolve target shift (defaults to Day Shift)
    let targetShiftId = parsed.data.shiftId;
    if (!targetShiftId) {
      const dsRes = await client.query(`SELECT id FROM shifts WHERE code = 'DS' LIMIT 1`);
      if (dsRes.rows.length > 0) targetShiftId = dsRes.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO users (
        employee_id, employee_code, is_custom_employee_id, name, email, phone, department, designation, 
        joining_date, role, roles, password_hash, status, profile_photo_url,
        job_status, provisional_start_date, provisional_end_date, shift_id, attendance_mode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, 'active', $13, $14, $15, $16, $17, $18)
      RETURNING id, employee_id as "employeeId", employee_code as "employeeCode",
                is_custom_employee_id as "isCustomEmployeeId", profile_photo_url as "profilePhotoUrl",
                job_status as "jobStatus", provisional_start_date as "provisionalStartDate",
                provisional_end_date as "provisionalEndDate", roles, role, shift_id as "shiftId",
                attendance_mode as "attendanceMode"
    `;
    const insertParams = [
      employeeCode, employeeCode, isCustom, name, email ? email.trim().toLowerCase() : email, phone || null, department || null, designation || null,
      joiningDate || null, primaryRole, JSON.stringify(userRoles), hashed, profilePhotoUrl || null,
      jobStatus || 'Permanent', provisionalStartDate || null, provisionalEndDate || null, targetShiftId || null,
      attendanceMode || 'Office'
    ];

    const result = await client.query(insertQuery, insertParams);
    const createdUserId = result.rows[0].id;

    // Create initial employee profile
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    await client.query(`
      INSERT INTO employee_profiles (
        user_id, first_name, last_name, mother_name, father_name, reporting_manager
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        mother_name = COALESCE(EXCLUDED.mother_name, employee_profiles.mother_name),
        father_name = COALESCE(EXCLUDED.father_name, employee_profiles.father_name),
        reporting_manager = COALESCE(EXCLUDED.reporting_manager, employee_profiles.reporting_manager),
        updated_at = CURRENT_TIMESTAMP
    `, [createdUserId, firstName, lastName, motherName || null, fatherName || null, reportingManager || null]);

    // Record initial shift assignment
    if (targetShiftId) {
      await client.query(`
        INSERT INTO employee_shift_assignments (
          employee_id, shift_id, assignment_type, start_date, assigned_by, notes
        ) VALUES (
          $1, $2, 'PERMANENT', CURRENT_DATE, $3, 'Assigned upon employee creation'
        )
      `, [createdUserId, targetShiftId, req.user?.id || null]);
    }

    // Record audit log if a custom Employee ID was assigned
    if (isCustom) {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5::jsonb)
      `, [
        req.user?.id || null,
        'CUSTOM_EMPLOYEE_ID_ASSIGNED',
        'USER',
        createdUserId,
        JSON.stringify({
          employeeName: name,
          employeeId: employeeCode,
          createdBy: req.user?.name || `Admin #${req.user?.id || 'Unknown'}`,
          createdById: req.user?.id || null,
          createdAt: new Date().toISOString(),
          reason: customIdReason || 'Custom Employee ID assigned during employee creation'
        })
      ]);
    }

    await client.query('COMMIT');

    // Notify admins
    try {
      await NotificationService.notifyAdmins({
        title: 'New Employee Registration',
        message: `Employee ${name} (${result.rows[0].employeeId}) was registered in ${department || 'General'} [${jobStatus || 'Permanent'}].`,
        type: 'Employee',
        priority: 'Medium',
        actionUrl: '/employees',
      });
    } catch (notifErr) {
      console.warn('Create employee notification error:', notifErr);
    }

    res.json({ success: true, data: { id: result.rows[0].id, employeeId: result.rows[0].employeeId, profilePhotoUrl: result.rows[0].profilePhotoUrl, roles: result.rows[0].roles, role: result.rows[0].role, tempPassword: password ? 'User defined password' : tempPassword } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createEmployee error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create employee' } });
  } finally {
    client.release();
  }
};

export const editEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const parsed = editEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const { name, email, phone, department, designation, joiningDate, role, roles, profilePhotoUrl, jobStatus, provisionalStartDate, provisionalEndDate, shiftId, attendanceMode, motherName, fatherName, reportingManager } = parsed.data;

    // Safety check: Prevent logged-in admin from accidentally removing their own admin role
    if (req.user?.id === id) {
      if (roles !== undefined && !roles.map((r: string) => r.toLowerCase()).includes('admin')) {
        res.status(400).json({ success: false, error: { code: 'CANNOT_DEMOTE_SELF', message: 'You cannot remove the Administrator role from your own account.' } });
        return;
      }
      if (role !== undefined && role.toLowerCase() !== 'admin' && roles === undefined) {
        res.status(400).json({ success: false, error: { code: 'CANNOT_DEMOTE_SELF', message: 'You cannot remove the Administrator role from your own account.' } });
        return;
      }
    }

    if (email) {
      const emailLower = email.trim().toLowerCase();
      const existingEmail = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2', [emailLower, id]);
      if (existingEmail.rows.length > 0) {
        res.status(400).json({ success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: `Email "${email}" is already used by another employee.` } });
        return;
      }
    }

    let updateQuery = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [];

    const addField = (val: any, fieldName: string) => {
      if (val !== undefined) {
        params.push(val);
        updateQuery += `, ${fieldName} = $${params.length}`;
      }
    };

    addField(name, 'name');
    addField(email ? email.trim().toLowerCase() : undefined, 'email');
    addField(phone, 'phone');
    addField(department, 'department');
    addField(designation, 'designation');
    addField(joiningDate, 'joining_date');

    if (roles !== undefined && roles.length > 0) {
      const userRoles = Array.from(new Set(roles.map(r => r.toLowerCase())));
      const primaryRole = userRoles.includes('admin') ? 'admin' : 'employee';
      params.push(JSON.stringify(userRoles));
      updateQuery += `, roles = $${params.length}::jsonb`;
      params.push(primaryRole);
      updateQuery += `, role = $${params.length}`;
    } else if (role !== undefined) {
      const primaryRole = role.toLowerCase();
      addField(primaryRole, 'role');
      params.push(JSON.stringify([primaryRole]));
      updateQuery += `, roles = $${params.length}::jsonb`;
    }

    addField(jobStatus, 'job_status');
    addField(provisionalStartDate, 'provisional_start_date');
    addField(provisionalEndDate, 'provisional_end_date');
    if (attendanceMode !== undefined) {
      addField(attendanceMode, 'attendance_mode');
    }

    if (shiftId !== undefined) {
      addField(shiftId, 'shift_id');
      // If shift has changed, record assignment history & update profile employment info
      const currUser = await query('SELECT shift_id FROM users WHERE id = $1', [id]);
      if (currUser.rows.length > 0 && currUser.rows[0].shift_id !== shiftId) {
        await query(`
          INSERT INTO employee_shift_assignments (
            employee_id, shift_id, assignment_type, start_date, assigned_by, notes
          ) VALUES (
            $1, $2, 'PERMANENT', CURRENT_DATE, $3, 'Updated via employee edit'
          )
        `, [id, shiftId, req.user?.id || null]);
        
        const shiftRes = await query('SELECT name FROM shifts WHERE id = $1', [shiftId]);
        if (shiftRes.rows.length > 0) {
          await query(`
            UPDATE employee_profiles
            SET shift_assignment = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
          `, [shiftRes.rows[0].name, id]);
        }
      }
    }

    if (profilePhotoUrl !== undefined) {
      if (profilePhotoUrl === null || profilePhotoUrl === '') {
        const oldRes = await query(`SELECT profile_photo_url FROM users WHERE id = $1`, [id]);
        if (oldRes.rows.length > 0 && oldRes.rows[0].profile_photo_url) {
          await deleteProfilePhotoFile(oldRes.rows[0].profile_photo_url);
        }
        addField(null, 'profile_photo_url');
      } else {
        addField(profilePhotoUrl, 'profile_photo_url');
      }
    }

    const hasProfileUpdates = motherName !== undefined || fatherName !== undefined || reportingManager !== undefined;
    if (params.length === 0 && !hasProfileUpdates) {
      res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
      return;
    }

    if (params.length > 0) {
      params.push(id);
      updateQuery += ` WHERE id = $${params.length}`;
      await query(updateQuery, params);
    }

    if (hasProfileUpdates) {
      const epRes = await query('SELECT id FROM employee_profiles WHERE user_id = $1', [id]);
      if (epRes.rows.length === 0) {
        await query(`
          INSERT INTO employee_profiles (user_id, mother_name, father_name, reporting_manager)
          VALUES ($1, $2, $3, $4)
        `, [id, motherName || null, fatherName || null, reportingManager || null]);
      } else {
        const epSets = ['updated_at = CURRENT_TIMESTAMP'];
        const epParams = [];
        if (motherName !== undefined) {
          epParams.push(motherName || null);
          epSets.push(`mother_name = $${epParams.length}`);
        }
        if (fatherName !== undefined) {
          epParams.push(fatherName || null);
          epSets.push(`father_name = $${epParams.length}`);
        }
        if (reportingManager !== undefined) {
          epParams.push(reportingManager || null);
          epSets.push(`reporting_manager = $${epParams.length}`);
        }
        epParams.push(id);
        await query(`UPDATE employee_profiles SET ${epSets.join(', ')} WHERE user_id = $${epParams.length}`, epParams);
      }
    }

    // Notify employee that their profile was updated
    try {
      const adminLabel = req.user?.name
        ? `${req.user.name} (${req.user.employee_id})`
        : (req.user?.employee_id || 'an administrator');

      await NotificationService.notifyUser(id, {
        title: 'Profile Updated',
        message: `Your employee profile details were updated by admin ${adminLabel}.`,
        type: 'Profile',
        priority: 'Medium',
        actionUrl: '/profile',
        senderUserId: req.user?.id,
      });
    } catch (notifErr) {
      console.warn('Edit employee notification error:', notifErr);
    }

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    console.error('editEmployee error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update employee' } });
  }
};

export const uploadEmployeePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id ? parseInt(req.params.id as string) : null;
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No photo file provided' } });
      return;
    }

    const photoUrl = await processAndSaveProfilePhoto(req.file.buffer, id ? `emp-${id}` : 'avatar');

    if (id) {
      const userRes = await query(`SELECT profile_photo_url FROM users WHERE id = $1`, [id]);
      if (userRes.rows.length > 0 && userRes.rows[0].profile_photo_url) {
        await deleteProfilePhotoFile(userRes.rows[0].profile_photo_url);
      }
      await query(`UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [photoUrl, id]);
    }

    res.json({
      success: true,
      data: {
        url: photoUrl,
        profilePhotoUrl: photoUrl
      },
      message: 'Profile photo uploaded and processed successfully'
    });
  } catch (error: any) {
    console.error('uploadEmployeePhoto error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload photo' } });
  }
};

export const deleteEmployeePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const userRes = await query(`SELECT profile_photo_url FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const oldUrl = userRes.rows[0].profile_photo_url;
    if (oldUrl) {
      await deleteProfilePhotoFile(oldUrl);
    }

    await query(`UPDATE users SET profile_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Profile photo removed successfully' });
  } catch (error: any) {
    console.error('deleteEmployeePhoto error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to remove photo' } });
  }
};

export const updateEmployeeStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const status = req.body.status;
    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be active or inactive' } });
      return;
    }

    // Prevent deactivating yourself
    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Cannot deactivate yourself' } });
      return;
    }

    await query(`UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [status, id]);
    res.json({ success: true, message: `Employee marked as ${status}` });
  } catch (error) {
    console.error('updateEmployeeStatus error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update status' } });
  }
};

export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    
    // Check if user exists
    const userRes = await query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 10);

    await query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [hashed, id]);

    res.json({ success: true, data: { tempPassword }, message: 'Password reset successful' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reset password' } });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Cannot delete your own account' } });
      return;
    }

    const userRes = await query(`SELECT id, name, profile_photo_url FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const user = userRes.rows[0];

    // Clean up uploaded profile photo file if present
    if (user.profile_photo_url) {
      await deleteProfilePhotoFile(user.profile_photo_url);
    }

    // Completely delete employee (cascades to attendance, leaves, balances, notifications, tokens)
    await query(`DELETE FROM users WHERE id = $1`, [id]);

    res.json({ success: true, message: `Employee ${user.name} and all associated records have been completely deleted` });
  } catch (error: any) {
    console.error('deleteEmployee error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete employee' } });
  }
};

const updateJobStatusSchema = z.object({
  jobStatus: z.enum(['Provisional', 'Permanent']),
  provisionalStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).or(z.literal('')).nullable().optional(),
  provisionalEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).or(z.literal('')).nullable().optional(),
  reason: z.string().optional()
});

export const updateJobStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const parsed = updateJobStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const { jobStatus, provisionalStartDate, provisionalEndDate, reason } = parsed.data;

    const userRes = await query('SELECT id, name, email, employee_id, job_status, provisional_start_date, provisional_end_date FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Employee not found' } });
      return;
    }

    const currentUser = userRes.rows[0];

    if (jobStatus === 'Permanent') {
      await query(`
        UPDATE users 
        SET job_status = 'Permanent', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [id]);

      // Notify employee
      try {
        await NotificationService.notifyUser(id, {
          title: '🎉 Employment Confirmed',
          message: `Congratulations ${currentUser.name}! Your employment status has been officially updated to Permanent.`,
          type: 'Employee',
          priority: 'High',
          actionUrl: '/profile'
        });
      } catch (err) {
        console.warn('Notify employee job status error:', err);
      }

      res.json({ success: true, message: 'Employee successfully confirmed as Permanent' });
      return;
    } else {
      // Provisional status / extension
      const pStart = provisionalStartDate ? provisionalStartDate.substring(0, 10) : currentUser.provisional_start_date;
      const pEnd = provisionalEndDate ? provisionalEndDate.substring(0, 10) : currentUser.provisional_end_date;

      await query(`
        UPDATE users 
        SET job_status = 'Provisional', 
            provisional_start_date = COALESCE($1, provisional_start_date), 
            provisional_end_date = $2, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $3
      `, [pStart || null, pEnd || null, id]);

      // Notify employee of extension / update
      try {
        const dateNote = pEnd ? ` until ${pEnd}` : '';
        await NotificationService.notifyUser(id, {
          title: 'Job Status Updated',
          message: `Your provisional probation period has been updated${dateNote}.${reason ? ` Note: ${reason}` : ''}`,
          type: 'Employee',
          priority: 'Medium',
          actionUrl: '/profile'
        });
      } catch (err) {
        console.warn('Notify employee probation extension error:', err);
      }

      res.json({ success: true, message: 'Provisional period updated successfully' });
      return;
    }
  } catch (error) {
    console.error('updateJobStatus error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update job status' } });
  }
};

export const exportEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const department = req.query.department as string;
    const designation = req.query.designation as string;
    const status = req.query.status as string;
    const role = req.query.role as string;
    const jobStatus = req.query.jobStatus as string;

    let filterQuery = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (search) {
      queryParams.push(`%${search}%`);
      filterQuery += ` AND (name ILIKE $${queryParams.length} OR employee_id ILIKE $${queryParams.length} OR employee_code ILIKE $${queryParams.length} OR email ILIKE $${queryParams.length} OR department ILIKE $${queryParams.length} OR designation ILIKE $${queryParams.length})`;
    }
    if (department) {
      queryParams.push(department);
      filterQuery += ` AND department = $${queryParams.length}`;
    }
    if (designation && designation !== 'All') {
      queryParams.push(designation);
      filterQuery += ` AND designation = $${queryParams.length}`;
    }
    if (status && status !== 'All') {
      queryParams.push(status.toLowerCase());
      filterQuery += ` AND status = $${queryParams.length}`;
    }
    if (role && role !== 'All') {
      queryParams.push(role.toLowerCase());
      filterQuery += ` AND role = $${queryParams.length}`;
    }
    if (jobStatus && jobStatus !== 'All') {
      queryParams.push(jobStatus);
      filterQuery += ` AND job_status = $${queryParams.length}`;
    }

    const usersRes = await query(`
      SELECT employee_id as "employeeId", name, email, phone, department, 
             designation, role, status,
             COALESCE(job_status, 'Permanent') as "jobStatus",
             provisional_start_date as "provisionalStartDate",
             provisional_end_date as "provisionalEndDate",
             joining_date as "joiningDate", created_at as "createdAt"
      FROM users
      ${filterQuery}
      ORDER BY 
        CASE 
          WHEN employee_id ILIKE 'FISPL%' THEN 1 
          WHEN employee_id ILIKE 'ADMIN%' THEN 0 
          ELSE 2 
        END,
        NULLIF(substring(employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST,
        employee_id ASC
    `, queryParams);

    const format = req.query.format === 'excel' ? 'excel' : 'csv';

    if (format === 'excel') {
      const ExcelJS = require('exceljs');
      const { getCompanyLogoBuffer } = require('../utils/logoHelper');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Falcon Info Solutions';
      const sheet = workbook.addWorksheet('Employees Directory', {
        views: [{ showGridLines: true }]
      });

      // Rows 1 to 5: Brand Header with Company Logo
      sheet.getRow(1).height = 10;
      sheet.getRow(2).height = 26;
      sheet.getRow(3).height = 20;
      sheet.getRow(4).height = 18;
      sheet.getRow(5).height = 12;

      const logoBuffer = getCompanyLogoBuffer();
      if (logoBuffer) {
        try {
          const logoId = workbook.addImage({
            buffer: logoBuffer as any,
            extension: 'png'
          });
          sheet.addImage(logoId, {
            tl: { col: 0.15, row: 1.1 },
            ext: { width: 56, height: 56 }
          });
        } catch (e) {
          console.error('Logo add error in exportEmployees:', e);
        }
      }

      sheet.mergeCells('B2:L2');
      const titleCell = sheet.getCell('B2');
      titleCell.value = 'FALCON INFO SOLUTIONS';
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      sheet.mergeCells('B3:L3');
      const subCell = sheet.getCell('B3');
      subCell.value = 'Employee Master Directory & Workforce Registry';
      subCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF475569' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'left' };

      sheet.mergeCells('B4:L4');
      const metaCell = sheet.getCell('B4');
      const genDate = new Date().toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      metaCell.value = `Total Records: ${usersRes.rows.length}   |   Generated On: ${genDate}   |   Confidential HR Document`;
      metaCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'left' };

      // Row 6: Table Headers
      sheet.getRow(6).height = 28;
      const headers = [
        'Employee ID', 'Full Name', 'Email', 'Phone', 'Department',
        'Designation', 'Role', 'Account Status', 'Job Status',
        'Provisional Start', 'Provisional End', 'Joining Date'
      ];
      const colWidths = [16, 24, 28, 16, 20, 22, 14, 14, 16, 18, 18, 16];

      headers.forEach((h, idx) => {
        const cell = sheet.getRow(6).getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF3B82F6' } },
          right: { style: 'thin', color: { argb: 'FF3B82F6' } }
        };
      });

      colWidths.forEach((w, idx) => {
        sheet.getColumn(idx + 1).width = w;
      });

      let rowIdx = 7;
      for (const row of usersRes.rows) {
        const r = sheet.getRow(rowIdx);
        const isEven = (rowIdx % 2 === 0);
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        const rowValues = [
          row.employeeId || '',
          row.name || '',
          row.email || '',
          row.phone || '',
          row.department || '',
          row.designation || '',
          row.role || '',
          row.status || '',
          row.jobStatus || '',
          row.provisionalStartDate ? new Date(row.provisionalStartDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
          row.provisionalEndDate ? new Date(row.provisionalEndDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
          row.joiningDate ? new Date(row.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
        ];

        rowValues.forEach((val, cIdx) => {
          const cell = r.getCell(cIdx + 1);
          cell.value = val;
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (cIdx === 1) cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          if (cIdx === 0 || cIdx >= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });

        r.height = 22;
        rowIdx++;
      }

      sheet.autoFilter = { from: 'A6', to: 'L6' };
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 6, showGridLines: true }];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Falcon_Employees_${new Date().toISOString().substring(0, 10)}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    } else {
      const headers = ['Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Role', 'Account Status', 'Job Status', 'Provisional Start Date', 'Provisional End Date', 'Joining Date'];
      let csv = headers.map(h => `"${h}"`).join(',') + '\n';

      for (const r of usersRes.rows) {
        const jDate = r.joiningDate ? new Date(r.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
        const pStart = r.provisionalStartDate ? new Date(r.provisionalStartDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
        const pEnd = r.provisionalEndDate ? new Date(r.provisionalEndDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';

        const line = [
          r.employeeId || '',
          r.name || '',
          r.email || '',
          r.phone || '',
          r.department || '',
          r.designation || '',
          r.role || '',
          r.status || '',
          r.jobStatus || '',
          pStart,
          pEnd,
          jDate
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        csv += line + '\n';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Falcon_Employees_${new Date().toISOString().substring(0, 10)}.csv`);
      res.status(200).send(csv);
      return;
    }
  } catch (error) {
    console.error('exportEmployees error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to export employees' } });
  }
};

export const getAdminEmployeeProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }

    const unmask = req.query.unmask === 'true';
    const profile = await EmployeeProfileService.getFullProfile(targetUserId, unmask);

    if (!profile) {
      res.status(404).json({ success: false, error: { message: 'Employee not found' } });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error: any) {
    console.error('getAdminEmployeeProfile error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch employee profile' } });
  }
};

export const updateAdminEmployeeProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }

    const adminUserId = req.user!.id;
    const updatedProfile = await EmployeeProfileService.updateProfile(targetUserId, adminUserId, 'admin', req.body);

    res.json({
      success: true,
      message: 'Employee profile updated successfully',
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('updateAdminEmployeeProfile error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to update employee profile' } });
  }
};

export const adminUploadEmployeeDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No document file provided' } });
      return;
    }

    const documentType = (req.body.documentType || 'OTHER').toUpperCase();
    const documentTitle = req.body.documentTitle || req.file.originalname;

    const savedDoc = await DocumentService.saveDocumentRecord({
      userId: targetUserId,
      documentType,
      documentTitle,
      file: req.file,
      uploadedBy: req.user!.id
    });

    res.json({
      success: true,
      data: savedDoc,
      message: 'Document uploaded successfully'
    });
  } catch (error: any) {
    console.error('adminUploadEmployeeDocument error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload document' } });
  }
};

export const adminDeleteEmployeeDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    const docId = parseInt(req.params.docId as string);

    if (isNaN(targetUserId) || isNaN(docId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID or document ID' } });
      return;
    }

    await DocumentService.deleteDocument(docId, targetUserId, req.user!.id, true);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    console.error('adminDeleteEmployeeDocument error:', error);
    if (error.message === 'DOCUMENT_NOT_FOUND') {
      res.status(404).json({ success: false, error: { message: 'Document not found' } });
      return;
    }
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to delete document' } });
  }
};

export const adminGetEmployeeProfileActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }

    const activities = await EmployeeProfileService.getProfileActivityLogs(targetUserId, 100);
    res.json({ success: true, data: activities });
  } catch (error: any) {
    console.error('adminGetEmployeeProfileActivity error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch profile activities' } });
  }
};

export const getDesignations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT DISTINCT designation 
      FROM users 
      WHERE designation IS NOT NULL AND TRIM(designation) != ''
      ORDER BY designation ASC
    `);
    const designations = result.rows.map(r => r.designation);
    res.json({ success: true, data: designations });
  } catch (error) {
    console.error('getDesignations error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch designations' } });
  }
};


