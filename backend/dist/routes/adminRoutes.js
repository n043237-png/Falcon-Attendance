"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const adminReportController_1 = require("../controllers/adminReportController");
const adminLeaveController_1 = require("../controllers/adminLeaveController");
const adminEmployeeController_1 = require("../controllers/adminEmployeeController");
const settingsController_1 = require("../controllers/settingsController");
const shiftController_1 = require("../controllers/shiftController");
const idCardController_1 = require("../controllers/idCardController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const documentService_1 = require("../services/documentService");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)('admin'));
router.get('/notifications', async (req, res) => {
    try {
        const notifRes = await (0, db_1.query)(`
      SELECT * FROM notifications 
      WHERE type = 'ADMIN_DAILY_ABSENCE' 
      ORDER BY sent_at DESC 
      LIMIT 100
    `);
        res.json({ success: true, data: notifRes.rows });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: 'Server error' } });
    }
});
router.get('/settings', settingsController_1.getSettings);
router.patch('/settings', settingsController_1.updateSettings);
router.get('/settings/leave', settingsController_1.getLeaveSettings);
router.patch('/settings/leave', settingsController_1.updateLeaveSettings);
router.get('/office', settingsController_1.getOfficeSettings);
router.patch('/office', settingsController_1.updateOfficeSettings);
router.get('/holidays', settingsController_1.getHolidays);
router.post('/holidays', settingsController_1.addHoliday);
router.delete('/holidays/:id', settingsController_1.deleteHoliday);
router.get('/reports/attendance', adminReportController_1.getAttendanceReport);
router.get('/reports/attendance-policy-pdf', async (req, res) => {
    try {
        const { generateAttendanceRulesPdf } = await Promise.resolve().then(() => __importStar(require('../services/policyPdfService')));
        const pdfBuf = await generateAttendanceRulesPdf();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Falcon_Attendance_Rules_and_Policy.pdf"');
        res.setHeader('Content-Length', pdfBuf.length);
        res.end(pdfBuf);
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate policy PDF' } });
    }
});
router.get('/attendance', adminController_1.getAttendance);
router.get('/attendance/summary', adminController_1.getDailySummary);
router.get('/leave/is-initialized', (req, res, next) => {
    Promise.resolve().then(() => __importStar(require('../controllers/adminLeaveController'))).then(m => m.isInitialized(req, res)).catch(next);
});
router.post('/leave/initialize', (req, res, next) => {
    Promise.resolve().then(() => __importStar(require('../controllers/adminLeaveController'))).then(m => m.initializeLeaves(req, res)).catch(next);
});
router.get('/leave', adminLeaveController_1.getAdminLeaves);
router.patch('/leave/:id/approve', adminLeaveController_1.approveLeave);
router.patch('/leave/:id/reject', adminLeaveController_1.rejectLeave);
router.patch('/leave/:id/revoke', adminLeaveController_1.revokeLeave);
router.post('/leave/adjust-balance', adminLeaveController_1.adjustEmployeeLeaveBalance);
router.get('/leave/balance/:employeeId', adminLeaveController_1.getEmployeeLeaveBalance);
router.get('/leave/adjust-history/:employeeId', adminLeaveController_1.getLeaveAdjustmentHistory);
router.get('/employees', adminEmployeeController_1.getEmployees);
router.get('/employees/next-id', adminEmployeeController_1.getNextEmployeeIdHandler);
router.get('/employees/validate-id', adminEmployeeController_1.validateEmployeeIdHandler);
router.get('/employees/export', adminEmployeeController_1.exportEmployees);
router.get('/employees/designations', adminEmployeeController_1.getDesignations);
router.get('/employees/:id/profile', adminEmployeeController_1.getAdminEmployeeProfile);
router.patch('/employees/:id/profile', adminEmployeeController_1.updateAdminEmployeeProfile);
router.post('/employees/:id/documents', documentService_1.uploadDocumentMiddleware.single('file'), adminEmployeeController_1.adminUploadEmployeeDocument);
router.delete('/employees/:id/documents/:docId', adminEmployeeController_1.adminDeleteEmployeeDocument);
router.get('/employees/:id/profile-activity', adminEmployeeController_1.adminGetEmployeeProfileActivity);
router.get('/employees/:id', adminEmployeeController_1.getEmployeeDetail);
router.post('/employees', adminEmployeeController_1.createEmployee);
router.patch('/employees/:id', adminEmployeeController_1.editEmployee);
router.patch('/employees/:id/job-status', adminEmployeeController_1.updateJobStatus);
router.patch('/employees/:id/status', adminEmployeeController_1.updateEmployeeStatus);
router.patch('/employees/:id/reset-password', adminEmployeeController_1.resetPassword);
router.delete('/employees/:id', adminEmployeeController_1.deleteEmployee);
router.post('/upload-photo', upload_1.uploadProfilePhoto.single('photo'), adminEmployeeController_1.uploadEmployeePhoto);
router.post('/employees/:id/photo', upload_1.uploadProfilePhoto.single('photo'), adminEmployeeController_1.uploadEmployeePhoto);
router.delete('/employees/:id/photo', adminEmployeeController_1.deleteEmployeePhoto);
// Shift Management Routes
router.get('/shifts', shiftController_1.getShifts);
router.get('/shifts/:id', shiftController_1.getShift);
router.post('/shifts', shiftController_1.createShift);
router.put('/shifts/:id', shiftController_1.updateShift);
router.patch('/shifts/:id', shiftController_1.updateShift);
router.delete('/shifts/:id', shiftController_1.deleteShift);
router.get('/shifts/:id/employees', shiftController_1.getShiftEmployees);
router.post('/shifts/assign', shiftController_1.assignShift);
router.post('/shifts/bulk-assign', shiftController_1.bulkAssignShift);
// Digital Employee ID Card Management Routes
router.get('/employees/:id/id-card', idCardController_1.getEmployeeIdCard);
router.get('/employees/:id/id-card/pdf', idCardController_1.downloadEmployeeIdCardPdf);
router.get('/id-cards/bulk-data', idCardController_1.getBulkIdCardsData);
router.post('/id-cards/bulk-pdf', idCardController_1.downloadBulkIdCardsPdf);
router.post('/id-cards/bulk-zip', idCardController_1.downloadBulkIdCardsZip);
exports.default = router;
