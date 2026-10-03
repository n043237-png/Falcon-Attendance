import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { CustomAlertProvider } from './src/context/CustomAlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { handleNotificationUrl, clearLegacyRepeatingReminders } from './src/services/pushNotificationService';
import { notificationSync } from './src/services/notificationSyncService';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  useEffect(() => {
    // Clear any obsolete repeating offline alarms from older app versions
    clearLegacyRepeatingReminders();

    // Listen for notification tap / interaction
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url && navigationRef.isReady()) {
        handleNotificationUrl(url, (screen) => navigationRef.navigate(screen));
      }
    });

    // Listen for incoming notifications delivered while app is active or in background
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data;
      const notifId = data?.notificationId || data?.id;
      if (notifId) {
        notificationSync.markSeen(Number(notifId));
      }
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <CustomAlertProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef}>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </CustomAlertProvider>
    </SafeAreaProvider>
  );
}
