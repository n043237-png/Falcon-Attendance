"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectsAndCategoriesHandler = exports.exportPdfReportHandler = exports.exportExcelReportHandler = exports.getAdminMetricsHandler = exports.updateExpenseStatusHandler = exports.getAllExpensesHandler = exports.updateAdvanceStatusHandler = exports.getAllAdvancesHandler = exports.getMyMetricsHandler = exports.uploadExpenseDocumentHandler = exports.cancelMyExpenseHandler = exports.getMyExpensesHandler = exports.createExpenseHandler = exports.cancelMyAdvanceHandler = exports.getMyAdvancesHandler = exports.createAdvanceHandler = void 0;
const expenseService_1 = require("../services/expenseService");
const db_1 = require("../db");
// =========================================================================
// EMPLOYEE CONTROLLER HANDLERS
// =========================================================================
const createAdvanceHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const { projectName, clientName, purpose, amountRequested, requiredDate, employeeRemarks } = req.body;
        if (!projectName || !purpose || !amountRequested || !requiredDate) {
            res.status(400).json({
                success: false,
                error: { message: 'Project name, purpose, amount requested, and required date are required.' }
            });
            return;
        }
        const advance = await expenseService_1.ExpenseService.createAdvance(employeeId, {
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
    }
    catch (error) {
        console.error('createAdvanceHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to submit advance request.' } });
    }
};
exports.createAdvanceHandler = createAdvanceHandler;
const getMyAdvancesHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const status = req.query.status;
        const search = req.query.search;
        const advances = await expenseService_1.ExpenseService.getAdvances({
            employeeId,
            status,
            search
        });
        res.json({ success: true, count: advances.length, data: advances });
    }
    catch (error) {
        console.error('getMyAdvancesHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load advances.' } });
    }
};
exports.getMyAdvancesHandler = getMyAdvancesHandler;
const cancelMyAdvanceHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const cancelled = await expenseService_1.ExpenseService.cancelAdvance(id, employeeId);
        res.json({ success: true, message: 'Advance request cancelled successfully.', data: cancelled });
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to cancel advance request.' } });
    }
};
exports.cancelMyAdvanceHandler = cancelMyAdvanceHandler;
const createExpenseHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const { projectName, clientName, expenseCategory, expenseDate, amount, description, paymentMethod, employeeRemarks, advanceId } = req.body;
        if (!projectName || !expenseCategory || !expenseDate || !amount || !description) {
            res.status(400).json({
                success: false,
                error: { message: 'Project name, expense category, date, amount, and description are required.' }
            });
            return;
        }
        const files = req.files;
        const expense = await expenseService_1.ExpenseService.createExpense(employeeId, {
            projectName,
            clientName,
            expenseCategory,
            expenseDate,
            amount: parseFloat(amount),
            description,
            paymentMethod,
            employeeRemarks,
            advanceId: advanceId ? parseInt(advanceId, 10) : undefined
        }, files);
        res.status(201).json({
            success: true,
            message: 'Expense claim submitted successfully.',
            data: expense
        });
    }
    catch (error) {
        console.error('createExpenseHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to submit expense claim.' } });
    }
};
exports.createExpenseHandler = createExpenseHandler;
const getMyExpensesHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const status = req.query.status;
        const category = req.query.category;
        const search = req.query.search;
        const expenses = await expenseService_1.ExpenseService.getExpenses({
            employeeId,
            status,
            category,
            search
        });
        res.json({ success: true, count: expenses.length, data: expenses });
    }
    catch (error) {
        console.error('getMyExpensesHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load expenses.' } });
    }
};
exports.getMyExpensesHandler = getMyExpensesHandler;
const cancelMyExpenseHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const cancelled = await expenseService_1.ExpenseService.cancelExpense(id, employeeId);
        res.json({ success: true, message: 'Expense claim cancelled successfully.', data: cancelled });
    }
    catch (error) {
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to cancel expense claim.' } });
    }
};
exports.cancelMyExpenseHandler = cancelMyExpenseHandler;
const uploadExpenseDocumentHandler = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, error: { message: 'No file uploaded.' } });
            return;
        }
        const doc = await expenseService_1.ExpenseService.addExpenseDocument(id, file);
        res.status(201).json({ success: true, message: 'Supporting receipt uploaded successfully.', data: doc });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload document.' } });
    }
};
exports.uploadExpenseDocumentHandler = uploadExpenseDocumentHandler;
const getMyMetricsHandler = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const metrics = await expenseService_1.ExpenseService.getOverviewMetrics(employeeId);
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load metrics.' } });
    }
};
exports.getMyMetricsHandler = getMyMetricsHandler;
// =========================================================================
// ADMIN CONTROLLER HANDLERS
// =========================================================================
const getAllAdvancesHandler = async (req, res) => {
    try {
        const employeeId = req.query.employeeId ? parseInt(req.query.employeeId, 10) : undefined;
        const status = req.query.status;
        const projectName = req.query.projectName;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        const advances = await expenseService_1.ExpenseService.getAdvances({
            employeeId,
            status,
            projectName,
            startDate,
            endDate,
            search
        });
        res.json({ success: true, count: advances.length, data: advances });
    }
    catch (error) {
        console.error('getAllAdvancesHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load advances.' } });
    }
};
exports.getAllAdvancesHandler = getAllAdvancesHandler;
const updateAdvanceStatusHandler = async (req, res) => {
    try {
        const adminId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const { status, adminRemarks, paymentReference } = req.body;
        if (!status || !['APPROVED', 'REJECTED', 'PAID'].includes(status)) {
            res.status(400).json({ success: false, error: { message: 'Invalid status. Allowed: APPROVED, REJECTED, PAID.' } });
            return;
        }
        const updated = await expenseService_1.ExpenseService.updateAdvanceStatus(id, adminId, status, adminRemarks, paymentReference);
        res.json({ success: true, message: `Advance request marked as ${status}.`, data: updated });
    }
    catch (error) {
        console.error('updateAdvanceStatusHandler error:', error);
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to update advance status.' } });
    }
};
exports.updateAdvanceStatusHandler = updateAdvanceStatusHandler;
const getAllExpensesHandler = async (req, res) => {
    try {
        const employeeId = req.query.employeeId ? parseInt(req.query.employeeId, 10) : undefined;
        const status = req.query.status;
        const category = req.query.category;
        const projectName = req.query.projectName;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        const expenses = await expenseService_1.ExpenseService.getExpenses({
            employeeId,
            status,
            category,
            projectName,
            startDate,
            endDate,
            search
        });
        res.json({ success: true, count: expenses.length, data: expenses });
    }
    catch (error) {
        console.error('getAllExpensesHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load expenses.' } });
    }
};
exports.getAllExpensesHandler = getAllExpensesHandler;
const updateExpenseStatusHandler = async (req, res) => {
    try {
        const adminId = req.user.id;
        const id = parseInt(req.params.id, 10);
        const { status, adminRemarks, reimbursementReference } = req.body;
        if (!status || !['APPROVED', 'REJECTED', 'REIMBURSED'].includes(status)) {
            res.status(400).json({ success: false, error: { message: 'Invalid status. Allowed: APPROVED, REJECTED, REIMBURSED.' } });
            return;
        }
        const updated = await expenseService_1.ExpenseService.updateExpenseStatus(id, adminId, status, adminRemarks, reimbursementReference);
        res.json({ success: true, message: `Expense claim marked as ${status}.`, data: updated });
    }
    catch (error) {
        console.error('updateExpenseStatusHandler error:', error);
        res.status(400).json({ success: false, error: { message: error.message || 'Failed to update expense status.' } });
    }
};
exports.updateExpenseStatusHandler = updateExpenseStatusHandler;
const getAdminMetricsHandler = async (req, res) => {
    try {
        const employeeId = req.query.employeeId ? parseInt(req.query.employeeId, 10) : undefined;
        const metrics = await expenseService_1.ExpenseService.getOverviewMetrics(employeeId);
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load metrics.' } });
    }
};
exports.getAdminMetricsHandler = getAdminMetricsHandler;
const exportExcelReportHandler = async (req, res) => {
    try {
        const employeeId = req.query.employeeId ? parseInt(req.query.employeeId, 10) : undefined;
        const projectName = req.query.projectName;
        const status = req.query.status;
        const category = req.query.category;
        const buffer = await expenseService_1.ExpenseService.generateExcelReport({
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
    }
    catch (error) {
        console.error('exportExcelReportHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to export Excel report.' } });
    }
};
exports.exportExcelReportHandler = exportExcelReportHandler;
const exportPdfReportHandler = async (req, res) => {
    try {
        const employeeId = req.query.employeeId ? parseInt(req.query.employeeId, 10) : undefined;
        const projectName = req.query.projectName;
        const status = req.query.status;
        const category = req.query.category;
        const buffer = await expenseService_1.ExpenseService.generatePdfReport({
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
    }
    catch (error) {
        console.error('exportPdfReportHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to export PDF report.' } });
    }
};
exports.exportPdfReportHandler = exportPdfReportHandler;
const getProjectsAndCategoriesHandler = async (req, res) => {
    try {
        const projAdv = await (0, db_1.query)('SELECT DISTINCT project_name, client_name FROM project_advance_requests WHERE project_name IS NOT NULL');
        const projExp = await (0, db_1.query)('SELECT DISTINCT project_name, client_name FROM project_expense_requests WHERE project_name IS NOT NULL');
        const projectSet = new Set();
        const clientMap = {};
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
                categories: expenseService_1.EXPENSE_CATEGORIES,
                clientMap
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to load projects.' } });
    }
};
exports.getProjectsAndCategoriesHandler = getProjectsAndCategoriesHandler;
