"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Notification retrieval
router.get('/', notificationController_1.getNotifications);
router.get('/unread', notificationController_1.getUnreadNotifications);
router.get('/stream', notificationController_1.notificationStream);
// Mark read
router.put('/:id/read', notificationController_1.markAsRead);
router.patch('/:id/read', notificationController_1.markAsRead);
router.put('/read-all', notificationController_1.markAllAsRead);
router.patch('/read-all', notificationController_1.markAllAsRead);
// Delete
router.delete('/:id', notificationController_1.deleteNotification);
// Preferences
router.get('/preferences', notificationController_1.getPreferences);
router.patch('/preferences', notificationController_1.updatePreferences);
// Push Tokens
router.post('/push-token', notificationController_1.registerPushToken);
router.delete('/push-token', notificationController_1.unregisterPushToken);
// Broadcast Announcement (Admin only)
router.post('/broadcast', notificationController_1.broadcastAnnouncement);
exports.default = router;
