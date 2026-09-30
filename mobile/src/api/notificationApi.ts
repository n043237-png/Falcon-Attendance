import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export interface Notification {
  id: number;
  recipientUserId?: number;
  senderUserId?: number;
  role?: string | null;
  title?: string;
  message: string;
  type: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  actionUrl?: string | null;
  icon?: string | null;
  isRead?: boolean;
  read_at?: string | null;
  createdAt?: string;
  created_at?: string;
  sentAt?: string;
  sent_at?: string;
  attendance_date?: string;
}

export const getNotifications = async (token: string, page = 1, limit = 50) => {
  try {
    const res = await axios.get(`${API_URL}/api/notifications?page=${page}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const markAsRead = async (id: number, token: string) => {
  try {
    const res = await axios.patch(`${API_URL}/api/notifications/${id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const markAllAsRead = async (token: string) => {
  try {
    const res = await axios.patch(`${API_URL}/api/notifications/read-all`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const registerPushToken = async (pushToken: string, platform: string, token: string) => {
  try {
    const res = await axios.post(
      `${API_URL}/api/notifications/push-token`,
      {
        token: pushToken,
        platform: platform === 'ios' ? 'ios' : 'android'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to register push token' } };
  }
};

export const unregisterPushToken = async (pushToken: string | null, token: string) => {
  try {
    const res = await axios.delete(
      `${API_URL}/api/notifications/push-token`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { token: pushToken }
      }
    );
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to unregister push token' } };
  }
};

