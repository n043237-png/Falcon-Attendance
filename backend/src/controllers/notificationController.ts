import { Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { NotificationService } from '../services/notificationService';

// Schema for updating preferences
const updatePreferencesSchema = z.object({
  attendanceNotifications: z.boolean().optional(),
  leaveNotifications: z.boolean().optional(),
  payrollNotifications: z.boolean().optional(),
  announcementNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  // Alternate aliases
  attendance_alerts: z.boolean().optional(),
  leave_alerts: z.boolean().optional(),
  payroll_alerts: z.boolean().optional(),
  announcements: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
});

// Schema for registering push token
const pushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['expo', 'android', 'ios', 'web']).default('expo'),
});

/**
 * GET /api/notifications
 * Fetch notifications with search, filters, and pagination
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    const offset = (page - 1) * limit;

    const search = (req.query.search as string)?.trim();
    const status = (req.query.status as string)?.toLowerCase(); // 'all', 'unread', 'read'
    const type = req.query.type as string; // 'Attendance', 'Leave', etc.
    const priority = req.query.priority as string; // 'Low', 'Medium', 'High', 'Critical'
    const timeframe = (req.query.timeframe as string)?.toLowerCase(); // 'today', 'week', 'month', 'all'

    // Role-based recipient restriction:
    // Employees ONLY see notifications directed to them or their role.
    // Admins see notifications directed to them or admin role.
    let filterQuery = `WHERE deleted_at IS NULL AND created_at >= (NOW() - INTERVAL '30 days') AND (COALESCE(recipient_user_id, employee_id) = $1 OR (role = $2 AND recipient_user_id IS NULL AND employee_id IS NULL))`;
    const queryParams: any[] = [userId, userRole];

    if (search) {
      queryParams.push(`%${search}%`);
      filterQuery += ` AND (title ILIKE $${queryParams.length} OR message ILIKE $${queryParams.length})`;
    }

    if (status === 'unread') {
      filterQuery += ` AND is_read = FALSE`;
    } else if (status === 'read') {
      filterQuery += ` AND is_read = TRUE`;
    }

    if (type && type !== 'all' && type !== 'All') {
      queryParams.push(type);
      filterQuery += ` AND type = $${queryParams.length}`;
    }

    if (priority && priority !== 'all' && priority !== 'All') {
      queryParams.push(priority);
      filterQuery += ` AND priority = $${queryParams.length}`;
    }

    if (timeframe === 'today') {
      filterQuery += ` AND created_at >= CURRENT_DATE`;
    } else if (timeframe === 'week') {
      filterQuery += ` AND created_at >= (CURRENT_DATE - INTERVAL '7 days')`;
    } else if (timeframe === 'month') {
      filterQuery += ` AND created_at >= (CURRENT_DATE - INTERVAL '30 days')`;
    }

    // Count total matching
    const countRes = await query(`SELECT COUNT(*) as total FROM notifications ${filterQuery}`, queryParams);
    const total = parseInt(countRes.rows[0].total) || 0;

    // Unread count for current user
    const unreadCountRes = await query(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE deleted_at IS NULL 
         AND is_read = FALSE 
         AND created_at >= (NOW() - INTERVAL '30 days')
         AND (COALESCE(recipient_user_id, employee_id) = $1 OR (role = $2 AND recipient_user_id IS NULL AND employee_id IS NULL))`,
      [userId, userRole]
    );
    const unreadCount = parseInt(unreadCountRes.rows[0].unread_count) || 0;

    // Fetch paginated rows
    const itemsRes = await query(
      `SELECT id, recipient_user_id as "recipientUserId", sender_user_id as "senderUserId",
              role, title, message, type, priority, action_url as "actionUrl", icon,
              is_read as "isRead", created_at as "createdAt", updated_at as "updatedAt", sent_at as "sentAt"
       FROM notifications
       ${filterQuery}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      success: true,
      data: {
        items: itemsRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to retrieve notifications' } });
  }
};

/**
 * GET /api/notifications/unread
 * Returns unread count and latest unread/recent notifications for the header bell dropdown
 */
