import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export interface HolidayItem {
  id: number;
  holidayDate: string; // YYYY-MM-DD
  name: string;
  description: string | null;
  day: string;
  isActive: boolean;
  isPast: boolean;
  isToday: boolean;
  isUpcoming: boolean;
  daysAway: number;
}

export interface HolidaysResponse {
  success: boolean;
  data?: HolidayItem[];
  error?: {
    message: string;
  };
}

export const getHolidays = async (token: string, year?: number): Promise<HolidaysResponse> => {
  try {
    const url = year ? `${API_URL}/api/holidays?year=${year}` : `${API_URL}/api/holidays`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || 'Failed to load company holidays',
      },
    };
  }
};
