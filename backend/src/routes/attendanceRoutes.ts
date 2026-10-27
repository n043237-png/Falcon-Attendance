import { Router } from 'express';
import { checkIn, checkOut, resumeAttendance, getToday, getHistory, getSummary, getCalendar } from '../controllers/attendanceController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken); // Protect all attendance routes

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/resume', resumeAttendance);
router.get('/today', getToday);
router.get('/history', getHistory);
router.get('/summary', getSummary);
router.get('/calendar', getCalendar);

export default router;
