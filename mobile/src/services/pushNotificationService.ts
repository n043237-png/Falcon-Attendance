import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from '../api/notificationApi';

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
 * Configure notification channels with MAX priority so alerts pop up over other apps
 * Includes fcm_fallback_notification_channel used by Firebase Console by default.
 */
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    // 1. Primary Falcon App Channel
    await Notifications.setNotificationChannelAsync('falcon-default', {
      name: 'Falcon Attendance Alerts',
      description: 'Heads-up pop-up alerts for attendance, shifts, and leaves',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    // 2. Fallback channel targeted by Firebase Console notifications
    await Notifications.setNotificationChannelAsync('fcm_fallback_notification_channel', {
      name: 'Firebase Console Notifications',
      description: 'Pop-up broadcast messages sent from Firebase Console',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    // 3. Generic default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Alerts',
      description: 'Standard pop-up alert notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

// Ensure channels are registered immediately on app launch
setupNotificationChannel().catch((err) => console.warn('[Push] Channel init error:', err));

let cachedFcmToken: string | null = null;

/**
 * Retrieve native Firebase Device Registration Token (FCM token)
 * for testing directly in Firebase Console > Cloud Messaging > Send test message
 */
export async function getNativeFcmToken(): Promise<string | null> {
  if (cachedFcmToken) return cachedFcmToken;
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (deviceToken?.data) {
      cachedFcmToken = typeof deviceToken.data === 'string' ? deviceToken.data : JSON.stringify(deviceToken.data);
      console.log('[FCM] Native Firebase Registration Token for Firebase Console:', cachedFcmToken);
      return cachedFcmToken;
    }
  } catch (err: any) {
    console.warn('[FCM] Error fetching native device push token:', err?.message || err);
  }
  return null;
}

/**
 * Register device for Expo Push Notifications and save token to backend
 */
export async function registerForPushNotificationsAsync(authToken: string): Promise<string | null> {
  if (!authToken) return null;

  // Pre-fetch native FCM token in background
  getNativeFcmToken().catch((e) => console.log('[FCM] Initial check:', e));

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

    // 3. Physical device check (don't hard-crash if Device.isDevice has issues)
    if (Device && Device.isDevice === false && !__DEV__) {
      console.log('[Push] Running on emulator/simulator; local notifications active');
      return null;
    }

    // 4. Get Project ID & Expo Push Token
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        '5db1250c-a74c-4d1d-8553-9f60acbaeee0';

      console.log('[Push] Fetching push token for projectId:', projectId);
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenResponse?.data;

      if (pushToken) {
        console.log('[Push] Successfully obtained push token:', pushToken);
        const res = await registerPushToken(pushToken, Platform.OS, authToken);
        console.log('[Push] Registered with backend:', res?.success ? 'SUCCESS' : res);
        return pushToken;
      }
    } catch (e: any) {
      console.warn('[Push] Remote Expo push token error:', e?.message || e);
    }

    return null;
  } catch (error) {
    console.error('[Push] Failed to register push token:', error);
    return null;
  }
}

/**
 * Unregister device push token from backend on logout and cancel scheduled shift reminders
 */
export async function unregisterPushNotificationsAsync(authToken?: string | null): Promise<void> {
  try {
    // 1. Cancel all local scheduled notifications (shift reminders, late mark reminders)
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Push] Cancelled all local scheduled notifications on logout');

    // 2. Unregister token on backend
    if (authToken) {
      let pushToken: string | null = null;
      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          '5db1250c-a74c-4d1d-8553-9f60acbaeee0';
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = tokenResponse.data;
      } catch (e) {
        // ignore token fetch error if offline or permissions revoked
      }

      await unregisterPushToken(pushToken, authToken);
      console.log('[Push] Unregistered push token on backend successfully');
    }
  } catch (err) {
    console.warn('[Push] Error unregistering push notifications on logout:', err);
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

function formatMinutesTo12Hour(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

export async function cancelLateMarkReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync('falcon-late-mark-reminder');
    console.log('[Push] Cancelled pre-late check-in reminder');
  } catch (err) {
    console.warn('[Push] Error cancelling late mark reminder:', err);
  }
}

export async function cancelShiftEndReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync('falcon-shift-end-reminder');
    console.log('[Push] Cancelled pre-logout check-out reminder');
  } catch (err) {
    console.warn('[Push] Error cancelling shift end reminder:', err);
  }
}

/**
 * Schedule recurring daily reminders 5 minutes before late mark and 5 minutes before shift end (logout).
 * Only schedules if the user has NOT already marked attendance/checkout for today.
 */
export async function scheduleLocalShiftReminders(
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  graceMinutes: number = 15,
  lateAfter?: string | null,
  isCheckedIn: boolean = false,
  isCheckedOut: boolean = false
) {
  try {
    await setupNotificationChannel();

    // 1. Check-In reminder: Cancel if already checked in today
    if (isCheckedIn) {
      await cancelLateMarkReminder();
    } else {
      await cancelLateMarkReminder();

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
        const formattedLate = formatMinutesTo12Hour(lateMarkMinutes);

        // Only schedule if reminder time is in the future for today
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        if (currentMins < reminderMin) {
          await Notifications.scheduleNotificationAsync({
            identifier: 'falcon-late-mark-reminder',
            content: {
              title: 'Check-in Reminder',
              body: "You haven't marked your attendance yet. Please check in before 10:00 AM.",
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
          console.log(`[Push] Scheduled daily check-in reminder at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (deadline: ${formattedLate})`);
        }
      }
    }

    // 2. Check-out reminder: Only schedule if checked in AND not checked out
    if (!isCheckedIn || isCheckedOut) {
      await cancelShiftEndReminder();
    } else {
      await cancelShiftEndReminder();

      const endMinutes = parseTimeToMinutes(shiftEndTime) || 18 * 60 + 30; // 6:30 PM (18:30)
      if (endMinutes !== null) {
        const hour = Math.floor(endMinutes / 60);
        const minute = endMinutes % 60;

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        if (currentMins < endMinutes) {
          await Notifications.scheduleNotificationAsync({
            identifier: 'falcon-shift-end-reminder',
            content: {
              title: 'Check-out Reminder',
              body: "Your shift has ended. Please remember to check out.",
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
          console.log(`[Push] Scheduled daily check-out reminder at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (shift end: 6:30 PM)`);
        }
      }
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

