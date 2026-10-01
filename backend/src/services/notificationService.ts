import { Response } from 'express';
import { query } from '../db';

export type NotificationType =
  | 'Attendance'
  | 'Leave'
  | 'Payroll'
  | 'Expense'
  | 'Profile'
  | 'Employee'
  | 'Announcement'
  | 'System'
  | 'Security'
  | 'Reminder';

export type NotificationPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SendNotificationPayload {
  recipientUserId?: number;
  role?: 'admin' | 'employee' | 'all';
  senderUserId?: number;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  icon?: string;
  attendanceDate?: string;
  metadata?: Record<string, any>;
}

// In-Memory SSE Client Manager for real-time streaming
class SSEManager {
  private static clients: Map<number, Set<Response>> = new Map();

  public static addClient(userId: number, res: Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(res);

    res.on('close', () => {
      const userClients = this.clients.get(userId);
      if (userClients) {
        userClients.delete(res);
        if (userClients.size === 0) {
          this.clients.delete(userId);
        }
      }
    });
  }

  public static sendToUser(userId: number, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.size > 0) {
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach((client) => {
        try {
          client.write(payload);
        } catch (e) {
          console.warn(`Failed to write SSE to client ${userId}:`, e);
        }
      });
    }
  }

  public static sendToAll(data: any) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach((userClients) => {
      userClients.forEach((client) => {
        try {
          client.write(payload);
        } catch (e) {
          // Ignore
        }
      });
    });
  }
}

export class NotificationService {
  /**
   * Register an SSE client for real-time notification push
   */
  public static registerSSEClient(userId: number, res: Response) {
    SSEManager.addClient(userId, res);
  }

  /**
   * Send a smart notification across all enabled channels
   */
  public static async send(payload: SendNotificationPayload): Promise<any> {
    try {
      const priority = payload.priority || 'Medium';
      const role = payload.role || 'employee';

      // 1. Determine recipients
      let targetUserIds: number[] = [];

      if (payload.recipientUserId) {
        targetUserIds = [payload.recipientUserId];
      } else if (role === 'admin') {
        const adminsRes = await query(`SELECT id FROM users WHERE (role = 'admin' OR (roles IS NOT NULL AND roles @> '["admin"]'::jsonb)) AND status = 'active'`);
        targetUserIds = adminsRes.rows.map((r) => r.id);
      } else if (role === 'all') {
        const usersRes = await query(`SELECT id FROM users WHERE status = 'active'`);
        targetUserIds = usersRes.rows.map((r) => r.id);
      } else if (role === 'employee') {
        const empsRes = await query(`SELECT id FROM users WHERE (role = 'employee' OR (roles IS NOT NULL AND roles @> '["employee"]'::jsonb) OR roles IS NULL) AND status = 'active'`);
        targetUserIds = empsRes.rows.map((r) => r.id);
      }

      if (targetUserIds.length === 0) {
        return { success: true, count: 0 };
      }

      // 2. Fetch user preferences in batch
      const prefsRes = await query(
        `SELECT user_id, attendance_notifications, leave_notifications, 
                payroll_notifications, announcement_notifications, push_notifications, email_notifications 
         FROM notification_preferences 
         WHERE user_id = ANY($1::int[])`,
        [targetUserIds]
      );

      const prefMap = new Map<number, any>();
      prefsRes.rows.forEach((r) => prefMap.set(r.user_id, r));

      const insertedNotifications: any[] = [];
      const pushQueue: { token: string; title: string; body: string; data: any }[] = [];

      // 3. Process each recipient
      for (const userId of targetUserIds) {
        const prefs = prefMap.get(userId);

        // Check if category notifications are allowed (Critical priority bypasses user preferences)
        if (prefs && priority !== 'Critical') {
          if (payload.type === 'Attendance' && prefs.attendance_notifications === false) continue;
          if (payload.type === 'Leave' && prefs.leave_notifications === false) continue;
          if (payload.type === 'Payroll' && prefs.payroll_notifications === false) continue;
          if (payload.type === 'Announcement' && prefs.announcement_notifications === false) continue;
        }

        // Insert into database
        // Populate both recipient_user_id and legacy employee_id for complete backward compatibility
        const insertSql = `
          INSERT INTO notifications (
            recipient_user_id, employee_id, sender_user_id, role,
            title, message, type, priority, action_url, icon,
            attendance_date, is_read, created_at, updated_at, sent_at
          ) VALUES (
            $1, $1, $2, $3,
            $4, $5, $6, $7, $8, $9,
            $10, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING *;
        `;

        const values = [
          userId,
          payload.senderUserId || null,
          role,
          payload.title,
          payload.message,
          payload.type,
          priority,
          payload.actionUrl || null,
          payload.icon || this.getDefaultIcon(payload.type),
          payload.attendanceDate || null,
        ];

        const notifRes = await query(insertSql, values);
        const record = notifRes.rows[0];
        insertedNotifications.push(record);

        // 4. Send Real-Time SSE Event
        SSEManager.sendToUser(userId, {
          event: 'notification',
          type: 'new_notification',
          notification: record,
        });

        // 5. Check Push Notification capability
        const shouldPush = !prefs || prefs.push_notifications !== false;
        if (shouldPush) {
          const tokenRes = await query(`SELECT push_token FROM device_push_tokens WHERE user_id = $1`, [userId]);
          tokenRes.rows.forEach((t) => {
            if (t.push_token) {
              pushQueue.push({
                token: t.push_token,
                title: payload.title,
                body: payload.message,
                data: {
                  url: payload.actionUrl,
                  type: payload.type,
                  priority,
                  notificationId: record.id,
                },
              });
            }
          });
        }

        // 6. Stub for future email notifications
        if (prefs && prefs.email_notifications) {
          this.sendEmailNotification(userId, payload).catch((err) =>
            console.warn('Email notification stub error:', err)
          );
        }
      }

      // Asynchronously process push queue without blocking response
      if (pushQueue.length > 0) {
        this.dispatchExpoPushNotifications(pushQueue).catch((err) =>
          console.warn('Push notification dispatch error:', err)
        );
      }

      return { success: true, count: insertedNotifications.length, data: insertedNotifications };
    } catch (error) {
      console.error('NotificationService.send error:', error);
      return { success: false, error };
    }
  }

