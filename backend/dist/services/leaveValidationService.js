"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveValidationService = void 0;
const db_1 = require("../db");
class LeaveValidationService {
    /**
     * Helper to parse YYYY-MM-DD date parts safely without UTC offset shifts
     */
    static parseDateString(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0); // Noon prevents any daylight savings shift
    }
    static formatDateString(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Format date for readable breakdown, e.g. "12 Sep (Saturday)"
     */
    static formatReadableDate(d) {
        const day = d.getDate();
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
        return `${day} ${month} (${weekday})`;
    }
    /**
     * Retrieve current leave settings
     */
    static async getLeaveSettings() {
        try {
            const res = await (0, db_1.query)('SELECT * FROM leave_settings WHERE id = 1');
            if (res.rows.length > 0) {
                const row = res.rows[0];
                let weeklyOffs = [0]; // Sunday default
                if (Array.isArray(row.weekly_off_days)) {
                    weeklyOffs = row.weekly_off_days;
                }
                else if (typeof row.weekly_off_days === 'string') {
                    try {
                        weeklyOffs = JSON.parse(row.weekly_off_days);
                    }
                    catch {
                        weeklyOffs = [0];
                    }
                }
                return {
                    enableHolidayValidation: row.enable_holiday_validation ?? true,
                    enableSundayValidation: row.enable_sunday_validation ?? true,
                    enableWeeklyOffValidation: row.enable_weekly_off_validation ?? true,
                    showLeaveImpactSummary: row.show_leave_impact_summary ?? true,
                    weeklyOffDays: weeklyOffs
                };
            }
        }
        catch (err) {
            console.warn('Error reading leave_settings, using defaults:', err);
        }
        return {
            enableHolidayValidation: true,
            enableSundayValidation: true,
            enableWeeklyOffValidation: true,
            showLeaveImpactSummary: true,
            weeklyOffDays: [0]
        };
    }
    /**
     * Update leave settings
     */
    static async updateLeaveSettings(settings) {
        const current = await this.getLeaveSettings();
        const updated = { ...current, ...settings };
        await (0, db_1.query)(`
      UPDATE leave_settings
      SET 
        enable_holiday_validation = $1,
        enable_sunday_validation = $2,
        enable_weekly_off_validation = $3,
        show_leave_impact_summary = $4,
        weekly_off_days = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
            updated.enableHolidayValidation,
            updated.enableSundayValidation,
            updated.enableWeeklyOffValidation,
            updated.showLeaveImpactSummary,
            JSON.stringify(updated.weeklyOffDays)
        ]);
        return updated;
    }
    /**
     * Analyze and validate leave dates before submission
     */
    static async validateLeaveRequest(employeeId, startDateStr, endDateStr) {
        const startDate = this.parseDateString(startDateStr);
        const endDate = this.parseDateString(endDateStr);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format. Expected YYYY-MM-DD.');
        }
        if (startDate > endDate) {
            return {
                isValid: false,
                canSubmit: false,
                blockReason: 'Start date must be on or before end date.',
                startDate: startDateStr,
                endDate: endDateStr,
                totalDays: 0,
                workingDays: 0,
                weeklyOffDays: 0,
                companyHolidays: 0,
                paidLeaveRequired: 0,
                balanceBefore: 0,
                balanceAfter: 0,
                lwpDays: 0,
                isLwpRequired: false,
                allWeeklyOffs: false,
                allCompanyHolidays: false,
                allNonWorkingDays: false,
                hasApprovedOverlap: false,
                hasPendingOverlap: false,
                isPastLeave: false,
                confirmationDialog: {
                    title: 'Invalid Leave Dates',
                    summaryMessage: 'Start date must be before or equal to end date.',
                    breakdownBulletPoints: [],
                    policyNote: '',
                    paidLeaveRequiredText: '0 Days',
                    balanceAfterText: '0 Days'
                },
                daysBreakdown: []
            };
        }
        // 1. Fetch Leave Settings
        const settings = await this.getLeaveSettings();
        // 2. Fetch Active Holidays within range
        const holidayRes = await (0, db_1.query)(`
      SELECT holiday_date, name 
      FROM holidays 
      WHERE is_active = true 
        AND holiday_date >= $1 
        AND holiday_date <= $2
    `, [startDateStr, endDateStr]);
        const holidayMap = new Map();
        for (const h of holidayRes.rows) {
            const hDateStr = this.formatDateString(new Date(h.holiday_date));
            holidayMap.set(hDateStr, h.name);
        }
        // 3. Fetch Overlapping Leave Requests
        const overlapRes = await (0, db_1.query)(`
      SELECT id, status, from_date, to_date, leave_type
      FROM leave_requests
      WHERE employee_id = $1
        AND status IN ('APPROVED', 'PENDING')
        AND from_date <= $2 
        AND to_date >= $3
    `, [employeeId, endDateStr, startDateStr]);
        let hasApprovedOverlap = false;
        let hasPendingOverlap = false;
        for (const req of overlapRes.rows) {
            if (req.status === 'APPROVED') {
                hasApprovedOverlap = true;
            }
            else if (req.status === 'PENDING') {
                hasPendingOverlap = true;
            }
        }
        // 4. Fetch Employee's Available Leave Balance
        const year = startDateStr.substring(0, 4);
        const balanceRes = await (0, db_1.query)(`
      SELECT current_balance, accrued_leave, used_paid_leave, leave_without_pay
      FROM leave_balances
      WHERE employee_id = $1 AND year = $2
    `, [employeeId, year]);
        let currentBalance = 0;
        if (balanceRes.rows.length > 0 && balanceRes.rows[0].current_balance !== null) {
            currentBalance = parseFloat(balanceRes.rows[0].current_balance);
        }
        // 5. Day-by-Day Analysis Loop
        const daysBreakdown = [];
        let workingDays = 0;
        let weeklyOffDays = 0;
        let companyHolidays = 0;
        let curr = new Date(startDate);
        while (curr <= endDate) {
            const dStr = this.formatDateString(curr);
            const dayOfWeekIdx = curr.getDay(); // 0 = Sunday, 6 = Saturday
            const dayOfWeekName = curr.toLocaleDateString('en-US', { weekday: 'long' });
            const readable = this.formatReadableDate(curr);
            const isHoliday = settings.enableHolidayValidation && holidayMap.has(dStr);
            const isSunday = dayOfWeekIdx === 0;
            const isSundayExempt = settings.enableSundayValidation && isSunday;
            const isWeeklyOffExempt = settings.enableWeeklyOffValidation &&
                settings.weeklyOffDays.includes(dayOfWeekIdx) &&
                (dayOfWeekIdx !== 0 || settings.enableSundayValidation);
            const isSundayOrWeeklyOff = isSundayExempt || isWeeklyOffExempt;
            if (isHoliday) {
                companyHolidays++;
                const hName = holidayMap.get(dStr);
                daysBreakdown.push({
                    date: dStr,
                    formattedDate: readable,
                    dayOfWeek: dayOfWeekName,
                    dayOfWeekIndex: dayOfWeekIdx,
                    category: 'COMPANY_HOLIDAY',
                    categoryLabel: `Company Holiday (${hName})`,
                    holidayName: hName,
                    consumesPaidLeave: false,
                    deductionText: 'No Leave Deduction',
                    badgeColor: 'orange'
                });
            }
            else if (isSundayOrWeeklyOff) {
                weeklyOffDays++;
                daysBreakdown.push({
                    date: dStr,
                    formattedDate: readable,
                    dayOfWeek: dayOfWeekName,
                    dayOfWeekIndex: dayOfWeekIdx,
                    category: 'WEEKLY_OFF',
                    categoryLabel: dayOfWeekIdx === 0 ? 'Sunday (Weekly Off)' : 'Weekly Off',
                    consumesPaidLeave: false,
                    deductionText: 'No Leave Deduction',
                    badgeColor: 'green'
                });
            }
            else {
                workingDays++;
                daysBreakdown.push({
                    date: dStr,
                    formattedDate: readable,
                    dayOfWeek: dayOfWeekName,
                    dayOfWeekIndex: dayOfWeekIdx,
                    category: 'WORKING_DAY',
                    categoryLabel: 'Working Day',
                    consumesPaidLeave: true,
                    deductionText: 'Paid Leave Applicable',
                    badgeColor: 'blue'
                });
            }
            curr.setDate(curr.getDate() + 1);
        }
        const totalDays = daysBreakdown.length;
        const paidLeaveRequired = workingDays;
        const isLwpRequired = paidLeaveRequired > currentBalance;
        const lwpDays = isLwpRequired ? paidLeaveRequired - currentBalance : 0;
        const balanceAfter = Math.max(0, currentBalance - paidLeaveRequired);
        const todayStr = this.formatDateString(new Date());
        const isPastLeave = startDateStr < todayStr;
        // 6. Detect Special Scenarios
        const allWeeklyOffs = totalDays > 0 && workingDays === 0 && companyHolidays === 0 && weeklyOffDays > 0;
        const allCompanyHolidays = totalDays > 0 && workingDays === 0 && weeklyOffDays === 0 && companyHolidays > 0;
        const allNonWorkingDays = totalDays > 0 && workingDays === 0;
        let canSubmit = true;
        let blockReason = undefined;
        if (hasApprovedOverlap) {
            canSubmit = false;
            blockReason = 'You already have approved leave on these dates.';
        }
        else if (hasPendingOverlap) {
            canSubmit = false;
            blockReason = 'You already have a pending leave request covering these dates.';
        }
        // Special Notice Definition
        let specialNotice = undefined;
        if (hasApprovedOverlap) {
            specialNotice = {
                title: 'Leave Overlap Detected',
                message: 'You already have approved leave on these dates.',
                type: 'ERROR',
                requiresConfirmation: false
            };
        }
        else if (hasPendingOverlap) {
            specialNotice = {
                title: 'Pending Request Overlap',
                message: 'You already have a pending leave request covering these dates.',
                type: 'ERROR',
                requiresConfirmation: false
            };
        }
        else if (allWeeklyOffs) {
            specialNotice = {
                title: 'Weekly Off Selection',
                message: 'The selected dates are Weekly Offs. No paid leave will be deducted. Do you still want to submit this request?',
                type: 'INFO',
                requiresConfirmation: true
            };
        }
        else if (allCompanyHolidays) {
            specialNotice = {
                title: 'Company Holiday Selection',
                message: 'The selected dates are Company Holidays. No paid leave will be deducted. Do you still want to continue?',
                type: 'INFO',
                requiresConfirmation: true
            };
        }
        else if (allNonWorkingDays) {
            specialNotice = {
                title: 'Non-Working Days Selection',
                message: 'The selected dates consist only of Weekly Offs and Company Holidays. No paid leave will be deducted. Do you still want to continue?',
                type: 'INFO',
                requiresConfirmation: true
            };
        }
        else if (isLwpRequired) {
            specialNotice = {
                title: 'Insufficient Leave Balance',
                message: `Requested Leave: ${paidLeaveRequired} Days\nAvailable Balance: ${currentBalance} Days\nThe remaining ${lwpDays} day(s) will be marked as Leave Without Pay (LWP) according to company policy. Continue?`,
                type: 'WARNING',
                requiresConfirmation: true
            };
        }
        // Confirmation Dialog structure matching specification
        const bulletPoints = [];
        if (workingDays > 0)
            bulletPoints.push(`${workingDays} Working Day${workingDays > 1 ? 's' : ''}`);
        if (weeklyOffDays > 0)
            bulletPoints.push(`${weeklyOffDays} Weekly Off${weeklyOffDays > 1 ? 's' : ''}`);
        if (companyHolidays > 0)
            bulletPoints.push(`${companyHolidays} Company Holiday${companyHolidays > 1 ? 's' : ''}`);
        const confirmationDialog = {
            title: 'Leave Impact Analysis',
            summaryMessage: `Your leave request includes:\n• ${bulletPoints.join('\n• ')}`,
            breakdownBulletPoints: bulletPoints,
            policyNote: 'Only the working days will consume your paid leave balance according to company policy.',
            paidLeaveRequiredText: `${paidLeaveRequired} Day${paidLeaveRequired === 1 ? '' : 's'}`,
            balanceAfterText: `${balanceAfter} Day${balanceAfter === 1 ? '' : 's'}`,
            lwpWarningText: isLwpRequired
                ? `Notice: Your current balance (${currentBalance} days) is insufficient for ${paidLeaveRequired} working days. The remaining ${lwpDays} day(s) will be recorded as Leave Without Pay (LWP).`
                : undefined
        };
        return {
            isValid: true,
            canSubmit,
            blockReason,
            startDate: startDateStr,
            endDate: endDateStr,
            totalDays,
            workingDays,
            weeklyOffDays,
            companyHolidays,
            paidLeaveRequired,
            balanceBefore: currentBalance,
            balanceAfter,
            lwpDays,
            isLwpRequired,
            allWeeklyOffs,
            allCompanyHolidays,
            allNonWorkingDays,
            hasApprovedOverlap,
            hasPendingOverlap,
            isPastLeave,
            specialNotice,
            confirmationDialog,
            daysBreakdown
        };
    }
}
exports.LeaveValidationService = LeaveValidationService;
