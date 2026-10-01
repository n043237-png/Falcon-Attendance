import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { ExpenseService, EXPENSE_CATEGORIES } from '../services/expenseService';
import { query } from '../db';

// =========================================================================
// EMPLOYEE CONTROLLER HANDLERS
// =========================================================================

export const createAdvanceHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const { projectName, clientName, purpose, amountRequested, requiredDate, employeeRemarks } = req.body;

    if (!projectName || !purpose || !amountRequested || !requiredDate) {
      res.status(400).json({
        success: false,
        error: { message: 'Project name, purpose, amount requested, and required date are required.' }
      });
      return;
    }

    const advance = await ExpenseService.createAdvance(employeeId, {
      projectName,
      clientName,
      purpose,
      amountRequested: parseFloat(amountRequested),
      requiredDate,
      employeeRemarks
    });

    res.status(201).json({
      success: true,
      message: 'Advance request submitted successfully.',
      data: advance
    });
  } catch (error: any) {
    console.error('createAdvanceHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to submit advance request.' } });
  }
};

export const getMyAdvancesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const advances = await ExpenseService.getAdvances({
      employeeId,
      status,
      search
    });

    res.json({ success: true, count: advances.length, data: advances });
  } catch (error: any) {
    console.error('getMyAdvancesHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load advances.' } });
  }
};

export const cancelMyAdvanceHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const id = parseInt(req.params.id as string, 10);

    const cancelled = await ExpenseService.cancelAdvance(id, employeeId);
    res.json({ success: true, message: 'Advance request cancelled successfully.', data: cancelled });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to cancel advance request.' } });
  }
};

export const createExpenseHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const {
      projectName,
      clientName,
      expenseCategory,
      expenseDate,
      amount,
      description,
      paymentMethod,
      employeeRemarks,
      advanceId
    } = req.body;

    if (!projectName || !expenseCategory || !expenseDate || !amount || !description) {
      res.status(400).json({
        success: false,
        error: { message: 'Project name, expense category, date, amount, and description are required.' }
      });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;

    const expense = await ExpenseService.createExpense(
      employeeId,
      {
        projectName,
        clientName,
        expenseCategory,
        expenseDate,
        amount: parseFloat(amount),
        description,
        paymentMethod,
        employeeRemarks,
        advanceId: advanceId ? parseInt(advanceId, 10) : undefined
      },
      files
    );

    res.status(201).json({
      success: true,
      message: 'Expense claim submitted successfully.',
      data: expense
    });
  } catch (error: any) {
    console.error('createExpenseHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to submit expense claim.' } });
  }
};

export const getMyExpensesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const expenses = await ExpenseService.getExpenses({
      employeeId,
      status,
      category,
      search
    });

    res.json({ success: true, count: expenses.length, data: expenses });
  } catch (error: any) {
    console.error('getMyExpensesHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load expenses.' } });
  }
};

export const cancelMyExpenseHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const id = parseInt(req.params.id as string, 10);

    const cancelled = await ExpenseService.cancelExpense(id, employeeId);
    res.json({ success: true, message: 'Expense claim cancelled successfully.', data: cancelled });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to cancel expense claim.' } });
  }
};

export const uploadExpenseDocumentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: { message: 'No file uploaded.' } });
      return;
    }

    const doc = await ExpenseService.addExpenseDocument(id, file);
    res.status(201).json({ success: true, message: 'Supporting receipt uploaded successfully.', data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload document.' } });
  }
};

export const getMyMetricsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const metrics = await ExpenseService.getOverviewMetrics(employeeId);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load metrics.' } });
  }
};

// =========================================================================
// ADMIN CONTROLLER HANDLERS
// =========================================================================

export const getAllAdvancesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const projectName = req.query.projectName as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;

    const advances = await ExpenseService.getAdvances({
      employeeId,
      status,
      projectName,
      startDate,
      endDate,
      search
    });

    res.json({ success: true, count: advances.length, data: advances });
  } catch (error: any) {
    console.error('getAllAdvancesHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load advances.' } });
  }
};

