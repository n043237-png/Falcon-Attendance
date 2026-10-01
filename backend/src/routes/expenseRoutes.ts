import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { uploadExpenseFiles } from '../middlewares/expenseUpload';
import {
  createAdvanceHandler,
  getMyAdvancesHandler,
  cancelMyAdvanceHandler,
  createExpenseHandler,
  getMyExpensesHandler,
  cancelMyExpenseHandler,
  uploadExpenseDocumentHandler,
  getMyMetricsHandler,
  getAllAdvancesHandler,
  updateAdvanceStatusHandler,
  getAllExpensesHandler,
  updateExpenseStatusHandler,
  getAdminMetricsHandler,
  exportExcelReportHandler,
  exportPdfReportHandler,
  getProjectsAndCategoriesHandler
} from '../controllers/expenseController';

const router = Router();

// Protect all routes with authentication
router.use(authenticateToken);

// Common Projects & Categories
router.get('/projects', getProjectsAndCategoriesHandler);

// Employee Self-Service Routes
router.post('/advances', createAdvanceHandler);
router.get('/advances', getMyAdvancesHandler);
router.delete('/advances/:id', cancelMyAdvanceHandler);

router.post('/claims', uploadExpenseFiles.array('receipts', 5), createExpenseHandler);
router.get('/claims', getMyExpensesHandler);
router.delete('/claims/:id', cancelMyExpenseHandler);
router.post('/claims/:id/documents', uploadExpenseFiles.single('receipt'), uploadExpenseDocumentHandler);
router.get('/metrics', getMyMetricsHandler);

// Admin Management Routes (Requires Admin role)
router.get('/admin/advances', requireRole('admin'), getAllAdvancesHandler);
router.patch('/admin/advances/:id/status', requireRole('admin'), updateAdvanceStatusHandler);

router.get('/admin/claims', requireRole('admin'), getAllExpensesHandler);
router.patch('/admin/claims/:id/status', requireRole('admin'), updateExpenseStatusHandler);

router.get('/admin/metrics', requireRole('admin'), getAdminMetricsHandler);
router.get('/admin/export/excel', requireRole('admin'), exportExcelReportHandler);
router.get('/admin/export/pdf', requireRole('admin'), exportPdfReportHandler);

export default router;
