import { query } from '../db';
import { getAttendanceSettings } from './attendanceStatusService';

export interface PayrollSettings {
  id: number;
  calculation_method: 'WORKING_DAYS' | 'CALENDAR_DAYS' | 'FIXED_DAYS';
  fixed_working_days: number;
  weekly_offs: string; // e.g. "0" for Sunday
  late_deduction_rule: 'NONE' | 'THREE_LATE_HALF_DAY' | 'FOUR_LATE_HALF_DAY' | 'THREE_LATE_FULL_DAY';
  pf_enabled: boolean;
  pf_employee_percent: number;
  pf_employer_percent: number;
  pf_wage_ceiling: number;
  esic_enabled: boolean;
  esic_employee_percent: number;
  esic_employer_percent: number;
  esic_wage_limit: number;
  pt_enabled: boolean;
  default_pt_amount: number;
}

export interface EmployeeSalaryProfile {
  employee_id: number;
  monthly_ctc: number;
  basic_salary: number;
  hra: number;
  da: number;
  conveyance_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  pf_applicable: boolean;
  esic_applicable: boolean;
  pt_applicable: boolean;
  tds_percent: number;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  pan_number?: string;
  uan_number?: string;
  esic_number?: string;
}

export interface CalculatedPayrollItem {
  employee_id: number;
  employee_code: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  base_monthly_salary: number;
  daily_rate: number;
  total_days: number;
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  lwp_days: number;
  half_days: number;
  late_days: number;
  late_deduction_days: number;
  payable_days: number;
  earned_basic: number;
  earned_hra: number;
  earned_da: number;
  earned_conveyance: number;
  earned_medical: number;
  earned_special: number;
  bonus: number;
  incentive: number;
  overtime_pay: number;
  gross_pay: number;
  pf_deduction: number;
  esic_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  advance_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  notes?: string;
}

export class PayrollCalculationService {
  /**
   * Fetch current organization payroll settings
   */
  static async getSettings(): Promise<PayrollSettings> {
    const res = await query('SELECT * FROM payroll_settings WHERE id = 1');
    if (res.rows.length === 0) {
      // Create default
      const ins = await query(`
        INSERT INTO payroll_settings (id) 
        VALUES (1) 
        RETURNING *
      `);
      return this.mapSettings(ins.rows[0]);
    }
    return this.mapSettings(res.rows[0]);
  }

  private static mapSettings(row: any): PayrollSettings {
    return {
      id: row.id,
      calculation_method: row.calculation_method || 'WORKING_DAYS',
      fixed_working_days: parseInt(row.fixed_working_days) || 26,
      weekly_offs: row.weekly_offs || '0',
      late_deduction_rule: row.late_deduction_rule || 'THREE_LATE_HALF_DAY',
      pf_enabled: row.pf_enabled !== false,
      pf_employee_percent: parseFloat(row.pf_employee_percent) || 12,
      pf_employer_percent: parseFloat(row.pf_employer_percent) || 12,
      pf_wage_ceiling: parseFloat(row.pf_wage_ceiling) || 15000,
      esic_enabled: row.esic_enabled !== false,
      esic_employee_percent: parseFloat(row.esic_employee_percent) || 0.75,
      esic_employer_percent: parseFloat(row.esic_employer_percent) || 3.25,
      esic_wage_limit: parseFloat(row.esic_wage_limit) || 21000,
      pt_enabled: row.pt_enabled !== false,
      default_pt_amount: parseFloat(row.default_pt_amount) || 200,
    };
  }

  /**
   * Compute standard working days in a month based on policy
   */
  static async calculateWorkingDays(
    year: number,
    month: number,
    settings: PayrollSettings
  ): Promise<{ workingDays: number; totalDays: number; holidaysCount: number; weeklyOffsCount: number }> {
    const totalDays = new Date(year, month, 0).getDate();

    if (settings.calculation_method === 'CALENDAR_DAYS') {
      return { workingDays: totalDays, totalDays, holidaysCount: 0, weeklyOffsCount: 0 };
    }

    if (settings.calculation_method === 'FIXED_DAYS') {
      return { workingDays: settings.fixed_working_days, totalDays, holidaysCount: 0, weeklyOffsCount: 0 };
    }

    // Default: 'WORKING_DAYS' -> Calendar Days - Weekly Offs - Active Official Company Holidays
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

    const holRes = await query(
      `SELECT holiday_date FROM holidays WHERE is_active = true AND holiday_date >= $1 AND holiday_date <= $2`,
      [startDateStr, endDateStr]
    );

    const holidaySet = new Set(
      holRes.rows.map((r) => new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    );

    const offDays = settings.weekly_offs.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));

