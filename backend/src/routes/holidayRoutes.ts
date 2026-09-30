import { Router } from 'express';
import { getHolidays, addHoliday, deleteHoliday } from '../controllers/settingsController';
import { authenticateToken, adminOnly } from '../middlewares/auth';

const router = Router();

// Protect all routes with authentication
router.use(authenticateToken);

// Accessible by all employees and admins
router.get('/', getHolidays);

// Admin-only operations
router.post('/', adminOnly, addHoliday);
router.delete('/:id', adminOnly, deleteHoliday);

export default router;
