import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { query } from '../db';
import { PayrollCalculationService } from '../services/payrollCalculationService';
import { SalarySlipService } from '../services/salarySlipService';
import { PayrollReportService } from '../services/payrollReportService';
import { NotificationService } from '../services/notificationService';

export class PayrollController {
  /**
   * GET /api/admin/payroll/settings
   */
  static async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await PayrollCalculationService.getSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) {
      console.error('getSettings error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch payroll settings' } });
    }
  }

  /**
   * PUT /api/admin/payroll/settings
   */
  static async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        calculation_method,
        fixed_working_days,
        weekly_offs,
        late_deduction_rule,
        pf_enabled,
        pf_employee_percent,
        pf_employer_percent,
        pf_wage_ceiling,
        esic_enabled,
        esic_employee_percent,
        esic_employer_percent,
        esic_wage_limit,
        pt_enabled,
        default_pt_amount,
      } = req.body;

      await query(`
        UPDATE payroll_settings SET
          calculation_method = COALESCE($1, calculation_method),
          fixed_working_days = COALESCE($2, fixed_working_days),
          weekly_offs = COALESCE($3, weekly_offs),
          late_deduction_rule = COALESCE($4, late_deduction_rule),
          pf_enabled = COALESCE($5, pf_enabled),
          pf_employee_percent = COALESCE($6, pf_employee_percent),
          pf_employer_percent = COALESCE($7, pf_employer_percent),
          pf_wage_ceiling = COALESCE($8, pf_wage_ceiling),
          esic_enabled = COALESCE($9, esic_enabled),
          esic_employee_percent = COALESCE($10, esic_employee_percent),
          esic_employer_percent = COALESCE($11, esic_employer_percent),
          esic_wage_limit = COALESCE($12, esic_wage_limit),
          pt_enabled = COALESCE($13, pt_enabled),
          default_pt_amount = COALESCE($14, default_pt_amount),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [
        calculation_method,
        fixed_working_days,
        weekly_offs,
        late_deduction_rule,
        pf_enabled,
        pf_employee_percent,
        pf_employer_percent,
        pf_wage_ceiling,
        esic_enabled,
        esic_employee_percent,
        esic_employer_percent,
        esic_wage_limit,
        pt_enabled,
        default_pt_amount,
      ]);

      const updated = await PayrollCalculationService.getSettings();
      res.json({ success: true, message: 'Payroll settings updated successfully', data: updated });
    } catch (err: any) {
      console.error('updateSettings error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to update payroll settings' } });
    }
  }

  /**
   * GET /api/admin/payroll/profiles
   */
  static async getSalaryProfiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await query(`
        SELECT 
          u.id, u.employee_id, u.name, u.email, u.department, u.designation, u.status,
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
          p.bank_name, p.account_number, p.ifsc_code, p.pan_number, p.uan_number, p.esic_number,
          p.effective_date, p.updated_at as profile_updated_at
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

      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      console.error('getSalaryProfiles error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch salary profiles' } });
    }
  }

  /**
   * POST /api/admin/payroll/profiles/:employeeId
   */
  static async updateSalaryProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const employeeId = parseInt(req.params.employeeId as string);
      const {
        monthly_ctc,
        basic_salary,
        hra,
        da,
        conveyance_allowance,
        medical_allowance,
        special_allowance,
        pf_applicable,
        esic_applicable,
        pt_applicable,
        tds_percent,
        bank_name,
        account_number,
        ifsc_code,
        pan_number,
        uan_number,
        esic_number,
        effective_date,
        revision_reason,
      } = req.body;

      // Check existing profile for audit revision
      const existing = await query('SELECT * FROM employee_salary_profiles WHERE employee_id = $1', [employeeId]);
      const oldCtc = existing.rows.length > 0 ? parseFloat(existing.rows[0].monthly_ctc) : 0;
      const newCtc = parseFloat(monthly_ctc) || 0;

      if (existing.rows.length > 0 && Math.abs(oldCtc - newCtc) > 0.01) {
        // Record revision
        await query(`
          INSERT INTO salary_revisions (employee_id, previous_ctc, new_ctc, effective_date, reason, revised_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          employeeId,
          oldCtc,
          newCtc,
          effective_date || new Date().toISOString().split('T')[0],
          revision_reason || 'Compensation adjustment',
          req.user?.id || null,
        ]);
      }

      await query(`
        INSERT INTO employee_salary_profiles (
          employee_id, monthly_ctc, basic_salary, hra, da, conveyance_allowance, medical_allowance, special_allowance,
          pf_applicable, esic_applicable, pt_applicable, tds_percent,
          bank_name, account_number, ifsc_code, pan_number, uan_number, esic_number,
          effective_date, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
        ON CONFLICT (employee_id)
        DO UPDATE SET
          monthly_ctc = EXCLUDED.monthly_ctc,
          basic_salary = EXCLUDED.basic_salary,
          hra = EXCLUDED.hra,
          da = EXCLUDED.da,
          conveyance_allowance = EXCLUDED.conveyance_allowance,
          medical_allowance = EXCLUDED.medical_allowance,
          special_allowance = EXCLUDED.special_allowance,
          pf_applicable = EXCLUDED.pf_applicable,
          esic_applicable = EXCLUDED.esic_applicable,
          pt_applicable = EXCLUDED.pt_applicable,
          tds_percent = EXCLUDED.tds_percent,
          bank_name = EXCLUDED.bank_name,
          account_number = EXCLUDED.account_number,
          ifsc_code = EXCLUDED.ifsc_code,
          pan_number = EXCLUDED.pan_number,
          uan_number = EXCLUDED.uan_number,
          esic_number = EXCLUDED.esic_number,
          effective_date = EXCLUDED.effective_date,
          updated_at = CURRENT_TIMESTAMP
      `, [
        employeeId,
        monthly_ctc || 0,
        basic_salary || 0,
        hra || 0,
        da || 0,
        conveyance_allowance || 0,
        medical_allowance || 0,
        special_allowance || 0,
        pf_applicable !== false,
        esic_applicable === true,
        pt_applicable !== false,
        tds_percent || 0,
        bank_name || null,
        account_number || null,
        ifsc_code || null,
        pan_number || null,
        uan_number || null,
        esic_number || null,
        effective_date || new Date().toISOString().split('T')[0],
      ]);

      res.json({ success: true, message: 'Salary profile updated successfully' });
    } catch (err: any) {
      console.error('updateSalaryProfile error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to update salary profile' } });
    }
  }

  /**
   * GET /api/admin/payroll/profiles/:employeeId/revisions
   */
  static async getSalaryRevisions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const employeeId = parseInt(req.params.employeeId as string);
      const result = await query(`
        SELECT r.*, u.name as revised_by_name
        FROM salary_revisions r
        LEFT JOIN users u ON r.revised_by = u.id
        WHERE r.employee_id = $1
        ORDER BY r.created_at DESC
      `, [employeeId]);

      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      console.error('getSalaryRevisions error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch revisions' } });
    }
  }

  /**
   * GET /api/admin/payroll/cycles
   */
  static async getCycles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await query(`
        SELECT c.*, u.name as finalized_by_name,
               (SELECT COUNT(*) FROM payroll_items WHERE cycle_id = c.id) as employee_count
        FROM payroll_cycles c
        LEFT JOIN users u ON c.finalized_by = u.id
        ORDER BY c.year DESC, c.month DESC
      `);

      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      console.error('getCycles error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch payroll cycles' } });
    }
  }

  /**
   * GET /api/admin/payroll/cycles/:year/:month
   */
  static async getCycleDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseInt(req.params.year as string);
      const month = parseInt(req.params.month as string);

      const cycleRes = await query('SELECT * FROM payroll_cycles WHERE year = $1 AND month = $2', [year, month]);

      // If no cycle exists yet, or the cycle is in DRAFT state, return a live preview
      if (cycleRes.rows.length === 0 || cycleRes.rows[0].status !== 'FINALIZED') {
        const preview = await PayrollCalculationService.calculateCyclePreview(year, month);
        res.json({ success: true, isFinalized: false, data: preview });
        return;
      }

      const cycle = cycleRes.rows[0];
      const itemsRes = await query(`
        SELECT 
          pi.*,
          u.employee_id as employee_code, u.name, u.email, u.department, u.designation,
          p.pan_number, p.uan_number, p.esic_number, p.bank_name, p.account_number, p.ifsc_code
        FROM payroll_items pi
        JOIN users u ON pi.employee_id = u.id
        LEFT JOIN employee_salary_profiles p ON u.id = p.employee_id
        WHERE pi.cycle_id = $1
        ORDER BY 
          CASE 
            WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
            WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
            ELSE 2 
          END, 
          NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
          u.employee_id ASC
      `, [cycle.id]);

      // Check sync status
      const syncInfo = await PayrollCalculationService.checkSyncStatus(cycle.id);

      res.json({
        success: true,
        isFinalized: true,
        cycle,
        syncInfo,
        items: itemsRes.rows,
      });
    } catch (err: any) {
      console.error('getCycleDetails error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch cycle details' } });
    }
  }

  /**
   * POST /api/admin/payroll/calculate
   */
  static async calculatePreview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { year, month, adjustments } = req.body;
      const y = parseInt(year) || new Date().getFullYear();
      const m = parseInt(month) || (new Date().getMonth() + 1);

      const preview = await PayrollCalculationService.calculateCyclePreview(y, m, adjustments || {});
      res.json({ success: true, data: preview });
    } catch (err: any) {
      console.error('calculatePreview error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to calculate payroll preview' } });
    }
  }

  /**
   * POST /api/admin/payroll/finalize
   */
  static async finalizeCycle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { year, month, adjustments } = req.body;
      const y = parseInt(year);
      const m = parseInt(month);

      if (!y || !m || m < 1 || m > 12) {
        res.status(400).json({ success: false, error: { message: 'Invalid year or month' } });
        return;
      }

      // 1. Calculate final preview with any manual adjustments
      const preview = await PayrollCalculationService.calculateCyclePreview(y, m, adjustments || {});
      const settings = preview.settings;
      const metrics = preview.cycleMetrics;

      // 2. Upsert cycle record
      const cycleRes = await query(`
        INSERT INTO payroll_cycles (
          month, year, calculation_method, total_working_days, status,
          total_gross_pay, total_deductions, total_net_pay, finalized_at, finalized_by, updated_at
        )
        VALUES ($1, $2, $3, $4, 'FINALIZED', $5, $6, $7, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (month, year)
        DO UPDATE SET
          calculation_method = EXCLUDED.calculation_method,
          total_working_days = EXCLUDED.total_working_days,
          status = 'FINALIZED',
          total_gross_pay = EXCLUDED.total_gross_pay,
          total_deductions = EXCLUDED.total_deductions,
          total_net_pay = EXCLUDED.total_net_pay,
          finalized_at = CURRENT_TIMESTAMP,
          finalized_by = EXCLUDED.finalized_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        m,
        y,
        settings.calculation_method,
        metrics.workingDays,
        preview.totals.totalGross,
        preview.totals.totalDeductions,
        preview.totals.totalNet,
        req.user?.id || null,
      ]);

      const cycle = cycleRes.rows[0];

      // 3. Insert / update payroll_items and generate PDF slips
      for (const item of preview.items) {
        // Fetch bank / statutory info for slip
        const profRes = await query('SELECT * FROM employee_salary_profiles WHERE employee_id = $1', [item.employee_id]);
        const prof = profRes.rows[0];

        // Generate PDF slip
        const pdfUrl = await SalarySlipService.generateSalarySlipPDF(item, y, m, prof);

        await query(`
          INSERT INTO payroll_items (
            cycle_id, employee_id, base_monthly_salary, daily_rate, total_days, working_days,
            present_days, paid_leave_days, lwp_days, half_days, late_days, late_deduction_days, payable_days,
            earned_basic, earned_hra, earned_da, earned_conveyance, earned_medical, earned_special,
            bonus, incentive, overtime_pay, gross_pay,
            pf_deduction, esic_deduction, pt_deduction, tds_deduction, advance_deduction, other_deductions,
            total_deductions, net_salary, salary_slip_url, notes, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
            $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, CURRENT_TIMESTAMP
          )
          ON CONFLICT (cycle_id, employee_id)
          DO UPDATE SET
            base_monthly_salary = EXCLUDED.base_monthly_salary,
            daily_rate = EXCLUDED.daily_rate,
            total_days = EXCLUDED.total_days,
            working_days = EXCLUDED.working_days,
            present_days = EXCLUDED.present_days,
            paid_leave_days = EXCLUDED.paid_leave_days,
            lwp_days = EXCLUDED.lwp_days,
            half_days = EXCLUDED.half_days,
            late_days = EXCLUDED.late_days,
            late_deduction_days = EXCLUDED.late_deduction_days,
            payable_days = EXCLUDED.payable_days,
            earned_basic = EXCLUDED.earned_basic,
            earned_hra = EXCLUDED.earned_hra,
            earned_da = EXCLUDED.earned_da,
            earned_conveyance = EXCLUDED.earned_conveyance,
            earned_medical = EXCLUDED.earned_medical,
            earned_special = EXCLUDED.earned_special,
            bonus = EXCLUDED.bonus,
            incentive = EXCLUDED.incentive,
            overtime_pay = EXCLUDED.overtime_pay,
            gross_pay = EXCLUDED.gross_pay,
            pf_deduction = EXCLUDED.pf_deduction,
            esic_deduction = EXCLUDED.esic_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            advance_deduction = EXCLUDED.advance_deduction,
            other_deductions = EXCLUDED.other_deductions,
            total_deductions = EXCLUDED.total_deductions,
            net_salary = EXCLUDED.net_salary,
            salary_slip_url = EXCLUDED.salary_slip_url,
            notes = EXCLUDED.notes,
            updated_at = CURRENT_TIMESTAMP
        `, [
          cycle.id, item.employee_id, item.base_monthly_salary, item.daily_rate, item.total_days, item.working_days,
          item.present_days, item.paid_leave_days, item.lwp_days, item.half_days, item.late_days, item.late_deduction_days, item.payable_days,
          item.earned_basic, item.earned_hra, item.earned_da, item.earned_conveyance, item.earned_medical, item.earned_special,
          item.bonus, item.incentive, item.overtime_pay, item.gross_pay,
          item.pf_deduction, item.esic_deduction, item.pt_deduction, item.tds_deduction, item.advance_deduction, item.other_deductions,
          item.total_deductions, item.net_salary, pdfUrl, item.notes,
        ]);

        // Send employee notification
        try {
          await NotificationService.notifyUser(item.employee_id, {
            title: `Salary Slip Generated (${m}/${y})`,
            message: `Your salary slip for ${m}/${y} has been processed. Net Pay: ₹${item.net_salary.toLocaleString('en-IN')}. Download your slip from the Salary Slips section.`,
            type: 'Payroll',
            priority: 'Medium',
            actionUrl: '/salary-slips',
          });
        } catch (notifErr) {
          console.warn('Notification failure for emp:', item.employee_id, notifErr);
        }
      }

      res.json({
        success: true,
        message: `Payroll cycle for ${m}/${y} finalized and locked successfully. All salary slips generated.`,
        cycleId: cycle.id,
      });
    } catch (err: any) {
      console.error('finalizeCycle error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to finalize payroll cycle' } });
    }
  }

  /**
   * POST /api/admin/payroll/cycles/:id/unlock
   */
  static async unlockCycle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cycleId = parseInt(req.params.id as string);
      await query(`UPDATE payroll_cycles SET status = 'DRAFT', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [cycleId]);
      res.json({ success: true, message: 'Payroll cycle unlocked for adjustments' });
    } catch (err: any) {
      console.error('unlockCycle error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to unlock cycle' } });
    }
  }

  /**
   * PATCH /api/admin/payroll/items/:id
   */
  static async updatePayrollItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const itemId = parseInt(req.params.id as string);
      const { bonus, incentive, overtime_pay, advance_deduction, other_deductions, notes } = req.body;

      const itemRes = await query('SELECT * FROM payroll_items WHERE id = $1', [itemId]);
      if (itemRes.rows.length === 0) {
        res.status(404).json({ success: false, error: { message: 'Payroll item not found' } });
        return;
      }
      const item = itemRes.rows[0];

      // Check if cycle is locked
      const cycleRes = await query('SELECT * FROM payroll_cycles WHERE id = $1', [item.cycle_id]);
      if (cycleRes.rows[0]?.status === 'FINALIZED') {
        res.status(400).json({ success: false, error: { message: 'Cannot edit an item in a locked/finalized payroll cycle. Please unlock the cycle first.' } });
        return;
      }

      const newBonus = bonus !== undefined ? parseFloat(bonus) : parseFloat(item.bonus);
      const newIncentive = incentive !== undefined ? parseFloat(incentive) : parseFloat(item.incentive);
      const newOT = overtime_pay !== undefined ? parseFloat(overtime_pay) : parseFloat(item.overtime_pay);
      const newAdv = advance_deduction !== undefined ? parseFloat(advance_deduction) : parseFloat(item.advance_deduction);
      const newOther = other_deductions !== undefined ? parseFloat(other_deductions) : parseFloat(item.other_deductions);

      const earnedTotal = parseFloat(item.earned_basic) + parseFloat(item.earned_hra) + parseFloat(item.earned_da) +
                          parseFloat(item.earned_conveyance) + parseFloat(item.earned_medical) + parseFloat(item.earned_special);
      const newGross = earnedTotal + newBonus + newIncentive + newOT;

      const baseDeductions = parseFloat(item.pf_deduction) + parseFloat(item.esic_deduction) + parseFloat(item.pt_deduction) + parseFloat(item.tds_deduction);
      const newTotalDed = baseDeductions + newAdv + newOther;
      const newNet = Math.max(0, newGross - newTotalDed);

      await query(`
        UPDATE payroll_items SET
          bonus = $1, incentive = $2, overtime_pay = $3,
          gross_pay = $4, advance_deduction = $5, other_deductions = $6,
          total_deductions = $7, net_salary = $8, notes = COALESCE($9, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
      `, [newBonus, newIncentive, newOT, newGross, newAdv, newOther, newTotalDed, newNet, notes, itemId]);

      res.json({ success: true, message: 'Payroll item updated' });
    } catch (err: any) {
      console.error('updatePayrollItem error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to update payroll item' } });
    }
  }

  /**
   * Reports Export Handlers
   */
  static async exportSalaryRegister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cycleId = req.query.cycleId ? parseInt(req.query.cycleId as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      await PayrollReportService.exportSalaryRegisterExcel({ cycleId, month, year }, res);
    } catch (err: any) {
      console.error('exportSalaryRegister error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to export salary register' } });
    }
  }

  static async exportPFReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cycleId = req.query.cycleId ? parseInt(req.query.cycleId as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      await PayrollReportService.exportPFReportExcel({ cycleId, month, year }, res);
    } catch (err: any) {
      console.error('exportPFReport error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to export PF report' } });
    }
  }

  static async exportESICReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cycleId = req.query.cycleId ? parseInt(req.query.cycleId as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      await PayrollReportService.exportESICReportExcel({ cycleId, month, year }, res);
    } catch (err: any) {
      console.error('exportESICReport error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to export ESIC report' } });
    }
  }

  static async exportSummaryPDF(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cycleId = req.query.cycleId ? parseInt(req.query.cycleId as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      await PayrollReportService.exportPayrollSummaryPDF({ cycleId, month, year }, res);
    } catch (err: any) {
      console.error('exportSummaryPDF error:', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Failed to export summary PDF' } });
    }
  }
}
