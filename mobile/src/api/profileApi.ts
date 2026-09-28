import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export const resolvePhotoUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();

  // If local file or base64 data
  if (trimmed.startsWith('data:') || trimmed.startsWith('file://')) {
    return trimmed;
  }

  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  // If path contains backend /uploads/ directory (e.g. /uploads/profiles/... or http://localhost:3000/uploads/profiles/...)
  const uploadsIndex = trimmed.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    const uploadPath = trimmed.substring(uploadsIndex);
    return `${base}${uploadPath}`;
  }

  // If full external URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it points to loopback or emulator host, map to actual mobile API_URL
    if (trimmed.includes('localhost:') || trimmed.includes('127.0.0.1:') || trimmed.includes('10.0.2.2:')) {
      const pathPart = trimmed.replace(/^https?:\/\/[^/]+/, '');
      return `${base}${pathPart.startsWith('/') ? '' : '/'}${pathPart}`;
    }
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${cleanPath}`;
};

export const getProfile = async (token: string) => {
  try {
    const res = await axios.get(`${API_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection. Please try again.' } };
  }
};

export const updateProfile = async (token: string, data: { phone?: string; profilePhotoUrl?: string }) => {
  try {
    const res = await axios.patch(`${API_URL}/api/profile`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection. Please try again.' } };
  }
};

export const changePassword = async (token: string, data: any) => {
  try {
    const res = await axios.patch(`${API_URL}/api/profile/change-password`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection. Please try again.' } };
  }
};

export const uploadProfilePhoto = async (token: string, uri: string) => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
    if (type === 'image/jpg') type = 'image/jpeg';

    formData.append('photo', {
      uri,
      name: filename,
      type,
    } as any);

    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const response = await fetch(`${base}/api/profile/photo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { success: false, error: { message: error.message || 'Failed to upload photo.' } };
  }
};

export const deleteProfilePhoto = async (token: string) => {
  try {
    const res = await axios.delete(`${API_URL}/api/profile/photo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to delete photo.' } };
  }
};

