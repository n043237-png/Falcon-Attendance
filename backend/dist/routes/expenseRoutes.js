"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const expenseUpload_1 = require("../middlewares/expenseUpload");
const expenseController_1 = require("../controllers/expenseController");
const router = (0, express_1.Router)();
// Protect all routes with authentication
router.use(auth_1.authenticateToken);
// Common Projects & Categories
router.get('/projects', expenseController_1.getProjectsAndCategoriesHandler);
// Employee Self-Service Routes
router.post('/advances', expenseController_1.createAdvanceHandler);
router.get('/advances', expenseController_1.getMyAdvancesHandler);
router.delete('/advances/:id', expenseController_1.cancelMyAdvanceHandler);
router.post('/claims', expenseUpload_1.uploadExpenseFiles.array('receipts', 5), expenseController_1.createExpenseHandler);
router.get('/claims', expenseController_1.getMyExpensesHandler);
router.delete('/claims/:id', expenseController_1.cancelMyExpenseHandler);
router.post('/claims/:id/documents', expenseUpload_1.uploadExpenseFiles.single('receipt'), expenseController_1.uploadExpenseDocumentHandler);
router.get('/metrics', expenseController_1.getMyMetricsHandler);
// Admin Management Routes (Requires Admin role)
router.get('/admin/advances', (0, auth_1.requireRole)('admin'), expenseController_1.getAllAdvancesHandler);
router.patch('/admin/advances/:id/status', (0, auth_1.requireRole)('admin'), expenseController_1.updateAdvanceStatusHandler);
router.get('/admin/claims', (0, auth_1.requireRole)('admin'), expenseController_1.getAllExpensesHandler);
router.patch('/admin/claims/:id/status', (0, auth_1.requireRole)('admin'), expenseController_1.updateExpenseStatusHandler);
router.get('/admin/metrics', (0, auth_1.requireRole)('admin'), expenseController_1.getAdminMetricsHandler);
router.get('/admin/export/excel', (0, auth_1.requireRole)('admin'), expenseController_1.exportExcelReportHandler);
router.get('/admin/export/pdf', (0, auth_1.requireRole)('admin'), expenseController_1.exportPdfReportHandler);
exports.default = router;
