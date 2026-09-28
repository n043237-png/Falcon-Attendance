import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

interface User {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  profilePhotoUrl?: string;
  profile_photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (fields: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define API URL. In a real app, use environment variables. 
// For local development on Android emulator, 10.0.2.2 points to host machine.
// For iOS Simulator, localhost works.
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../services/pushNotificationService';
const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('userToken');
        if (storedToken) {
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          
          const role = response.data.user?.role?.toLowerCase();
          if (role === 'employee' || role === 'admin') {
            setToken(storedToken);
            setUser(response.data.user);
            registerForPushNotificationsAsync(storedToken).catch((err) =>
              console.warn('[Push] Registration error:', err)
            );
          } else {
            await SecureStore.deleteItemAsync('userToken');
          }
        }
      } catch (error) {
        console.error('Restore session failed:', error);
        await SecureStore.deleteItemAsync('userToken');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    await SecureStore.setItemAsync('userToken', newToken);
    setToken(newToken);
    setUser(newUser);
    registerForPushNotificationsAsync(newToken).catch((err) =>
      console.warn('[Push] Registration error:', err)
    );
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setToken(null);
    setUser(null);
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : null));
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
