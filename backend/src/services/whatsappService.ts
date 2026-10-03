/**
 * WhatsApp Service - Permanently Disabled
 * All WhatsApp alerts and automated messages have been removed as requested.
 */

export interface LateEmployee {
  id: number;
  name: string;
  employeeId: string;
  department?: string | null;
}

export function formatLateAttendanceMessage(_employee: LateEmployee, _dateStr: string): string {
  return '';
}

export async function dispatchWhatsApp(_toPhone: string, _message: string): Promise<{ success: boolean; provider: string; response?: any }> {
  return { success: false, provider: 'Disabled' };
}

export async function sendLateAttendanceAlert(_employee: LateEmployee, _dateStr: string): Promise<boolean> {
  // Permanently disabled
  return false;
}

export async function checkAndSendLateAttendanceAlerts(_overrideDateStr?: string) {
  // Permanently disabled
  return {
    success: false,
    message: 'WhatsApp alerts have been completely disabled.',
    alertsSent: 0,
    alertedList: [],
    skippedList: []
  };
}
