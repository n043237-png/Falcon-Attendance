"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // Protect all attendance routes
router.post('/check-in', attendanceController_1.checkIn);
router.post('/check-out', attendanceController_1.checkOut);
router.post('/resume', attendanceController_1.resumeAttendance);
router.get('/today', attendanceController_1.getToday);
router.get('/history', attendanceController_1.getHistory);
router.get('/summary', attendanceController_1.getSummary);
router.get('/calendar', attendanceController_1.getCalendar);
exports.default = router;