export const getUnreadNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();

    // Unread count
    const countRes = await query(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE deleted_at IS NULL 
         AND is_read = FALSE 
         AND created_at >= (NOW() - INTERVAL '30 days')
         AND (COALESCE(recipient_user_id, employee_id) = $1 OR (role = $2 AND recipient_user_id IS NULL AND employee_id IS NULL))`,
      [userId, userRole]
    );
    const count = parseInt(countRes.rows[0].unread_count) || 0;

    // Latest 10 notifications for dropdown
    const latestRes = await query(
      `SELECT id, recipient_user_id as "recipientUserId", role, title, message, 
              type, priority, action_url as "actionUrl", icon, is_read as "isRead", 
              created_at as "createdAt"
       FROM notifications
       WHERE deleted_at IS NULL 
         AND created_at >= (NOW() - INTERVAL '30 days')
         AND (COALESCE(recipient_user_id, employee_id) = $1 OR (role = $2 AND recipient_user_id IS NULL AND employee_id IS NULL))
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, userRole]
    );

    res.json({
      success: true,
      data: {
        unreadCount: count,
        latest: latestRes.rows,
        items: latestRes.rows,
      },
    });
  } catch (error) {
    console.error('getUnreadNotifications error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch unread notifications' } });
  }
};

/**
 * PUT or PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();
    const notificationId = parseInt(req.params.id as string);

    const updateRes = await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND (COALESCE(recipient_user_id, employee_id) = $2 OR (role = $3 AND recipient_user_id IS NULL AND employee_id IS NULL))
       RETURNING id`,
      [notificationId, userId, userRole]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: 'Notification not found or access denied' } });
      return;
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * PUT or PATCH /api/notifications/read-all
 * Mark all notifications as read for current user
 */
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();

    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE is_read = FALSE 
         AND (COALESCE(recipient_user_id, employee_id) = $1 OR (role = $2 AND recipient_user_id IS NULL AND employee_id IS NULL))`,
      [userId, userRole]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * DELETE /api/notifications/:id
 * Soft-delete a notification
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();
    const notificationId = parseInt(req.params.id as string);

    const delRes = await query(
      `UPDATE notifications 
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND (COALESCE(recipient_user_id, employee_id) = $2 OR (role = $3 AND recipient_user_id IS NULL AND employee_id IS NULL))
       RETURNING id`,
      [notificationId, userId, userRole]
    );

    if (delRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: 'Notification not found or access denied' } });
      return;
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('deleteNotification error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * GET /api/notifications/preferences
 * Get current user notification preferences
 */
export const getPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    let prefRes = await query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId]);

    if (prefRes.rows.length === 0) {
      // Create default preferences
      const insertRes = await query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      prefRes = insertRes;
    }

    const row = prefRes.rows[0];
    res.json({
      success: true,
      data: {
        attendanceNotifications: row.attendance_notifications,
        leaveNotifications: row.leave_notifications,
        payrollNotifications: row.payroll_notifications,
        announcementNotifications: row.announcement_notifications,
        pushNotifications: row.push_notifications,
        emailNotifications: row.email_notifications,
        // Aliases
        attendance_alerts: row.attendance_notifications,
        leave_alerts: row.leave_notifications,
        payroll_alerts: row.payroll_notifications,
        announcements: row.announcement_notifications,
        push_enabled: row.push_notifications,
        email_enabled: row.email_notifications,
        in_app_enabled: true,
      },
    });
  } catch (error) {
    console.error('getPreferences error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch preferences' } });
  }
};

/**
 * PATCH /api/notifications/preferences
 * Update current user notification preferences
 */
export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = updatePreferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.issues[0].message } });
      return;
    }

    const {
      attendanceNotifications,
      leaveNotifications,
      payrollNotifications,
      announcementNotifications,
      pushNotifications,
      emailNotifications,
      attendance_alerts,
      leave_alerts,
      payroll_alerts,
      announcements,
      push_enabled,
      email_enabled,
    } = parsed.data;

    const finalAttendance = attendanceNotifications !== undefined ? attendanceNotifications : attendance_alerts;
    const finalLeave = leaveNotifications !== undefined ? leaveNotifications : leave_alerts;
    const finalPayroll = payrollNotifications !== undefined ? payrollNotifications : payroll_alerts;
    const finalAnnouncement = announcementNotifications !== undefined ? announcementNotifications : announcements;
    const finalPush = pushNotifications !== undefined ? pushNotifications : push_enabled;
    const finalEmail = emailNotifications !== undefined ? emailNotifications : email_enabled;

    // Upsert preferences
    const upsertSql = `
      INSERT INTO notification_preferences (
        user_id, attendance_notifications, leave_notifications,
        payroll_notifications, announcement_notifications, push_notifications, email_notifications, updated_at
      ) VALUES (
        $1, COALESCE($2, TRUE), COALESCE($3, TRUE),
        COALESCE($4, TRUE), COALESCE($5, TRUE), COALESCE($6, TRUE), COALESCE($7, FALSE), CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        attendance_notifications = COALESCE($2, notification_preferences.attendance_notifications),
        leave_notifications = COALESCE($3, notification_preferences.leave_notifications),
        payroll_notifications = COALESCE($4, notification_preferences.payroll_notifications),
        announcement_notifications = COALESCE($5, notification_preferences.announcement_notifications),
        push_notifications = COALESCE($6, notification_preferences.push_notifications),
        email_notifications = COALESCE($7, notification_preferences.email_notifications),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await query(upsertSql, [
      userId,
      finalAttendance,
      finalLeave,
      finalPayroll,
      finalAnnouncement,
      finalPush,
      finalEmail,
    ]);

    const row = result.rows[0];
    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        attendanceNotifications: row.attendance_notifications,
        leaveNotifications: row.leave_notifications,
        payrollNotifications: row.payroll_notifications,
        announcementNotifications: row.announcement_notifications,
        pushNotifications: row.push_notifications,
        emailNotifications: row.email_notifications,
        attendance_alerts: row.attendance_notifications,
        leave_alerts: row.leave_notifications,
        payroll_alerts: row.payroll_notifications,
        announcements: row.announcement_notifications,
        push_enabled: row.push_notifications,
        email_enabled: row.email_notifications,
        in_app_enabled: true,
      },
    });
  } catch (error) {
    console.error('updatePreferences error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update preferences' } });
  }
};

