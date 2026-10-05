import axios from 'axios';
import { Platform } from 'react-native';
import { LocationValidationResponse } from './locationApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export interface AttendanceRecord {
  attendanceId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  workingMinutes: number;
  status: string;
  isLate?: boolean;
  attendanceMode?: string;
  checkInAddress?: string | null;
  checkInSelfieUrl?: string | null;
  checkOutAddress?: string | null;
  checkOutSelfieUrl?: string | null;
  holidayName?: string | null;
  leaveType?: string | null;
}

export interface TodayResponse {
  success: boolean;
  data?: {
    attendanceMode?: string;
    attendance: AttendanceRecord | null;
    shift?: {
      shiftId: number;
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes: number;
      lateAfter: string;
    } | null;
    office?: {
      id: number;
      name: string;
      radiusMeters: number;
    } | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const checkIn = async (
  latitude: number,
  longitude: number,
  accuracy: number,
  token: string,
  address?: string,
  selfie?: string
) => {
  try {
    const res = await axios.post(`${API_URL}/api/attendance/check-in`, 
      { latitude, longitude, accuracy, address, selfie },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch (error: any) {
    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data === 'string') {
        const msg = error.response.status === 413
          ? 'Image file is too large. Please retake the selfie and try again.'
          : (data.includes('<title>') ? 'Server error occurred. Please try again.' : data);
        return { success: false, error: { message: msg } };
      }
      return data;
    }
    return { success: false, error: { message: error.message || 'No internet connection.' } };
  }
};

export const checkOut = async (
  latitude: number,
  longitude: number,
  accuracy: number,
  token: string,
  address?: string,
  selfie?: string
) => {
  try {
    const res = await axios.post(`${API_URL}/api/attendance/check-out`, 
      { latitude, longitude, accuracy, address, selfie },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch (error: any) {
    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data === 'string') {
        const msg = error.response.status === 413
          ? 'Image file is too large. Please retake the selfie and try again.'
          : (data.includes('<title>') ? 'Server error occurred. Please try again.' : data);
        return { success: false, error: { message: msg } };
      }
      return data;
    }
    return { success: false, error: { message: error.message || 'No internet connection.' } };
  }
};

export const getTodayAttendance = async (token: string): Promise<TodayResponse> => {
  try {
    const res = await axios.get(`${API_URL}/api/attendance/today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection.' } };
  }
};

export const getAttendanceHistory = async (token: string, page = 1, limit = 20, year?: number, month?: number) => {
  try {
    let url = `${API_URL}/api/attendance/history?page=${page}&limit=${limit}`;
    if (year !== undefined && month !== undefined) {
      url += `&year=${year}&month=${month}`;
    }
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection.' } };
  }
};

export const getAttendanceSummary = async (token: string, year: number, month: number) => {
  try {
    const res = await axios.get(`${API_URL}/api/attendance/summary?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection.' } };
  }
};

export const getAttendanceCalendar = async (token: string, year: number, month: number) => {
  try {
    const res = await axios.get(`${API_URL}/api/attendance/calendar?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'No internet connection.' } };
  }
};

