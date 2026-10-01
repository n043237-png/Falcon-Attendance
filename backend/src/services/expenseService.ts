import { query } from '../db';
import { NotificationService } from './notificationService';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { getCompanyLogoPath } from '../utils/logoHelper';

export const EXPENSE_CATEGORIES = [
  'Travel',
  'Fuel',
  'Hotel',
  'Food',
  'Toll',
  'Parking',
  'Equipment',
  'Printing',
  'Courier',
  'Miscellaneous'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const ADVANCE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'] as const;
export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED'] as const;

export class ExpenseService {
  // =========================================================================
  // ADVANCE REQUESTS
  // =========================================================================

  /**
   * Create a new project advance request
   */
  static async createAdvance(
    employeeId: number,
    data: {
      projectName: string;
      clientName?: string;
      purpose: string;
      amountRequested: number;
      requiredDate: string;
      employeeRemarks?: string;
    }
  ) {
    if (data.amountRequested <= 0) {
      throw new Error('Amount requested must be greater than zero');
    }

    const res = await query(
      `
      INSERT INTO project_advance_requests (
        employee_id, project_name, client_name, purpose, amount_requested, required_date, employee_remarks, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      RETURNING *
    `,
      [
        employeeId,
        data.projectName.trim(),
        data.clientName?.trim() || null,
        data.purpose.trim(),
        data.amountRequested,
        data.requiredDate,
        data.employeeRemarks?.trim() || null
      ]
    );

    const advance = res.rows[0];

    // Fetch employee name
    const empRes = await query('SELECT name FROM users WHERE id = $1', [employeeId]);
    const empName = empRes.rows[0]?.name || 'Employee';

    // 1. Notify Admins
    try {
      await NotificationService.send({
        role: 'admin',
        title: 'New Project Advance Request',
        message: `${empName} requested an advance of ₹${Number(data.amountRequested).toLocaleString('en-IN')} for project "${data.projectName}".`,
        type: 'Expense',
        priority: 'High',
        actionUrl: '/expenses?tab=advances'
      });
    } catch (e) {
      console.warn('Failed to dispatch admin notification:', e);
    }

    // 2. Notify Employee
    try {
      await NotificationService.send({
        recipientUserId: employeeId,
        title: 'Advance Request Submitted',
        message: `Your advance request of ₹${Number(data.amountRequested).toLocaleString('en-IN')} for project "${data.projectName}" has been submitted for approval.`,
        type: 'Expense',
        priority: 'Medium',
        actionUrl: '/my-expenses?tab=advances'
      });
    } catch (e) {
      console.warn('Failed to dispatch employee notification:', e);
    }

    return advance;
  }

  /**
   * Get advance requests with filtering
   */
  static async getAdvances(filters: {
    employeeId?: number;
    status?: string;
    projectName?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    let sql = `
      SELECT 
        a.*,
        u.name as employee_name,
        u.employee_id as employee_code,
        u.department as employee_department,
        appr.name as approved_by_name,
        paid.name as paid_by_name
      FROM project_advance_requests a
      JOIN users u ON a.employee_id = u.id
      LEFT JOIN users appr ON a.approved_by = appr.id
      LEFT JOIN users paid ON a.paid_by = paid.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND a.employee_id = $${params.length}`;
    }

    if (filters.status && filters.status !== 'All') {
      params.push(filters.status.toUpperCase());
      sql += ` AND a.status = $${params.length}`;
    }

    if (filters.projectName && filters.projectName !== 'All') {
      params.push(filters.projectName);
      sql += ` AND a.project_name = $${params.length}`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      sql += ` AND a.required_date >= $${params.length}::date`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      sql += ` AND a.required_date <= $${params.length}::date`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR a.project_name ILIKE $${params.length} OR a.purpose ILIKE $${params.length} OR COALESCE(a.client_name, '') ILIKE $${params.length})`;
    }

    sql += ` ORDER BY a.created_at DESC`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get single advance request by ID
   */
  static async getAdvanceById(id: number) {
    const res = await query(
      `
      SELECT 
        a.*,
        u.name as employee_name,
        u.employee_id as employee_code,
        u.department as employee_department,
        appr.name as approved_by_name,
        paid.name as paid_by_name
      FROM project_advance_requests a
      JOIN users u ON a.employee_id = u.id
      LEFT JOIN users appr ON a.approved_by = appr.id
      LEFT JOIN users paid ON a.paid_by = paid.id
      WHERE a.id = $1
    `,
      [id]
    );

    return res.rows[0] || null;
  }

  /**
   * Update advance status (Approve, Reject, or Mark as Paid)
   */
  static async updateAdvanceStatus(
    id: number,
    adminId: number,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
    adminRemarks?: string,
    paymentReference?: string
  ) {
    const existing = await this.getAdvanceById(id);
    if (!existing) {
      throw new Error(`Advance request with ID ${id} not found`);
    }

    let updateFields = `status = $1, admin_remarks = COALESCE($2, admin_remarks), updated_at = CURRENT_TIMESTAMP`;
    const params: any[] = [status, adminRemarks || null, id];

    if (status === 'APPROVED') {
      updateFields += `, approved_by = $4, approved_at = CURRENT_TIMESTAMP`;
      params.push(adminId);
    } else if (status === 'REJECTED') {
      updateFields += `, approved_by = $4, approved_at = CURRENT_TIMESTAMP`;
      params.push(adminId);
    } else if (status === 'PAID') {
      updateFields += `, paid_by = $4, paid_at = CURRENT_TIMESTAMP, payment_reference = COALESCE($5, payment_reference)`;
      params.push(adminId, paymentReference || null);
    }

    const res = await query(
      `
      UPDATE project_advance_requests
      SET ${updateFields}
      WHERE id = $3
      RETURNING *
    `,
      params
    );

    const updated = res.rows[0];

    // Send Notification to Employee
    try {
      let notifTitle = 'Advance Request Update';
      let notifMessage = '';

      if (status === 'APPROVED') {
        notifTitle = 'Advance Request Approved';
        notifMessage = `Your advance request of ₹${Number(existing.amount_requested).toLocaleString('en-IN')} for project "${existing.project_name}" has been approved.`;
      } else if (status === 'REJECTED') {
        notifTitle = 'Advance Request Rejected';
        notifMessage = `Your advance request for project "${existing.project_name}" was rejected.${adminRemarks ? ` Reason: ${adminRemarks}` : ''}`;
      } else if (status === 'PAID') {
        notifTitle = 'Advance Payment Disbursed';
        notifMessage = `Your advance of ₹${Number(existing.amount_requested).toLocaleString('en-IN')} for project "${existing.project_name}" has been disbursed.${paymentReference ? ` Ref: ${paymentReference}` : ''}`;
      }

      await NotificationService.send({
        recipientUserId: existing.employee_id,
        title: notifTitle,
        message: notifMessage,
        type: 'Expense',
        priority: status === 'REJECTED' ? 'High' : 'Medium',
        actionUrl: '/my-expenses?tab=advances'
      });
    } catch (e) {
      console.warn('Failed to notify employee of advance update:', e);
    }

    return updated;
  }

  /**
   * Cancel pending advance request
   */
  static async cancelAdvance(id: number, employeeId: number) {
    const existing = await this.getAdvanceById(id);
    if (!existing) {
      throw new Error(`Advance request not found`);
    }
    if (existing.employee_id !== employeeId) {
      throw new Error('You do not have permission to cancel this advance request');
    }
    if (existing.status !== 'PENDING') {
      throw new Error(`Cannot cancel advance request with status "${existing.status}"`);
    }

    const res = await query(
      `UPDATE project_advance_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0];
  }

  // =========================================================================
  // EXPENSE REQUESTS
  // =========================================================================

  /**
   * Create a new project expense claim with receipts
   */
  static async createExpense(
    employeeId: number,
    data: {
      projectName: string;
      clientName?: string;
      expenseCategory: string;
      expenseDate: string;
      amount: number;
      description: string;
      paymentMethod?: string;
      employeeRemarks?: string;
      advanceId?: number | null;
    },
    files?: Express.Multer.File[]
  ) {
    if (data.amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    let primaryReceiptUrl: string | null = null;
    if (files && files.length > 0) {
      primaryReceiptUrl = `/uploads/expenses/${files[0].filename}`;
    }

    const res = await query(
      `
      INSERT INTO project_expense_requests (
        employee_id, advance_id, project_name, client_name, expense_category, expense_date, amount,
        description, payment_method, employee_remarks, receipt_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
      RETURNING *
    `,
      [
        employeeId,
        data.advanceId || null,
        data.projectName.trim(),
        data.clientName?.trim() || null,
        data.expenseCategory.trim(),
        data.expenseDate,
        data.amount,
        data.description.trim(),
        data.paymentMethod || 'Cash',
        data.employeeRemarks?.trim() || null,
        primaryReceiptUrl
      ]
    );

    const expense = res.rows[0];

    // Insert supporting documents
    if (files && files.length > 0) {
      for (const file of files) {
        const fileUrl = `/uploads/expenses/${file.filename}`;
        await query(
          `
          INSERT INTO project_expense_documents (
            expense_id, file_name, file_url, file_type, mime_type, file_size
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [
            expense.id,
            file.originalname,
            fileUrl,
            getDocTypeFromFilename(file.originalname),
            file.mimetype,
            file.size
          ]
        );
      }
    }

    // Fetch employee name
    const empRes = await query('SELECT name FROM users WHERE id = $1', [employeeId]);
    const empName = empRes.rows[0]?.name || 'Employee';

    // 1. Notify Admins
    try {
      await NotificationService.send({
        role: 'admin',
        title: 'New Project Expense Claim',
        message: `${empName} submitted a ₹${Number(data.amount).toLocaleString('en-IN')} claim for ${data.expenseCategory} on project "${data.projectName}".`,
        type: 'Expense',
        priority: 'High',
        actionUrl: '/expenses?tab=expenses'
      });
    } catch (e) {
      console.warn('Failed to dispatch admin notification:', e);
    }

    // 2. Notify Employee
    try {
      await NotificationService.send({
        recipientUserId: employeeId,
        title: 'Expense Claim Submitted',
        message: `Your ${data.expenseCategory} claim of ₹${Number(data.amount).toLocaleString('en-IN')} for project "${data.projectName}" has been submitted for approval.`,
        type: 'Expense',
        priority: 'Medium',
        actionUrl: '/my-expenses?tab=expenses'
      });
    } catch (e) {
      console.warn('Failed to dispatch employee notification:', e);
    }

    return this.getExpenseById(expense.id);
  }

  /**
   * Get expense requests with filtering & documents
   */
  static async getExpenses(filters: {
    employeeId?: number;
    status?: string;
    category?: string;
    projectName?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    let sql = `
      SELECT 
        e.*,
        u.name as employee_name,
        u.employee_id as employee_code,
        u.department as employee_department,
        appr.name as approved_by_name,
        reimb.name as reimbursed_by_name,
        adv.purpose as advance_purpose,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', d.id,
              'fileName', d.file_name,
              'fileUrl', d.file_url,
              'fileType', d.file_type,
              'mimeType', d.mime_type,
              'fileSize', d.file_size
            ))
            FROM project_expense_documents d
            WHERE d.expense_id = e.id
          ),
          '[]'::json
        ) as documents
      FROM project_expense_requests e
      JOIN users u ON e.employee_id = u.id
      LEFT JOIN users appr ON e.approved_by = appr.id
      LEFT JOIN users reimb ON e.reimbursed_by = reimb.id
      LEFT JOIN project_advance_requests adv ON e.advance_id = adv.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND e.employee_id = $${params.length}`;
    }

    if (filters.status && filters.status !== 'All') {
      params.push(filters.status.toUpperCase());
      sql += ` AND e.status = $${params.length}`;
    }

    if (filters.category && filters.category !== 'All') {
      params.push(filters.category);
      sql += ` AND e.expense_category = $${params.length}`;
    }

    if (filters.projectName && filters.projectName !== 'All') {
      params.push(filters.projectName);
      sql += ` AND e.project_name = $${params.length}`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      sql += ` AND e.expense_date >= $${params.length}::date`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      sql += ` AND e.expense_date <= $${params.length}::date`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR e.project_name ILIKE $${params.length} OR e.description ILIKE $${params.length} OR COALESCE(e.client_name, '') ILIKE $${params.length})`;
    }

    sql += ` ORDER BY e.created_at DESC`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get single expense request by ID with documents
   */
  static async getExpenseById(id: number) {
    const res = await query(
      `
      SELECT 
        e.*,
        u.name as employee_name,
        u.employee_id as employee_code,
        u.department as employee_department,
        appr.name as approved_by_name,
        reimb.name as reimbursed_by_name,
        adv.purpose as advance_purpose,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', d.id,
              'fileName', d.file_name,
              'fileUrl', d.file_url,
              'fileType', d.file_type,
              'mimeType', d.mime_type,
              'fileSize', d.file_size
            ))
            FROM project_expense_documents d
            WHERE d.expense_id = e.id
          ),
          '[]'::json
        ) as documents
      FROM project_expense_requests e
      JOIN users u ON e.employee_id = u.id
      LEFT JOIN users appr ON e.approved_by = appr.id
      LEFT JOIN users reimb ON e.reimbursed_by = reimb.id
      LEFT JOIN project_advance_requests adv ON e.advance_id = adv.id
      WHERE e.id = $1
    `,
      [id]
    );

    return res.rows[0] || null;
  }

  /**
   * Update expense claim status (Approve, Reject, or Mark as Reimbursed)
   */
  static async updateExpenseStatus(
    id: number,
    adminId: number,
    status: 'APPROVED' | 'REJECTED' | 'REIMBURSED',
    adminRemarks?: string,
    reimbursementReference?: string
  ) {
    const existing = await this.getExpenseById(id);
    if (!existing) {
      throw new Error(`Expense claim with ID ${id} not found`);
    }

    let updateFields = `status = $1, admin_remarks = COALESCE($2, admin_remarks), updated_at = CURRENT_TIMESTAMP`;
    const params: any[] = [status, adminRemarks || null, id];

    if (status === 'APPROVED') {
      updateFields += `, approved_by = $4, approved_at = CURRENT_TIMESTAMP`;
      params.push(adminId);
    } else if (status === 'REJECTED') {
      updateFields += `, approved_by = $4, approved_at = CURRENT_TIMESTAMP`;
      params.push(adminId);
    } else if (status === 'REIMBURSED') {
      updateFields += `, reimbursed_by = $4, reimbursed_at = CURRENT_TIMESTAMP, reimbursement_reference = COALESCE($5, reimbursement_reference)`;
      params.push(adminId, reimbursementReference || null);
    }

    const res = await query(
      `
      UPDATE project_expense_requests
      SET ${updateFields}
      WHERE id = $3
      RETURNING *
    `,
      params
    );

    const updated = res.rows[0];

    // Send Notification to Employee
    try {
      let notifTitle = 'Expense Claim Update';
      let notifMessage = '';

      if (status === 'APPROVED') {
        notifTitle = 'Expense Claim Approved';
        notifMessage = `Your ${existing.expense_category} claim of ₹${Number(existing.amount).toLocaleString('en-IN')} for project "${existing.project_name}" has been approved.`;
      } else if (status === 'REJECTED') {
        notifTitle = 'Expense Claim Rejected';
        notifMessage = `Your ${existing.expense_category} claim for project "${existing.project_name}" was rejected.${adminRemarks ? ` Reason: ${adminRemarks}` : ''}`;
      } else if (status === 'REIMBURSED') {
        notifTitle = 'Reimbursement Processed';
        notifMessage = `Your reimbursement of ₹${Number(existing.amount).toLocaleString('en-IN')} for project "${existing.project_name}" has been processed.${reimbursementReference ? ` Ref: ${reimbursementReference}` : ''}`;
      }

      await NotificationService.send({
        recipientUserId: existing.employee_id,
        title: notifTitle,
        message: notifMessage,
        type: 'Expense',
        priority: status === 'REJECTED' ? 'High' : 'Medium',
        actionUrl: '/my-expenses?tab=expenses'
      });
    } catch (e) {
      console.warn('Failed to notify employee of expense update:', e);
    }

    return this.getExpenseById(id);
  }

  /**
   * Cancel pending expense claim
   */
  static async cancelExpense(id: number, employeeId: number) {
    const existing = await this.getExpenseById(id);
    if (!existing) {
      throw new Error(`Expense claim not found`);
    }
    if (existing.employee_id !== employeeId) {
      throw new Error('You do not have permission to cancel this expense claim');
    }
    if (existing.status !== 'PENDING') {
      throw new Error(`Cannot cancel expense claim with status "${existing.status}"`);
    }

    const res = await query(
      `UPDATE project_expense_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0];
  }

  /**
   * Upload additional supporting document to an existing expense
   */
  static async addExpenseDocument(expenseId: number, file: Express.Multer.File) {
    const fileUrl = `/uploads/expenses/${file.filename}`;
    const fileType = getDocTypeFromFilename(file.originalname);

    const res = await query(
      `
      INSERT INTO project_expense_documents (
        expense_id, file_name, file_url, file_type, mime_type, file_size
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [expenseId, file.originalname, fileUrl, fileType, file.mimetype, file.size]
    );

    return res.rows[0];
  }

  // =========================================================================
  // METRICS & SUMMARY
  // =========================================================================

  /**
   * Get overview statistics (Advances, Expenses, Totals, Statuses)
   */
  static async getOverviewMetrics(employeeId?: number) {
    const whereEmp = employeeId ? 'WHERE employee_id = $1' : '';
    const params = employeeId ? [employeeId] : [];

    const advRes = await query(
      `
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
        COUNT(*) FILTER (WHERE status = 'PAID') as paid_count,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
        COALESCE(SUM(amount_requested), 0) as total_amount,
        COALESCE(SUM(amount_requested) FILTER (WHERE status = 'PENDING'), 0) as pending_amount,
        COALESCE(SUM(amount_requested) FILTER (WHERE status = 'PAID'), 0) as paid_amount
      FROM project_advance_requests
      ${whereEmp}
    `,
      params
    );

    const expRes = await query(
      `
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
        COUNT(*) FILTER (WHERE status = 'REIMBURSED') as reimbursed_count,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0) as pending_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'REIMBURSED'), 0) as reimbursed_amount
      FROM project_expense_requests
      ${whereEmp}
    `,
      params
    );

    const catRes = await query(
      `
      SELECT expense_category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM project_expense_requests
      ${whereEmp}
      GROUP BY expense_category
      ORDER BY total DESC
    `,
      params
    );

    return {
      advances: {
        totalCount: parseInt(advRes.rows[0].total_count, 10),
        pendingCount: parseInt(advRes.rows[0].pending_count, 10),
        approvedCount: parseInt(advRes.rows[0].approved_count, 10),
        paidCount: parseInt(advRes.rows[0].paid_count, 10),
        rejectedCount: parseInt(advRes.rows[0].rejected_count, 10),
        totalAmount: parseFloat(advRes.rows[0].total_amount),
        pendingAmount: parseFloat(advRes.rows[0].pending_amount),
        paidAmount: parseFloat(advRes.rows[0].paid_amount)
      },
      expenses: {
        totalCount: parseInt(expRes.rows[0].total_count, 10),
        pendingCount: parseInt(expRes.rows[0].pending_count, 10),
        approvedCount: parseInt(expRes.rows[0].approved_count, 10),
        reimbursedCount: parseInt(expRes.rows[0].reimbursed_count, 10),
        rejectedCount: parseInt(expRes.rows[0].rejected_count, 10),
        totalAmount: parseFloat(expRes.rows[0].total_amount),
        pendingAmount: parseFloat(expRes.rows[0].pending_amount),
        reimbursedAmount: parseFloat(expRes.rows[0].reimbursed_amount)
      },
      categories: catRes.rows.map((r) => ({
        category: r.expense_category,
        count: parseInt(r.count, 10),
        amount: parseFloat(r.total)
      }))
    };
  }

  // =========================================================================
  // EXCEL REPORT GENERATION
  // =========================================================================

  /**
   * Generates a styled Excel workbook with Advances and Expenses sheets
   */
  static async generateExcelReport(filters: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Falcon Info Solutions';
    workbook.created = new Date();

    const advances = await this.getAdvances(filters);
    const expenses = await this.getExpenses(filters);

    // 1. Advances Sheet
    const advSheet = workbook.addWorksheet('Project Advances');
    advSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Employee Name', key: 'employee_name', width: 22 },
      { header: 'Emp Code', key: 'employee_code', width: 14 },
      { header: 'Project Name', key: 'project_name', width: 25 },
      { header: 'Client', key: 'client_name', width: 20 },
      { header: 'Purpose', key: 'purpose', width: 30 },
      { header: 'Amount (₹)', key: 'amount_requested', width: 15 },
      { header: 'Required Date', key: 'required_date', width: 15 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Approved By', key: 'approved_by_name', width: 20 },
      { header: 'Payment Ref', key: 'payment_reference', width: 18 },
      { header: 'Remarks', key: 'admin_remarks', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 }
    ];

    // Style header row
    advSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    advSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

    advances.forEach((adv) => {
      advSheet.addRow({
        id: adv.id,
        employee_name: adv.employee_name,
        employee_code: adv.employee_code,
        project_name: adv.project_name,
        client_name: adv.client_name || '-',
        purpose: adv.purpose,
        amount_requested: parseFloat(adv.amount_requested),
        required_date: new Date(adv.required_date).toLocaleDateString('en-GB'),
        status: adv.status,
        approved_by_name: adv.approved_by_name || '-',
        payment_reference: adv.payment_reference || '-',
        admin_remarks: adv.admin_remarks || adv.employee_remarks || '-',
        created_at: new Date(adv.created_at).toLocaleDateString('en-GB')
      });
    });

    // 2. Expenses Sheet
    const expSheet = workbook.addWorksheet('Project Expenses');
    expSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Employee Name', key: 'employee_name', width: 22 },
      { header: 'Emp Code', key: 'employee_code', width: 14 },
      { header: 'Project Name', key: 'project_name', width: 25 },
      { header: 'Client', key: 'client_name', width: 20 },
      { header: 'Category', key: 'expense_category', width: 16 },
      { header: 'Expense Date', key: 'expense_date', width: 15 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 16 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Approved By', key: 'approved_by_name', width: 20 },
      { header: 'Reimbursement Ref', key: 'reimbursement_reference', width: 20 },
      { header: 'Remarks', key: 'admin_remarks', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 }
    ];

    expSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    expSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };

    expenses.forEach((exp) => {
      expSheet.addRow({
        id: exp.id,
        employee_name: exp.employee_name,
        employee_code: exp.employee_code,
        project_name: exp.project_name,
        client_name: exp.client_name || '-',
        expense_category: exp.expense_category,
        expense_date: new Date(exp.expense_date).toLocaleDateString('en-GB'),
        amount: parseFloat(exp.amount),
        payment_method: exp.payment_method,
        description: exp.description,
        status: exp.status,
        approved_by_name: exp.approved_by_name || '-',
        reimbursement_reference: exp.reimbursement_reference || '-',
        admin_remarks: exp.admin_remarks || exp.employee_remarks || '-',
        created_at: new Date(exp.created_at).toLocaleDateString('en-GB')
      });
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  // =========================================================================
  // PDF REPORT GENERATION
  // =========================================================================

  /**
   * Generates a corporate styled PDF report summarizing Advances and Expenses
   */
  static async generatePdfReport(filters: any): Promise<Buffer> {
    const advances = await this.getAdvances(filters);
    const expenses = await this.getExpenses(filters);
    const metrics = await this.getOverviewMetrics(filters.employeeId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const logoPath = getCompanyLogoPath();
      if (logoPath && fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 36, 36, { width: 36, height: 36 });
        } catch {}
      }

      // Title & Header
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text('FALCON INFO SOLUTIONS PVT. LTD.', 82, 38);
      doc.fontSize(10).font('Helvetica').fillColor('#64748B').text('Project Expense & Advance Request Report', 82, 56);
      doc.fontSize(8).fillColor('#94A3B8').text(`Generated: ${new Date().toLocaleString('en-IN')}`, 82, 70);

      doc.moveTo(36, 88).lineTo(559, 88).lineWidth(1).strokeColor('#E2E8F0').stroke();

      // Summary KPIs
      let y = 100;
      doc.rect(36, y, 523, 50).fill('#F8FAFC');
      doc.rect(36, y, 523, 50).stroke('#E2E8F0');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E3A8A').text('TOTAL ADVANCES', 46, y + 8);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text(`₹${metrics.advances.totalAmount.toLocaleString('en-IN')}`, 46, y + 22);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(`Paid: ₹${metrics.advances.paidAmount.toLocaleString('en-IN')}`, 46, y + 36);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#15803D').text('TOTAL EXPENSES', 220, y + 8);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text(`₹${metrics.expenses.totalAmount.toLocaleString('en-IN')}`, 220, y + 22);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(`Reimbursed: ₹${metrics.expenses.reimbursedAmount.toLocaleString('en-IN')}`, 220, y + 36);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#D97706').text('PENDING APPROVALS', 390, y + 8);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text(`${metrics.advances.pendingCount + metrics.expenses.pendingCount} Requests`, 390, y + 22);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(`₹${(metrics.advances.pendingAmount + metrics.expenses.pendingAmount).toLocaleString('en-IN')} pending`, 390, y + 36);

      // Advances Table Header
      y = 165;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('Project Advances Overview', 36, y);
      y += 18;

      doc.rect(36, y, 523, 20).fill('#1E3A8A');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('Date', 42, y + 6);
      doc.text('Employee', 95, y + 6);
      doc.text('Project', 190, y + 6);
      doc.text('Purpose', 290, y + 6);
      doc.text('Amount (₹)', 410, y + 6);
      doc.text('Status', 485, y + 6);
      y += 20;

      advances.slice(0, 15).forEach((adv, idx) => {
        if (y > 750) {
          doc.addPage();
          y = 36;
        }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, y, 523, 18).fill(rowBg);
        doc.fontSize(7.5).font('Helvetica').fillColor('#0F172A');
        doc.text(new Date(adv.required_date).toLocaleDateString('en-GB'), 42, y + 5);
        doc.text(adv.employee_name.substring(0, 16), 95, y + 5);
        doc.text(adv.project_name.substring(0, 18), 190, y + 5);
        doc.text(adv.purpose.substring(0, 22), 290, y + 5);
        doc.text(`₹${parseFloat(adv.amount_requested).toLocaleString('en-IN')}`, 410, y + 5);
        doc.font('Helvetica-Bold').fillColor(getStatusColor(adv.status)).text(adv.status, 485, y + 5);
        y += 18;
      });

      // Expenses Table Header
      y += 15;
      if (y > 680) {
        doc.addPage();
        y = 36;
      }
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('Project Expenses Overview', 36, y);
      y += 18;

      doc.rect(36, y, 523, 20).fill('#16A34A');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('Date', 42, y + 6);
      doc.text('Employee', 95, y + 6);
      doc.text('Project', 190, y + 6);
      doc.text('Category', 290, y + 6);
      doc.text('Amount (₹)', 410, y + 6);
      doc.text('Status', 485, y + 6);
      y += 20;

      expenses.slice(0, 20).forEach((exp, idx) => {
        if (y > 750) {
          doc.addPage();
          y = 36;
        }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, y, 523, 18).fill(rowBg);
        doc.fontSize(7.5).font('Helvetica').fillColor('#0F172A');
        doc.text(new Date(exp.expense_date).toLocaleDateString('en-GB'), 42, y + 5);
        doc.text(exp.employee_name.substring(0, 16), 95, y + 5);
        doc.text(exp.project_name.substring(0, 18), 190, y + 5);
        doc.text(exp.expense_category, 290, y + 5);
        doc.text(`₹${parseFloat(exp.amount).toLocaleString('en-IN')}`, 410, y + 5);
        doc.font('Helvetica-Bold').fillColor(getStatusColor(exp.status)).text(exp.status, 485, y + 5);
        y += 18;
      });

      // Footer
      doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8').text('Falcon Info Solutions Pvt. Ltd. • Confidential Corporate Document', 36, 800, { align: 'center', width: 523 });

      doc.end();
    });
  }
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'REIMBURSED':
    case 'PAID':
      return '#16A34A';
    case 'REJECTED':
      return '#DC2626';
    case 'CANCELLED':
      return '#64748B';
    default:
      return '#D97706';
  }
}

function getDocTypeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('invoice')) return 'INVOICE';
  if (lower.includes('hotel')) return 'HOTEL_BILL';
  if (lower.includes('fuel')) return 'FUEL_BILL';
  if (lower.includes('toll')) return 'TOLL_RECEIPT';
  return 'RECEIPT';
}
