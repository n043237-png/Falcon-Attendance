import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CustomAlertProvider } from './src/context/CustomAlertContext';
import AppNavigator from './src/navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
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