  /**
   * Helper: Notify a specific user
   */
  public static async notifyUser(userId: number, payload: Omit<SendNotificationPayload, 'recipientUserId'>) {
    return this.send({ ...payload, recipientUserId: userId });
  }

  /**
   * Helper: Notify all active administrators
   */
  public static async notifyAdmins(payload: Omit<SendNotificationPayload, 'role'>) {
    return this.send({ ...payload, role: 'admin' });
  }

  /**
   * Helper: Notify all users
   */
  public static async notifyAll(payload: Omit<SendNotificationPayload, 'role'>) {
    return this.send({ ...payload, role: 'all' });
  }

  /**
   * Dispatch Expo Push Notifications
   */
  private static async dispatchExpoPushNotifications(
    messages: { token: string; title: string; body: string; data: any }[]
  ): Promise<void> {
    const validExpoMessages = messages
      .filter((m) => m.token && (m.token.startsWith('ExponentPushToken') || m.token.startsWith('ExpoPushToken') || m.token.includes('[')))
      .map((m) => ({
        to: m.token,
        sound: 'default',
        channelId: 'falcon-default',
        priority: 'high',
        badge: 1,
        title: m.title,
        body: m.body,
        data: m.data,
      }));

    if (validExpoMessages.length === 0) return;

    for (const msg of validExpoMessages) {
      try {
        const resp = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([msg]),
        });
        const result: any = await resp.json().catch(() => null);
        if (result?.data?.[0]?.status === 'ok') {
          console.log(`[Push Notification] Delivered to ${msg.to} (ID: ${result.data[0].id})`);
        } else if (result?.data?.[0]?.status === 'error') {
          const errDetail = result.data[0].details?.error;
          console.warn(`[Push Notification] Error for ${msg.to}:`, result.data[0].message);
          if (errDetail === 'DeviceNotRegistered') {
            query('DELETE FROM device_push_tokens WHERE push_token = $1', [msg.to]).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Expo push dispatch network error:', err);
      }
    }
  }

  /**
   * Future Email Dispatcher stub
   */
  private static async sendEmailNotification(userId: number, payload: SendNotificationPayload): Promise<void> {
    // Extensible email hook (ready for Nodemailer, AWS SES, or SendGrid)
    // console.log(`[Email Stub] Would send email to user ${userId}: ${payload.title}`);
  }

  /**
   * Resolve default iconography
   */
  private static getDefaultIcon(type: NotificationType): string {
    switch (type) {
      case 'Attendance':
        return 'clock';
      case 'Leave':
        return 'calendar';
      case 'Payroll':
        return 'dollar-sign';
      case 'Profile':
        return 'user';
      case 'Announcement':
        return 'megaphone';
      case 'System':
        return 'server';
      case 'Security':
        return 'shield-alert';
      case 'Reminder':
        return 'bell';
      default:
        return 'bell';
    }
  }
}
