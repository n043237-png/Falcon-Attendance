import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getNotifications, Notification } from '../api/notificationApi';

class NotificationSyncService {
  private static instance: NotificationSyncService;
  private intervalId: any = null;
  private appStateSubscription: any = null;
  private seenIds = new Set<number>();
  private initialized = false;
  private currentToken: string | null = null;

  public static getInstance(): NotificationSyncService {
    if (!NotificationSyncService.instance) {
      NotificationSyncService.instance = new NotificationSyncService();
    }
    return NotificationSyncService.instance;
  }

  /**
   * Start syncing notifications for the authenticated user
   */
  public start(authToken: string) {
    if (!authToken) return;
    this.currentToken = authToken;

    // Run initial sync
    this.sync(true);

    // Periodically poll every 15 seconds
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.sync(false);
    }, 15000);

    // Sync when app returns to foreground
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          this.sync(false);
        }
      });
    }
  }

  /**
   * Stop syncing when logged out
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.seenIds.clear();
    this.initialized = false;
    this.currentToken = null;
  }

  /**
   * Mark a notification ID as seen so polling will not trigger a duplicate alert
   */
  public markSeen(id: number) {
    this.seenIds.add(id);
  }

  /**
   * Sync notifications from backend and trigger device notifications
   */
  public async sync(isFirstRun = false) {
    if (!this.currentToken) return;

    try {
      const res = await getNotifications(this.currentToken, 1, 15);
      if (!res || !res.success) return;

      const items: Notification[] = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);

      if (isFirstRun || !this.initialized) {
        // On initial startup, seed already existing notifications so we don't spam the user
        items.forEach((item) => this.seenIds.add(item.id));
        this.initialized = true;
        return;
      }

      // Find any new notifications not yet displayed on device
      for (const item of items) {
        if (!this.seenIds.has(item.id)) {
          this.seenIds.add(item.id);

          // Only alert for unread items and when the user is not actively inside the app
          const isUnread = item.isRead === false || (!item.read_at && item.isRead !== true);
          if (isUnread && AppState.currentState !== 'active') {
            await this.displaySystemNotification(item);
          }
        }
      }
    } catch (err) {
      // Quiet fail during background sync
      // console.warn('[NotificationSync] Sync error:', err);
    }
  }

  /**
   * Display native Android/iOS banner notification
   */
  private async displaySystemNotification(item: Notification) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `falcon-notif-${item.id}`,
        content: {
          title: item.title || 'Falcon Attendance Alert',
          body: item.message,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: {
            url: item.actionUrl || '/attendance',
            id: item.id,
          },
        },
        trigger: null,
      });
      console.log(`[NotificationSync] Displayed system alert: ${item.title}`);
    } catch (err) {
      console.warn('[NotificationSync] Failed to display notification banner:', err);
    }
  }
}

export const notificationSync = NotificationSyncService.getInstance();
