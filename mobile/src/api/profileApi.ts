import axios from 'axios';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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
    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const uploadUrl = `${base}/api/profile/photo`;

    if (Platform.OS !== 'web') {
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      let mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'photo',
        mimeType,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        return JSON.parse(uploadResult.body);
      } else {
        try {
          const parsed = JSON.parse(uploadResult.body);
          return parsed || { success: false, error: { message: `Upload failed with status ${uploadResult.status}` } };
        } catch (_) {
          return { success: false, error: { message: `Upload failed with status ${uploadResult.status}` } };
        }
      }
    } else {
      const res = await fetch(uri);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('photo', blob, 'profile.jpg');

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      return data;
    }
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

