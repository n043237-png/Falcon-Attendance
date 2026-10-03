import { Router } from 'express';
import { getAttendance, getDailySummary } from '../controllers/adminController';
import { getAttendanceReport } from '../controllers/adminReportController';
import { getAdminLeaves, approveLeave, rejectLeave, revokeLeave, adjustEmployeeLeaveBalance, getLeaveAdjustmentHistory, getEmployeeLeaveBalance } from '../controllers/adminLeaveController';
import { 
  getEmployees, 
  getEmployeeDetail, 
  createEmployee, 
  editEmployee, 
  updateEmployeeStatus, 
  resetPassword, 
  deleteEmployee, 
  uploadEmployeePhoto, 
  deleteEmployeePhoto,
  updateJobStatus,
  exportEmployees,
  getNextEmployeeIdHandler,
  validateEmployeeIdHandler,
  getAdminEmployeeProfile,
  updateAdminEmployeeProfile,
  adminUploadEmployeeDocument,
  adminDeleteEmployeeDocument,
  adminGetEmployeeProfileActivity
} from '../controllers/adminEmployeeController';
import { getSettings, updateSettings, getHolidays, addHoliday, deleteHoliday, getOfficeSettings, updateOfficeSettings, getLeaveSettings, updateLeaveSettings } from '../controllers/settingsController';
import { 
  getShifts, 
  getShift, 
  createShift, 
  updateShift, 
  deleteShift, 
  getShiftEmployees, 
  assignShift, 
  bulkAssignShift 
} from '../controllers/shiftController';
import {
  getEmployeeIdCard,
  downloadEmployeeIdCardPdf,
  getBulkIdCardsData,
  downloadBulkIdCardsPdf,
  downloadBulkIdCardsZip
} from '../controllers/idCardController';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { uploadProfilePhoto } from '../middlewares/upload';
import { uploadDocumentMiddleware } from '../services/documentService';
import { query } from '../db';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/notifications', async (req, res) => {
  try {
    const notifRes = await query(`
      SELECT * FROM notifications 
      WHERE type = 'ADMIN_DAILY_ABSENCE' 
      ORDER BY sent_at DESC 
      LIMIT 100
    `);
    res.json({ success: true, data: notifRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
});

router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/settings/leave', getLeaveSettings);
router.patch('/settings/leave', updateLeaveSettings);
router.get('/office', getOfficeSettings);
router.patch('/office', updateOfficeSettings);
router.get('/holidays', getHolidays);
router.post('/holidays', addHoliday);
router.delete('/holidays/:id', deleteHoliday);

router.get('/reports/attendance', getAttendanceReport);
router.get('/reports/attendance-policy-pdf', async (req, res) => {
  try {
    const { generateAttendanceRulesPdf } = await import('../services/policyPdfService');
    const pdfBuf = await generateAttendanceRulesPdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Falcon_Attendance_Rules_and_Policy.pdf"');
    res.setHeader('Content-Length', pdfBuf.length);
    res.end(pdfBuf);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate policy PDF' } });
  }
});

// WhatsApp Alert Endpoints
router.get('/whatsapp-logs', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const logsRes = await query(`
      SELECT w.id, w.employee_id as "employeeId", u.name as "employeeName", u.department,
             w.recipient_phone as "recipientPhone", w.alert_type as "alertType",
             w.attendance_date as "attendanceDate", w.message, w.status, w.sent_at as "sentAt"
      FROM whatsapp_logs w
      JOIN users u ON w.employee_id = u.id
      WHERE w.attendance_date = $1
      ORDER BY w.sent_at DESC
    `, [date]);
    res.json({ success: true, data: logsRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch WhatsApp logs' } });
  }
});

router.post('/test-whatsapp-alert', async (req, res) => {
  try {
    const { checkAndSendLateAttendanceAlerts } = await import('../services/whatsappService');
    const date = req.body.date as string | undefined;
    const result = await checkAndSendLateAttendanceAlerts(date);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to trigger WhatsApp alerts' } });
  }
});

router.get('/attendance', getAttendance);

router.get('/attendance/summary', getDailySummary);

router.get('/leave/is-initialized', (req, res, next) => {
  import('../controllers/adminLeaveController').then(m => m.isInitialized(req, res)).catch(next);
});
router.post('/leave/initialize', (req, res, next) => {
  import('../controllers/adminLeaveController').then(m => m.initializeLeaves(req, res)).catch(next);
});
router.get('/leave', getAdminLeaves);
router.patch('/leave/:id/approve', approveLeave);
router.patch('/leave/:id/reject', rejectLeave);
router.patch('/leave/:id/revoke', revokeLeave);
router.post('/leave/adjust-balance', adjustEmployeeLeaveBalance);
router.get('/leave/balance/:employeeId', getEmployeeLeaveBalance);
router.get('/leave/adjust-history/:employeeId', getLeaveAdjustmentHistory);

router.get('/employees', getEmployees);
router.get('/employees/next-id', getNextEmployeeIdHandler);
router.get('/employees/validate-id', validateEmployeeIdHandler);
router.get('/employees/export', exportEmployees);
router.get('/employees/:id/profile', getAdminEmployeeProfile);
router.patch('/employees/:id/profile', updateAdminEmployeeProfile);
router.post('/employees/:id/documents', uploadDocumentMiddleware.single('file'), adminUploadEmployeeDocument);
router.delete('/employees/:id/documents/:docId', adminDeleteEmployeeDocument);
router.get('/employees/:id/profile-activity', adminGetEmployeeProfileActivity);
router.get('/employees/:id', getEmployeeDetail);
router.post('/employees', createEmployee);
router.patch('/employees/:id', editEmployee);
router.patch('/employees/:id/job-status', updateJobStatus);
router.patch('/employees/:id/status', updateEmployeeStatus);
router.patch('/employees/:id/reset-password', resetPassword);
router.delete('/employees/:id', deleteEmployee);
router.post('/upload-photo', uploadProfilePhoto.single('photo'), uploadEmployeePhoto);
router.post('/employees/:id/photo', uploadProfilePhoto.single('photo'), uploadEmployeePhoto);
router.delete('/employees/:id/photo', deleteEmployeePhoto);

// Shift Management Routes
router.get('/shifts', getShifts);
router.get('/shifts/:id', getShift);
router.post('/shifts', createShift);
router.put('/shifts/:id', updateShift);
router.patch('/shifts/:id', updateShift);
router.delete('/shifts/:id', deleteShift);
router.get('/shifts/:id/employees', getShiftEmployees);
router.post('/shifts/assign', assignShift);
router.post('/shifts/bulk-assign', bulkAssignShift);

// Digital Employee ID Card Management Routes
router.get('/employees/:id/id-card', getEmployeeIdCard);
router.get('/employees/:id/id-card/pdf', downloadEmployeeIdCardPdf);
router.get('/id-cards/bulk-data', getBulkIdCardsData);
router.post('/id-cards/bulk-pdf', downloadBulkIdCardsPdf);
router.post('/id-cards/bulk-zip', downloadBulkIdCardsZip);

export default router;