export const updateAdvanceStatusHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user!.id;
    const id = parseInt(req.params.id as string, 10);
    const { status, adminRemarks, paymentReference } = req.body;

    if (!status || !['APPROVED', 'REJECTED', 'PAID'].includes(status)) {
      res.status(400).json({ success: false, error: { message: 'Invalid status. Allowed: APPROVED, REJECTED, PAID.' } });
      return;
    }

    const updated = await ExpenseService.updateAdvanceStatus(id, adminId, status, adminRemarks, paymentReference);
    res.json({ success: true, message: `Advance request marked as ${status}.`, data: updated });
  } catch (error: any) {
    console.error('updateAdvanceStatusHandler error:', error);
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to update advance status.' } });
  }
};

export const getAllExpensesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const projectName = req.query.projectName as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;

    const expenses = await ExpenseService.getExpenses({
      employeeId,
      status,
      category,
      projectName,
      startDate,
      endDate,
      search
    });

    res.json({ success: true, count: expenses.length, data: expenses });
  } catch (error: any) {
    console.error('getAllExpensesHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load expenses.' } });
  }
};

export const updateExpenseStatusHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user!.id;
    const id = parseInt(req.params.id as string, 10);
    const { status, adminRemarks, reimbursementReference } = req.body;

    if (!status || !['APPROVED', 'REJECTED', 'REIMBURSED'].includes(status)) {
      res.status(400).json({ success: false, error: { message: 'Invalid status. Allowed: APPROVED, REJECTED, REIMBURSED.' } });
      return;
    }

    const updated = await ExpenseService.updateExpenseStatus(id, adminId, status, adminRemarks, reimbursementReference);
    res.json({ success: true, message: `Expense claim marked as ${status}.`, data: updated });
  } catch (error: any) {
    console.error('updateExpenseStatusHandler error:', error);
    res.status(400).json({ success: false, error: { message: error.message || 'Failed to update expense status.' } });
  }
};

export const getAdminMetricsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;
    const metrics = await ExpenseService.getOverviewMetrics(employeeId);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load metrics.' } });
  }
};

export const exportExcelReportHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;
    const projectName = req.query.projectName as string | undefined;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const buffer = await ExpenseService.generateExcelReport({
      employeeId,
      projectName,
      status,
      category
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Falcon_Expenses_Advances_Report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error: any) {
    console.error('exportExcelReportHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to export Excel report.' } });
  }
};

export const exportPdfReportHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;
    const projectName = req.query.projectName as string | undefined;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const buffer = await ExpenseService.generatePdfReport({
      employeeId,
      projectName,
      status,
      category
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Falcon_Expenses_Advances_Report_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error: any) {
    console.error('exportPdfReportHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to export PDF report.' } });
  }
};

export const getProjectsAndCategoriesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projAdv = await query('SELECT DISTINCT project_name, client_name FROM project_advance_requests WHERE project_name IS NOT NULL');
    const projExp = await query('SELECT DISTINCT project_name, client_name FROM project_expense_requests WHERE project_name IS NOT NULL');

    const projectSet = new Set<string>();
    const clientMap: Record<string, string> = {};

    [...projAdv.rows, ...projExp.rows].forEach((r) => {
      if (r.project_name) {
        projectSet.add(r.project_name);
        if (r.client_name && !clientMap[r.project_name]) {
          clientMap[r.project_name] = r.client_name;
        }
      }
    });

    // Default corporate projects if empty
    if (projectSet.size === 0) {
      projectSet.add('LiDAR Survey Phase 1');
      projectSet.add('GIS Mapping Initiative');
      projectSet.add('Highway Topography Project');
      projectSet.add('Client Site Gurgaon');
      projectSet.add('Client Site Greater Noida');
    }

    res.json({
      success: true,
      data: {
        projects: Array.from(projectSet),
        categories: EXPENSE_CATEGORIES,
        clientMap
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to load projects.' } });
  }
};
