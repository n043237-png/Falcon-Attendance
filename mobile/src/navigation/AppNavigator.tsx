import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HolidayListScreen from '../screens/HolidayListScreen';
import TabNavigator from './TabNavigator';
import { notificationSync } from '../services/notificationSyncService';
import { handleNotificationUrl } from '../services/pushNotificationService';
import { navigationRef } from '../../App';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (token) {
      notificationSync.start(token);
    } else {
      notificationSync.stop();
    }
  }, [token]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Push Notification Tapped]:', response.notification.request.content.title, data);
      if (navigationRef.isReady() && data?.url) {
        handleNotificationUrl(data.url, (screen) => navigationRef.navigate(screen as never));
      }
    });

    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token == null ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="HolidayList" component={HolidayListScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
