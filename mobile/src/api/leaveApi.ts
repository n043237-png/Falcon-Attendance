import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export interface LeaveBalance {
  accruedLeave: number;
  usedPaidLeave: number;
  leaveWithoutPay: number;
  currentBalance: number;
  lastCreditDate: string | null;
  eligible: boolean;
}

export interface LeaveRequest {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  employeeName?: string;
  employeeId?: string;
  profilePhotoUrl?: string | null;
  userId?: number;
}

export const getLeaveBalances = async (token: string) => {
  try {
    const res = await axios.get(`${API_URL}/api/leave/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const applyLeave = async (token: string, data: { startDate: string, endDate: string, reason: string }) => {
  try {
    const res = await axios.post(`${API_URL}/api/leave`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const getLeaveHistory = async (token: string, page = 1) => {
  try {
    const res = await axios.get(`${API_URL}/api/leave?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export const cancelLeaveRequest = async (token: string, id: number) => {
  try {
    const res = await axios.patch(`${API_URL}/api/leave/${id}/cancel`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error' } };
  }
};

export interface DayAnalysisMobile {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  dayOfWeekIndex: number;
  category: 'WORKING_DAY' | 'WEEKLY_OFF' | 'COMPANY_HOLIDAY' | 'CONFLICT';
  categoryLabel: string;
  holidayName?: string;
  consumesPaidLeave: boolean;
  deductionText: string;
  badgeColor: 'blue' | 'green' | 'orange' | 'red';
}

export interface LeaveValidationData {
  isValid: boolean;
  canSubmit: boolean;
  blockReason?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  workingDays: number;
  weeklyOffDays: number;
  companyHolidays: number;
  paidLeaveRequired: number;
  balanceBefore: number;
  balanceAfter: number;
  lwpDays: number;
  isLwpRequired: boolean;
  allWeeklyOffs: boolean;
  allCompanyHolidays: boolean;
  allNonWorkingDays: boolean;
  hasApprovedOverlap: boolean;
  hasPendingOverlap: boolean;
  isPastLeave: boolean;
  specialNotice?: {
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ERROR';
    requiresConfirmation: boolean;
  };
  confirmationDialog: {
    title: string;
    summaryMessage: string;
    breakdownBulletPoints: string[];
    policyNote: string;
    paidLeaveRequiredText: string;
    balanceAfterText: string;
    lwpWarningText?: string;
  };
  daysBreakdown: DayAnalysisMobile[];
}

export const validateLeave = async (token: string, params: { startDate: string; endDate: string }) => {
  try {
    const res = await axios.get(`${API_URL}/api/leave/validate`, {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Network error validating leave' } };
  }
};

export const getAdminLeaves = async (token: string, status?: string) => {
  try {
    let url = `${API_URL}/api/admin/leave?limit=100`;
    if (status && status !== 'ALL' && status !== 'All') url += `&status=${status}`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to fetch admin leaves' } };
  }
};

export const approveLeaveRequest = async (token: string, id: number, comments?: string) => {
  try {
    const res = await axios.patch(
      `${API_URL}/api/admin/leave/${id}/approve`,
      { comments },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to approve leave request' } };
  }
};

export const rejectLeaveRequest = async (token: string, id: number, comments?: string) => {
  try {
    const res = await axios.patch(
      `${API_URL}/api/admin/leave/${id}/reject`,
      { comments },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch (error: any) {
    return error.response?.data || { success: false, error: { message: 'Failed to reject leave request' } };
  }
};


