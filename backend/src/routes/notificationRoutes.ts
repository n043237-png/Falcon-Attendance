import { Router } from 'express';
import {
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  registerPushToken,
  unregisterPushToken,
  notificationStream,
  broadcastAnnouncement,
} from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);

// Notification retrieval
router.get('/', getNotifications);
router.get('/unread', getUnreadNotifications);
router.get('/stream', notificationStream);

// Mark read
router.put('/:id/read', markAsRead);
router.patch('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.patch('/read-all', markAllAsRead);

// Delete
router.delete('/:id', deleteNotification);

// Preferences
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

// Push Tokens
router.post('/push-token', registerPushToken);
router.delete('/push-token', unregisterPushToken);

// Broadcast Announcement (Admin only)
router.post('/broadcast', broadcastAnnouncement);

export default router;
