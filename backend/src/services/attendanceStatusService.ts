import { query } from '../db';

export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'HALF_DAY_LEAVE' | 'CHECKOUT_MISSING' | 'INSUFFICIENT_HOURS' | 'SUNDAY' | 'HOLIDAY';

export interface AttendanceResult {
  status: AttendanceStatus;
  isLate: boolean;
  workingMinutes: number;
  checkIn: Date | null;
  checkOut: Date | null;
  attendanceId: number | null;
}

export async function getAttendanceSettings() {
  const res = await query('SELECT * FROM attendance_settings WHERE id = 1');
  return res.rows[0];
}

// Helper to calculate status in JS to avoid massive SQL duplication
export function calculateStatus(
  dateStr: string,
  record: any, 
  settings: any, 
  holiday: any, 
  leave: any, 
  currentTime: Date = new Date(),
  shift?: any
): AttendanceResult {
  const result: AttendanceResult = {
    status: 'NOT_MARKED',
    isLate: false,
    workingMinutes: 0,
    checkIn: null,
    checkOut: null,
    attendanceId: null
  };

  // Extract raw attendance info if present
  if (record && record.check_in) {
    result.attendanceId = record.id;
    result.checkIn = new Date(record.check_in);
    if (record.check_out) result.checkOut = new Date(record.check_out);
    result.workingMinutes = record.working_minutes ? parseFloat(record.working_minutes) : 0;
    if (record.is_late !== undefined && record.is_late !== null) {
      result.isLate = !!record.is_late;
    }
  }

  // Parse time configuration
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const s = parts[2] ? parts[2].padStart(2, '0') : '00';
    return new Date(`${dateStr}T${h}:${m}:${s}+05:30`);
  };

  const effectiveLateThresholdStr = shift?.lateAfter || shift?.late_after || settings?.late_threshold || '10:15:00';
  const effectiveAbsenceCutoffStr = settings?.absence_cutoff || '11:00:00';
  const effectiveOfficeEndStr = shift?.endTime || shift?.end_time || settings?.office_end || '18:30:00';
  const effectiveFullDayMinutes = shift?.minimumWorkHours ? shift.minimumWorkHours * 60 : (shift?.minimum_work_hours ? shift.minimum_work_hours * 60 : (settings?.full_day_minutes || 480));
  const effectiveHalfDayMinutes = shift?.halfDayMinutes || shift?.half_day_minutes || settings?.half_day_minutes || 240;

  const lateThreshold = parseTime(effectiveLateThresholdStr);
  const absenceCutoff = parseTime(effectiveAbsenceCutoffStr);
  const officeEnd = parseTime(effectiveOfficeEndStr);

  const isWeekend = new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 0; // Sunday only
  const isHoliday = !!holiday;

  // 1. No check-in scenario
  if (!result.checkIn) {
    // If they have full day approved leave, they are ON_LEAVE
    if (leave && leave.status === 'APPROVED' && leave.leave_duration !== 'HALF_DAY') {
      result.status = 'ON_LEAVE';
      return result;
    }

    if (isWeekend) {
      result.status = 'SUNDAY';
      return result;
    }
    if (isHoliday) {
      result.status = 'HOLIDAY';
      (result as any).holidayName = holiday.name;
      return result;
    }
    
    if (currentTime > absenceCutoff) {
      result.status = 'ABSENT';
    }
    return result;
  }

  // 2. Check-in exists: Note if they had a half-day leave
  let hasHalfDayLeave = false;
  if (leave && leave.status === 'APPROVED' && leave.leave_duration === 'HALF_DAY') {
    hasHalfDayLeave = true;
    result.status = 'HALF_DAY_LEAVE'; 
  }

  // 3. Late Check (if not already set from DB record)
  if (record && (record.is_late !== undefined && record.is_late !== null)) {
    result.isLate = !!record.is_late;
  } else if (result.checkIn > lateThreshold) {
    result.isLate = true;
  }

  // 4. Missing Checkout
  if (!result.checkOut) {
    if (currentTime > officeEnd) {
      result.status = 'CHECKOUT_MISSING';
    } else {
      // Preserve HALF_DAY_LEAVE if applicable, otherwise PRESENT
      result.status = hasHalfDayLeave ? 'HALF_DAY_LEAVE' : 'PRESENT';
    }
    return result;
  }

  // 5. Working Hours Calculation (Required working time: 510 minutes / 8h 30m)
  if (result.workingMinutes >= effectiveFullDayMinutes) {
    result.status = 'PRESENT';
  } else if (hasHalfDayLeave && result.workingMinutes >= effectiveHalfDayMinutes) {
    // If they have HALF_DAY_LEAVE, working half a day implies full compliance.
    result.status = 'PRESENT';
  } else if (result.workingMinutes >= effectiveHalfDayMinutes) {
    // Worked at least half day threshold (e.g. 255 mins / 4h 15m)
    result.status = 'HALF_DAY';
  } else {
    // Checked out before completing half day threshold
    result.status = 'INSUFFICIENT_HOURS';
  }

  return result;
}
