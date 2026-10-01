import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { CustomAlertProvider } from './src/context/CustomAlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { handleNotificationUrl } from './src/services/pushNotificationService';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  useEffect(() => {
    // Listen for notification tap / interaction
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url && navigationRef.isReady()) {
        handleNotificationUrl(url, (screen) => navigationRef.navigate(screen));
      }
    });

    return () => {
      responseSub.remove();
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