/**
 * POST /api/notifications/push-token
 * Register device push token for Expo / mobile
 */
export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = pushTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.issues[0].message } });
      return;
    }

    const { token, platform } = parsed.data;

    // A device push token must strictly belong to the currently authenticated user
    await query(
      `INSERT INTO device_push_tokens (user_id, push_token, platform, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (push_token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, token, platform]
    );

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    console.error('registerPushToken error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to register push token' } });
  }
};

/**
 * DELETE /api/notifications/push-token
 * Unregister device push token on logout
 */
export const unregisterPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { token } = req.body || {};

    if (token) {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1 AND push_token = $2`,
        [userId, token]
      );
    } else {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1`,
        [userId]
      );
    }

    res.json({ success: true, message: 'Push token unregistered successfully' });
  } catch (error) {
    console.error('unregisterPushToken error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to unregister push token' } });
  }
};

/**
 * GET /api/notifications/stream
 * Server-Sent Events (SSE) endpoint for instant real-time notification push
 */
export const notificationStream = (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial ping to keep connection alive
  res.write(`data: ${JSON.stringify({ event: 'connected', userId })}\n\n`);

  // Register with SSEManager
  NotificationService.registerSSEClient(userId, res);
};

const broadcastSchema = z.object({
  title: z.string().optional().default('📢 Company Announcement'),
  message: z.string().min(3, 'Announcement message is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().default('High'),
  target: z.enum(['all', 'employee', 'admin']).optional().default('all'),
});

/**
 * POST /api/notifications/broadcast
 * Broadcast company announcement to employees (Admin only)
 */
export const broadcastAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role?.toLowerCase() !== 'admin') {
      res.status(403).json({ success: false, error: { message: 'Only administrators can broadcast announcements' } });
      return;
    }

    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.issues[0].message } });
      return;
    }

    const { title, message, priority, target } = parsed.data;

    const result = await NotificationService.send({
      role: target as any,
      senderUserId: req.user!.id,
      title: title || '📢 Company Announcement',
      message,
      type: 'Announcement',
      priority: priority as any,
      actionUrl: '/notifications',
    });

    res.json({
      success: true,
      message: 'Announcement broadcasted successfully',
      data: { count: result.count },
    });
  } catch (error) {
    console.error('broadcastAnnouncement error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to broadcast announcement' } });
  }
};