    let weeklyOffsCount = 0;
    let holidaysCount = 0;
    let workingDays = 0;

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month - 1, day);
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = d.getDay();

      if (offDays.includes(dayOfWeek)) {
        weeklyOffsCount++;
      } else if (holidaySet.has(dStr)) {
        holidaysCount++;
      } else {
        workingDays++;
      }
    }

    return { workingDays, totalDays, holidaysCount, weeklyOffsCount };
  }

  /**
   * Compute monthly salary preview for all active employees for a given month/year
   */
  static async calculateCyclePreview(
    year: number,
    month: number,
    manualAdjustments: Record<number, { bonus?: number; incentive?: number; overtime?: number; advance?: number; other_deductions?: number; notes?: string }> = {}
  ): Promise<{
    settings: PayrollSettings;
    cycleMetrics: { workingDays: number; totalDays: number; holidaysCount: number; weeklyOffsCount: number };
    items: CalculatedPayrollItem[];
    totals: { totalGross: number; totalDeductions: number; totalNet: number };
  }> {
    const settings = await this.getSettings();
    const cycleMetrics = await this.calculateWorkingDays(year, month, settings);
    const totalWorkingDays = cycleMetrics.workingDays > 0 ? cycleMetrics.workingDays : 26;
    const totalCalendarDays = cycleMetrics.totalDays;

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalCalendarDays).padStart(2, '0')}`;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const actualEndStr = endDateStr > todayStr ? todayStr : endDateStr;

    // Fetch active employees with their salary profiles
    const empRes = await query(`
      SELECT 
        u.id, u.employee_id, u.name, u.email, u.department, u.designation,
        COALESCE(p.monthly_ctc, 0) as monthly_ctc,
        COALESCE(p.basic_salary, 0) as basic_salary,
        COALESCE(p.hra, 0) as hra,
        COALESCE(p.da, 0) as da,
        COALESCE(p.conveyance_allowance, 0) as conveyance_allowance,
        COALESCE(p.medical_allowance, 0) as medical_allowance,
        COALESCE(p.special_allowance, 0) as special_allowance,
        COALESCE(p.pf_applicable, true) as pf_applicable,
        COALESCE(p.esic_applicable, false) as esic_applicable,
        COALESCE(p.pt_applicable, true) as pt_applicable,
        COALESCE(p.tds_percent, 0) as tds_percent,
        p.bank_name, p.account_number, p.ifsc_code, p.pan_number, p.uan_number, p.esic_number
      FROM users u
      LEFT JOIN employee_salary_profiles p ON u.id = p.employee_id
      WHERE u.status = 'active'
      ORDER BY 
        CASE 
          WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
          WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
          ELSE 2 
        END, 
        NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
        u.employee_id ASC
    `);

    const employees = empRes.rows;
    if (employees.length === 0) {
      return {
        settings,
        cycleMetrics,
        items: [],
        totals: { totalGross: 0, totalDeductions: 0, totalNet: 0 },
      };
    }

    // Fetch Attendance, Leaves, Holidays, and Settings
    const [attRes, attSettings, holRes, leaveRes] = await Promise.all([
      query(`SELECT * FROM attendance WHERE attendance_date >= $1 AND attendance_date <= $2`, [startDateStr, actualEndStr]),
      getAttendanceSettings(),
      query(`SELECT holiday_date FROM holidays WHERE is_active = true AND holiday_date >= $1 AND holiday_date <= $2`, [startDateStr, actualEndStr]),
      query(`SELECT * FROM leave_requests WHERE status = 'APPROVED' AND from_date <= $2 AND to_date >= $1`, [startDateStr, actualEndStr]),
    ]);

    const attMap = new Map<string, any>();
    for (const r of attRes.rows) {
      const d = new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      attMap.set(`${r.employee_id}_${d}`, r);
    }

    const holSet = new Set(
      holRes.rows.map((r) => new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    );

    const leaveMap = new Map<string, any>();
    for (const lr of leaveRes.rows) {
      let d = new Date(lr.from_date);
      const end = new Date(lr.to_date);
      while (d <= end) {
        const dStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        leaveMap.set(`${lr.employee_id}_${dStr}`, lr);
        d.setDate(d.getDate() + 1);
      }
    }

    const offDays = settings.weekly_offs.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    const items: CalculatedPayrollItem[] = [];

    let sumGross = 0;
    let sumDeductions = 0;
    let sumNet = 0;

    for (const emp of employees) {
      let presentDays = 0;
      let halfDays = 0;
      let paidLeaveDays = 0;
      let lwpDays = 0;
      let lateDays = 0;

      // Determine days elapsed up to actualEndStr
      const endDay = parseInt(actualEndStr.split('-')[2]);
      for (let day = 1; day <= endDay; day++) {
        const d = new Date(year, month - 1, day);
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = d.getDay();
        const key = `${emp.id}_${dStr}`;

        const att = attMap.get(key);
        const lve = leaveMap.get(key);
        const isHol = holSet.has(dStr);
        const isOff = offDays.includes(dayOfWeek);

        // If it's a weekly off or official holiday, it doesn't count against working days or attendance
        if (isOff || isHol) {
          continue;
        }

        if (lve) {
          const type = (lve.leave_type || '').toLowerCase();
          if (type.includes('without pay') || type.includes('unpaid') || type === 'lwp') {
            lwpDays++;
          } else {
            paidLeaveDays++;
          }
          continue;
        }

        if (att && att.status === 'PRESENT') {
          const workMins = att.working_minutes || 0;
          if (workMins > 0 && workMins < attSettings.full_day_minutes && workMins >= attSettings.half_day_minutes) {
            halfDays++;
          } else {
            presentDays++;
          }
          if (att.is_late) {
            lateDays++;
          }
        } else {
          // Absent
          lwpDays++;
        }
      }

      // Late deduction policy
      let lateDeductionDays = 0;
      if (settings.late_deduction_rule === 'THREE_LATE_HALF_DAY') {
        lateDeductionDays = Math.floor(lateDays / 3) * 0.5;
      } else if (settings.late_deduction_rule === 'FOUR_LATE_HALF_DAY') {
        lateDeductionDays = Math.floor(lateDays / 4) * 0.5;
      } else if (settings.late_deduction_rule === 'THREE_LATE_FULL_DAY') {
        lateDeductionDays = Math.floor(lateDays / 3) * 1.0;
      }

      // Net payable days
      let payableDays = presentDays + (halfDays * 0.5) + paidLeaveDays - lateDeductionDays;
      if (payableDays < 0) payableDays = 0;
      if (payableDays > totalWorkingDays) payableDays = totalWorkingDays;

      // Component Earnings Calculation
      const monthlyCTC = parseFloat(emp.monthly_ctc) || 0;
      const dailyRate = totalWorkingDays > 0 ? Math.round((monthlyCTC / totalWorkingDays) * 100) / 100 : 0;
      const ratio = totalWorkingDays > 0 ? (payableDays / totalWorkingDays) : 0;

      const baseBasic = parseFloat(emp.basic_salary) || 0;
      const baseHRA = parseFloat(emp.hra) || 0;
      const baseDA = parseFloat(emp.da) || 0;
      const baseConv = parseFloat(emp.conveyance_allowance) || 0;
      const baseMed = parseFloat(emp.medical_allowance) || 0;
      const baseSpec = parseFloat(emp.special_allowance) || 0;

      const earnedBasic = Math.round(baseBasic * ratio);
      const earnedHRA = Math.round(baseHRA * ratio);
      const earnedDA = Math.round(baseDA * ratio);
      const earnedConv = Math.round(baseConv * ratio);
      const earnedMed = Math.round(baseMed * ratio);
      const earnedSpec = Math.round(baseSpec * ratio);

      // Manual adjustments for this employee if passed
      const adj = manualAdjustments[emp.id] || {};
      const bonus = parseFloat(String(adj.bonus || 0)) || 0;
      const incentive = parseFloat(String(adj.incentive || 0)) || 0;
      const overtime = parseFloat(String(adj.overtime || 0)) || 0;
      const advance = parseFloat(String(adj.advance || 0)) || 0;
      const otherDed = parseFloat(String(adj.other_deductions || 0)) || 0;
      const notes = adj.notes || '';

      const grossPay = earnedBasic + earnedHRA + earnedDA + earnedConv + earnedMed + earnedSpec + bonus + incentive + overtime;

      // Deductions
      let pfDeduction = 0;
      if (settings.pf_enabled && emp.pf_applicable && earnedBasic > 0) {
        const pfWage = settings.pf_wage_ceiling > 0 ? Math.min(earnedBasic, settings.pf_wage_ceiling) : earnedBasic;
        pfDeduction = Math.round(pfWage * (settings.pf_employee_percent / 100));
      }

      let esicDeduction = 0;
      if (settings.esic_enabled && emp.esic_applicable && grossPay <= settings.esic_wage_limit && grossPay > 0) {
        esicDeduction = Math.round(grossPay * (settings.esic_employee_percent / 100));
      }

      let ptDeduction = 0;
      if (settings.pt_enabled && emp.pt_applicable && grossPay > 0) {
        ptDeduction = settings.default_pt_amount;
      }

      let tdsDeduction = 0;
      const tdsPercent = parseFloat(emp.tds_percent) || 0;
      if (tdsPercent > 0 && grossPay > 0) {
        tdsDeduction = Math.round(grossPay * (tdsPercent / 100));
      }

      const totalDeductions = pfDeduction + esicDeduction + ptDeduction + tdsDeduction + advance + otherDed;
      const netSalary = Math.max(0, grossPay - totalDeductions);

      sumGross += grossPay;
      sumDeductions += totalDeductions;
      sumNet += netSalary;

      items.push({
        employee_id: emp.id,
        employee_code: emp.employee_id,
        name: emp.name,
        email: emp.email,
        department: emp.department || 'General',
        designation: emp.designation || 'Staff',
        base_monthly_salary: monthlyCTC,
        daily_rate: dailyRate,
        total_days: totalCalendarDays,
        working_days: totalWorkingDays,
        present_days: presentDays,
        paid_leave_days: paidLeaveDays,
        lwp_days: lwpDays,
        half_days: halfDays,
        late_days: lateDays,
        late_deduction_days: lateDeductionDays,
        payable_days: payableDays,
        earned_basic: earnedBasic,
        earned_hra: earnedHRA,
        earned_da: earnedDA,
        earned_conveyance: earnedConv,
        earned_medical: earnedMed,
        earned_special: earnedSpec,
        bonus,
        incentive,
        overtime_pay: overtime,
        gross_pay: grossPay,
        pf_deduction: pfDeduction,
        esic_deduction: esicDeduction,
        pt_deduction: ptDeduction,
        tds_deduction: tdsDeduction,
        advance_deduction: advance,
        other_deductions: otherDed,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        notes,
      });
    }

    return {
      settings,
      cycleMetrics,
      items,
      totals: {
        totalGross: Math.round(sumGross * 100) / 100,
        totalDeductions: Math.round(sumDeductions * 100) / 100,
        totalNet: Math.round(sumNet * 100) / 100,
      },
    };
  }

  /**
   * Check if a finalized payroll cycle is Out of Sync with attendance or leave modifications
   */
  static async checkSyncStatus(cycleId: number): Promise<{ isOutOfSync: boolean; mismatches: any[] }> {
    const cycleRes = await query('SELECT * FROM payroll_cycles WHERE id = $1', [cycleId]);
    if (cycleRes.rows.length === 0) {
      throw new Error('Payroll cycle not found');
    }
    const cycle = cycleRes.rows[0];

    // Re-calculate preview for that month & year
    const preview = await this.calculateCyclePreview(cycle.year, cycle.month);
    const previewMap = new Map(preview.items.map((i) => [i.employee_id, i]));

    const itemsRes = await query('SELECT * FROM payroll_items WHERE cycle_id = $1', [cycleId]);
    const mismatches: any[] = [];

    for (const item of itemsRes.rows) {
      const fresh = previewMap.get(item.employee_id);
      if (fresh) {
        const storedPayable = parseFloat(item.payable_days);
        const freshPayable = fresh.payable_days;
        const storedPresent = parseFloat(item.present_days);
        const freshPresent = fresh.present_days;
        const storedLwp = parseFloat(item.lwp_days);
        const freshLwp = fresh.lwp_days;

        if (
          Math.abs(storedPayable - freshPayable) > 0.01 ||
          Math.abs(storedPresent - freshPresent) > 0.01 ||
          Math.abs(storedLwp - freshLwp) > 0.01
        ) {
          mismatches.push({
            employeeId: item.employee_id,
            stored: { payableDays: storedPayable, presentDays: storedPresent, lwpDays: storedLwp },
            current: { payableDays: freshPayable, presentDays: freshPresent, lwpDays: freshLwp },
          });
        }
      }
    }

    const isOutOfSync = mismatches.length > 0;
    if (isOutOfSync && cycle.status === 'FINALIZED') {
      await query(`UPDATE payroll_cycles SET status = 'OUT_OF_SYNC', updated_at = NOW() WHERE id = $1`, [cycleId]);
    }

    return { isOutOfSync, mismatches };
  }
}
