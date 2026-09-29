import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from '../api/notificationApi';

// Set global notification presentation options when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure notification channel with MAX priority so alerts pop up over other apps
 */
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('falcon-default', {
      name: 'Falcon Attendance Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }
}

// Ensure channel is registered immediately on app launch
setupNotificationChannel().catch((err) => console.warn('[Push] Channel init error:', err));

/**
 * Register device for Expo Push Notifications and save token to backend
 */
export async function registerForPushNotificationsAsync(authToken: string): Promise<string | null> {
  if (!authToken) return null;

  try {
    // 1. Setup notification channel
    await setupNotificationChannel();

    // 2. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Push] Push notification permission not granted');
      return null;
    }

    // 3. Physical device check
    if (!Device.isDevice) {
      console.log('[Push] Running on emulator/simulator; local notifications active');
      return null;
    }

    // 4. Get Project ID & Expo Push Token
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        '8542a6b4-323b-4bac-b3e8-42a5ba83b624';

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenResponse.data;

      if (pushToken) {
        console.log('[Push] Registered Expo Push Token:', pushToken);
        await registerPushToken(pushToken, Platform.OS, authToken);
        return pushToken;
      }
    } catch (e: any) {
      console.log('[Push] Remote Expo push token unavailable (local notifications active):', e?.message || e);
    }

    return null;
  } catch (error) {
    console.error('[Push] Failed to register push token:', error);
    return null;
  }
}

/**
 * Helper to parse "HH:mm" or "HH:mm:ss" string to minutes from midnight
 */
function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Schedule recurring daily reminders 5 minutes before late mark and 5 minutes before shift end (logout)
 */
export async function scheduleLocalShiftReminders(
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  graceMinutes: number = 15,
  lateAfter?: string | null
) {
  try {
    await setupNotificationChannel();

    // Cancel previously scheduled shift reminders first to prevent duplicates
    try {
      await Notifications.cancelScheduledNotificationAsync('falcon-late-mark-reminder');
    } catch {}
    try {
      await Notifications.cancelScheduledNotificationAsync('falcon-shift-end-reminder');
    } catch {}

    // 1. Calculate 5 minutes before late mark threshold
    let lateMarkMinutes: number | null = parseTimeToMinutes(lateAfter);
    if (lateMarkMinutes === null && shiftStartTime) {
      const startMin = parseTimeToMinutes(shiftStartTime);
      if (startMin !== null) {
        lateMarkMinutes = startMin + (graceMinutes || 15);
      }
    }

    if (lateMarkMinutes !== null) {
      const reminderMin = (lateMarkMinutes - 5 + 1440) % 1440;
      const hour = Math.floor(reminderMin / 60);
      const minute = reminderMin % 60;

      await Notifications.scheduleNotificationAsync({
        identifier: 'falcon-late-mark-reminder',
        content: {
          title: '⏰ 5 Mins Left: Check In Soon!',
          body: 'Only 5 minutes remaining before late mark! Please check in now to avoid late penalty.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { url: '/attendance' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'falcon-default',
        },
      });
      console.log(`[Push] Scheduled daily pre-late reminder at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }

    // 2. Calculate 5 minutes before shift end (logout reminder)
    const endMinutes = parseTimeToMinutes(shiftEndTime);
    if (endMinutes !== null) {
      const logoutRemMin = (endMinutes - 5 + 1440) % 1440;
      const hour = Math.floor(logoutRemMin / 60);
      const minute = logoutRemMin % 60;

      await Notifications.scheduleNotificationAsync({
        identifier: 'falcon-shift-end-reminder',
        content: {
          title: '⏰ 5 Mins Left: Shift Ending Soon',
          body: 'Your shift ends in 5 minutes! Remember to mark Check-Out before leaving.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { url: '/attendance' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'falcon-default',
        },
      });
      console.log(`[Push] Scheduled daily pre-logout reminder at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  } catch (error) {
    console.warn('[Push] Error scheduling local shift reminders:', error);
  }
}

/**
 * Handle notification tap navigation
 */
export function handleNotificationUrl(url?: string | null, navigate?: (screen: string) => void) {
  if (!url || !navigate) return;

  const normalized = url.toLowerCase();
  if (normalized.includes('attendance') || normalized.includes('check-in')) {
    navigate('Home');
  } else if (normalized.includes('leave')) {
    navigate('Leave');
  } else if (normalized.includes('notif') || normalized.includes('announcement')) {
    navigate('Notifications');
  } else {
    navigate('Notifications');
  }
}

/**
 * Triggers an immediate heads-up notification test to verify device push alerts
 */
export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  try {
    await setupNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {
        success: false,
        message: 'Notification permission is disabled. Please enable it in Android Settings > Apps > Falcon Attendance > Notifications.'
      };
    }

    // Schedule notification immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Falcon Attendance',
        body: '✅ Test Notification: This is how your attendance alerts and announcements pop up on your phone!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data: { url: '/attendance' },
      },
      trigger: null,
    });

    return {
      success: true,
      message: 'Test notification sent! Check your status bar & notification tray.'
    };
  } catch (error: any) {
    console.error('[Push] Test notification error:', error);
    return {
      success: false,
      message: error?.message || 'Failed to trigger test notification'
    };
  }
}

