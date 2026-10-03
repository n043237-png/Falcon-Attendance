"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollReportService = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const db_1 = require("../db");
const payrollCalculationService_1 = require("./payrollCalculationService");
const logoHelper_1 = require("../utils/logoHelper");
const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};
class PayrollReportService {
    /**
     * Helper to retrieve report data either from a finalized cycle or computed live preview
     */
    static async getReportData(params) {
        const { cycleId } = params;
        let month = params.month;
        let year = params.year;
        if (cycleId) {
            const cycleRes = await (0, db_1.query)('SELECT * FROM payroll_cycles WHERE id = $1', [cycleId]);
            if (cycleRes.rows.length > 0) {
                const cycle = cycleRes.rows[0];
                const itemsRes = await (0, db_1.query)(`
          SELECT 
            pi.*, 
            u.employee_id as emp_code, u.name as emp_name, u.department, u.designation,
            p.pan_number, p.uan_number, p.esic_number, p.bank_name, p.account_number
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
        `, [cycleId]);
                return {
                    month: cycle.month,
                    year: cycle.year,
                    status: cycle.status,
                    total_working_days: parseFloat(cycle.total_working_days),
                    total_gross_pay: parseFloat(cycle.total_gross_pay),
                    total_deductions: parseFloat(cycle.total_deductions),
                    total_net_pay: parseFloat(cycle.total_net_pay),
                    items: itemsRes.rows.map((r) => ({
                        emp_code: r.emp_code,
                        emp_name: r.emp_name,
                        department: r.department || 'General',
                        designation: r.designation || 'Staff',
                        working_days: parseFloat(r.working_days),
                        payable_days: parseFloat(r.payable_days),
                        earned_basic: parseFloat(r.earned_basic),
                        earned_hra: parseFloat(r.earned_hra),
                        earned_da: parseFloat(r.earned_da),
                        earned_conveyance: parseFloat(r.earned_conveyance),
                        earned_medical: parseFloat(r.earned_medical),
                        earned_special: parseFloat(r.earned_special),
                        bonus: parseFloat(r.bonus),
                        incentive: parseFloat(r.incentive),
                        overtime_pay: parseFloat(r.overtime_pay),
                        gross_pay: parseFloat(r.gross_pay),
                        pf_deduction: parseFloat(r.pf_deduction),
                        esic_deduction: parseFloat(r.esic_deduction),
                        pt_deduction: parseFloat(r.pt_deduction),
                        tds_deduction: parseFloat(r.tds_deduction),
                        total_deductions: parseFloat(r.total_deductions),
                        net_salary: parseFloat(r.net_salary),
                        uan_number: r.uan_number,
                        esic_number: r.esic_number,
                    })),
                };
            }
        }
        if (!year || !month) {
            const now = new Date();
            year = year || now.getFullYear();
            month = month || (now.getMonth() + 1);
        }
        // Check if a cycle exists in DB for this month & year
        const cycleRes = await (0, db_1.query)('SELECT * FROM payroll_cycles WHERE year = $1 AND month = $2', [year, month]);
        if (cycleRes.rows.length > 0) {
            return this.getReportData({ cycleId: cycleRes.rows[0].id });
        }
        // Otherwise compute live preview
        const preview = await payrollCalculationService_1.PayrollCalculationService.calculateCyclePreview(year, month);
        const profilesRes = await (0, db_1.query)('SELECT employee_id, uan_number, esic_number FROM employee_salary_profiles');
        const profMap = new Map(profilesRes.rows.map((p) => [p.employee_id, p]));
        return {
            month,
            year,
            status: 'LIVE / PREVIEW',
            total_working_days: preview.cycleMetrics.workingDays,
            total_gross_pay: preview.totals.totalGross,
            total_deductions: preview.totals.totalDeductions,
            total_net_pay: preview.totals.totalNet,
            items: preview.items.map((i) => {
                const prof = profMap.get(i.employee_id);
                return {
                    emp_code: i.employee_code,
                    emp_name: i.name,
                    department: i.department || 'General',
                    designation: i.designation || 'Staff',
                    working_days: i.working_days,
                    payable_days: i.payable_days,
                    earned_basic: i.earned_basic,
                    earned_hra: i.earned_hra,
                    earned_da: i.earned_da,
                    earned_conveyance: i.earned_conveyance,
                    earned_medical: i.earned_medical,
                    earned_special: i.earned_special,
                    bonus: i.bonus,
                    incentive: i.incentive,
                    overtime_pay: i.overtime_pay,
                    gross_pay: i.gross_pay,
                    pf_deduction: i.pf_deduction,
                    esic_deduction: i.esic_deduction,
                    pt_deduction: i.pt_deduction,
                    tds_deduction: i.tds_deduction,
                    total_deductions: i.total_deductions,
                    net_salary: i.net_salary,
                    uan_number: prof?.uan_number,
                    esic_number: prof?.esic_number,
                };
            }),
        };
    }
    /**
     * Export Salary Register in Premium Excel format
     */
    static async exportSalaryRegisterExcel(params, res) {
        const data = await this.getReportData(params);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[data.month - 1];
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = 'Falcon Info Solutions';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet(`Salary Register ${monthName} ${data.year}`, {
            views: [{ showGridLines: true }]
        });
        // Row 1 to 2: Executive Brand Header with Company Logo
        sheet.mergeCells('A1:A2');
        const logoBuffer = (0, logoHelper_1.getCompanyLogoBuffer)();
        if (logoBuffer) {
            try {
                const logoId = workbook.addImage({
                    buffer: logoBuffer,
                    extension: 'png'
                });
                sheet.addImage(logoId, {
                    tl: { col: 0.1, row: 0.1 },
                    ext: { width: 50, height: 50 }
                });
            }
            catch (e) {
                console.error('Logo add error in exportSalaryRegisterExcel:', e);
            }
        }
        sheet.mergeCells('B1:R1');
        const titleCell = sheet.getCell('B1');
        titleCell.value = 'FALCON INFO SOLUTIONS PVT. LTD.';
        titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E3B5C' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(1).height = 30;
        // Row 2: Subtitle & Metadata
        sheet.mergeCells('B2:R2');
        const subCell = sheet.getCell('B2');
        subCell.value = `MONTHLY SALARY REGISTER — ${monthName.toUpperCase()} ${data.year}  |  STATUS: ${data.status}  |  GENERATED: ${new Date().toLocaleDateString('en-GB')}`;
        subCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0E3B5C' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FA' } };
        subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(2).height = 24;
        // Row 3: Blank Spacing
        sheet.getRow(3).height = 8;
        // Row 4: Column Headers
        const headers = [
            'Emp Code', 'Employee Name', 'Department', 'Designation', 'Working\nDays', 'Payable\nDays',
            'Earned\nBasic', 'HRA', 'DA', 'Allowances', 'Bonus /\nIncentive', 'Gross\nEarnings',
            'PF\n(12%)', 'ESIC', 'Prof. Tax\n(PT)', 'TDS', 'Total\nDeductions', 'Net Salary\n(INR)'
        ];
        const headerRow = sheet.getRow(4);
        headers.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0E3B5C' } },
                bottom: { style: 'medium', color: { argb: 'FF0E3B5C' } },
                left: { style: 'thin', color: { argb: 'FF3B82F6' } },
                right: { style: 'thin', color: { argb: 'FF3B82F6' } },
            };
        });
        headerRow.height = 34;
        // Default Proportional Column Widths
        const colWidths = [
            14, // A: Emp Code
            22, // B: Employee Name
            16, // C: Department
            18, // D: Designation
            13, // E: Working Days
            13, // F: Payable Days
            15, // G: Earned Basic
            13, // H: HRA
            11, // I: DA
            14, // J: Allowances
            13, // K: Bonus/Inc.
            16, // L: Gross Earnings
            12, // M: PF (12%)
            11, // N: ESIC
            10, // O: Prof. Tax
            11, // P: TDS
            16, // Q: Total Deductions
            18 // R: Net Salary
        ];
        // Data Rows
        let currentRowNum = 5;
        let sumBasic = 0, sumHra = 0, sumDa = 0, sumAllowances = 0, sumBonus = 0, sumGross = 0;
        let sumPf = 0, sumEsic = 0, sumPt = 0, sumTds = 0, sumDeductions = 0, sumNet = 0;
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const row = sheet.getRow(currentRowNum);
            const isEven = i % 2 === 0;
            const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
            const allowances = item.earned_conveyance + item.earned_medical + item.earned_special;
            const bonusInc = item.bonus + item.incentive + item.overtime_pay;
            sumBasic += item.earned_basic;
            sumHra += item.earned_hra;
            sumDa += item.earned_da;
            sumAllowances += allowances;
            sumBonus += bonusInc;
            sumGross += item.gross_pay;
            sumPf += item.pf_deduction;
            sumEsic += item.esic_deduction;
            sumPt += item.pt_deduction;
            sumTds += item.tds_deduction;
            sumDeductions += item.total_deductions;
            sumNet += item.net_salary;
            const rowValues = [
                item.emp_code,
                item.emp_name,
                item.department,
                item.designation,
                item.working_days,
                item.payable_days,
                item.earned_basic,
                item.earned_hra,
                item.earned_da,
                allowances,
                bonusInc,
                item.gross_pay,
                item.pf_deduction,
                item.esic_deduction,
                item.pt_deduction,
                item.tds_deduction,
                item.total_deductions,
                item.net_salary
            ];
            rowValues.forEach((val, idx) => {
                const cell = row.getCell(idx + 1);
                cell.value = val;
                cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                cell.border = thinBorder;
                // Alignment and Number Formatting
                if (idx < 4) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    if (idx === 1)
                        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                }
                else if (idx === 4 || idx === 5) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                else {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0.00';
                    if (idx === 11) {
                        // Gross Pay
                        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
                    }
                    else if (idx === 16) {
                        // Total Deductions
                        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
                    }
                    else if (idx === 17) {
                        // Net Salary (Highlighted)
                        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                    }
                }
            });
            row.height = 21;
            currentRowNum++;
        }
        // Totals Row
        const totalsRow = sheet.getRow(currentRowNum);
        totalsRow.height = 24;
        // Merge A to D for "TOTALS"
        sheet.mergeCells(`A${currentRowNum}:D${currentRowNum}`);
        const totalsLabel = totalsRow.getCell(1);
        totalsLabel.value = `TOTALS (${data.items.length} EMPLOYEES)`;
        totalsLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0E3B5C' } };
        totalsLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        const totalsValues = {
            7: sumBasic,
            8: sumHra,
            9: sumDa,
            10: sumAllowances,
            11: sumBonus,
            12: sumGross,
            13: sumPf,
            14: sumEsic,
            15: sumPt,
            16: sumTds,
            17: sumDeductions,
            18: sumNet
        };
        for (let colIdx = 1; colIdx <= 18; colIdx++) {
            const cell = totalsRow.getCell(colIdx);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
            cell.border = {
                top: { style: 'double', color: { argb: 'FF0E3B5C' } },
                bottom: { style: 'medium', color: { argb: 'FF0E3B5C' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
            if (totalsValues[colIdx] !== undefined) {
                cell.value = totalsValues[colIdx];
                cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: colIdx === 18 ? { argb: 'FF15803D' } : { argb: 'FF0E3B5C' } };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0.00';
            }
        }
        // Apply Exact Proportional Column Widths (Row 1-3 merged titles excluded!)
        colWidths.forEach((width, idx) => {
            sheet.getColumn(idx + 1).width = width;
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Salary_Register_${data.month}_${data.year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    /**
     * Export PF Statutory Compliance Report (Premium Excel)
     */
    static async exportPFReportExcel(params, res) {
        const data = await this.getReportData(params);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[data.month - 1];
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = 'Falcon Info Solutions';
        const sheet = workbook.addWorksheet(`PF Report ${monthName} ${data.year}`, {
            views: [{ showGridLines: true }]
        });
        // Row 1 to 2: Brand Header with Company Logo
        sheet.mergeCells('A1:A2');
        const logoBuffer = (0, logoHelper_1.getCompanyLogoBuffer)();
        if (logoBuffer) {
            try {
                const logoId = workbook.addImage({
                    buffer: logoBuffer,
                    extension: 'png'
                });
                sheet.addImage(logoId, {
                    tl: { col: 0.1, row: 0.1 },
                    ext: { width: 50, height: 50 }
                });
            }
            catch (e) {
                console.error('Logo add error in exportPFReportExcel:', e);
            }
        }
        // Row 1: Header
        sheet.mergeCells('B1:G1');
        const titleCell = sheet.getCell('B1');
        titleCell.value = 'FALCON INFO SOLUTIONS PVT. LTD.';
        titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; // Teal
        titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(1).height = 30;
        // Row 2: Subtitle
        sheet.mergeCells('B2:G2');
        const subCell = sheet.getCell('B2');
        subCell.value = `EMPLOYEES' PROVIDENT FUND (EPF) MONTHLY RETURN — ${monthName.toUpperCase()} ${data.year}`;
        subCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0D9488' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } };
        subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(2).height = 24;
        // Row 3: Blank
        sheet.getRow(3).height = 8;
        // Row 4: Column Headers
        const headers = [
            'Emp Code', 'Employee Name', 'UAN Number', 'EPF Wages (Basic)',
            'Employee Share (12%)', 'Employer Share (12%)', 'Total Contribution'
        ];
        const headerRow = sheet.getRow(4);
        headers.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0F766E' } },
                bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
            };
        });
        headerRow.height = 28;
        // Column Widths
        const colWidths = [14, 22, 18, 20, 22, 22, 20];
        let rowNum = 5;
        let sumWages = 0, sumEmpPF = 0, sumEmrPF = 0, sumTotalPF = 0;
        const pfItems = data.items.filter((i) => i.pf_deduction > 0);
        const targetItems = pfItems.length > 0 ? pfItems : data.items;
        for (let i = 0; i < targetItems.length; i++) {
            const item = targetItems[i];
            const row = sheet.getRow(rowNum);
            const isEven = i % 2 === 0;
            const basic = item.earned_basic;
            const empPF = item.pf_deduction;
            const emrPF = empPF;
            const totalPF = empPF + emrPF;
            sumWages += basic;
            sumEmpPF += empPF;
            sumEmrPF += emrPF;
            sumTotalPF += totalPF;
            const vals = [
                item.emp_code,
                item.emp_name,
                item.uan_number || 'PENDING',
                basic,
                empPF,
                emrPF,
                totalPF
            ];
            vals.forEach((v, idx) => {
                const cell = row.getCell(idx + 1);
                cell.value = v;
                cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF0FDFA' } };
                cell.border = thinBorder;
                if (idx === 0)
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                else if (idx === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
                }
                else if (idx === 2) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                else {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0.00';
                    if (idx === 6)
                        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F766E' } };
                }
            });
            row.height = 21;
            rowNum++;
        }
        // Totals Row
        const totalsRow = sheet.getRow(rowNum);
        totalsRow.height = 24;
        sheet.mergeCells(`A${rowNum}:C${rowNum}`);
        const totLabel = totalsRow.getCell(1);
        totLabel.value = `TOTAL PF CONTRIBUTIONS (${targetItems.length} EMPLOYEES)`;
        totLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F766E' } };
        totLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        const totalsObj = {
            4: sumWages,
            5: sumEmpPF,
            6: sumEmrPF,
            7: sumTotalPF
        };
        for (let c = 1; c <= 7; c++) {
            const cell = totalsRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } };
            cell.border = {
                top: { style: 'double', color: { argb: 'FF0F766E' } },
                bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
            };
            if (totalsObj[c] !== undefined) {
                cell.value = totalsObj[c];
                cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F766E' } };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0.00';
            }
        }
        colWidths.forEach((w, idx) => {
            sheet.getColumn(idx + 1).width = w;
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="PF_Report_${data.month}_${data.year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    /**
     * Export ESIC Statutory Compliance Report (Premium Excel)
     */
    static async exportESICReportExcel(params, res) {
        const data = await this.getReportData(params);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[data.month - 1];
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = 'Falcon Info Solutions';
        const sheet = workbook.addWorksheet(`ESIC Report ${monthName} ${data.year}`, {
            views: [{ showGridLines: true }]
        });
        // Row 1 to 2: Brand Header with Company Logo
        sheet.mergeCells('A1:A2');
        const logoBuffer = (0, logoHelper_1.getCompanyLogoBuffer)();
        if (logoBuffer) {
            try {
                const logoId = workbook.addImage({
                    buffer: logoBuffer,
                    extension: 'png'
                });
                sheet.addImage(logoId, {
                    tl: { col: 0.1, row: 0.1 },
                    ext: { width: 50, height: 50 }
                });
            }
            catch (e) {
                console.error('Logo add error in exportESICReportExcel:', e);
            }
        }
        // Row 1: Header
        sheet.mergeCells('B1:G1');
        const titleCell = sheet.getCell('B1');
        titleCell.value = 'FALCON INFO SOLUTIONS PVT. LTD.';
        titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9333EA' } }; // Purple
        titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(1).height = 30;
        // Row 2: Subtitle
        sheet.mergeCells('B2:G2');
        const subCell = sheet.getCell('B2');
        subCell.value = `EMPLOYEES' STATE INSURANCE (ESIC) MONTHLY RETURN — ${monthName.toUpperCase()} ${data.year}`;
        subCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF9333EA' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };
        subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sheet.getRow(2).height = 24;
        // Row 3: Blank
        sheet.getRow(3).height = 8;
        // Row 4: Column Headers
        const headers = [
            'Emp Code', 'Employee Name', 'ESIC IP Number', 'Gross Wages',
            'Employee Share (0.75%)', 'Employer Share (3.25%)', 'Total Contribution'
        ];
        const headerRow = sheet.getRow(4);
        headers.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF7E22CE' } },
                bottom: { style: 'medium', color: { argb: 'FF7E22CE' } },
            };
        });
        headerRow.height = 28;
        // Column Widths
        const colWidths = [14, 22, 18, 16, 24, 24, 20];
        let rowNum = 5;
        let sumWages = 0, sumEmpESIC = 0, sumEmrESIC = 0, sumTotalESIC = 0;
        const esicItems = data.items.filter((i) => i.esic_deduction > 0);
        const targetItems = esicItems.length > 0 ? esicItems : data.items;
        for (let i = 0; i < targetItems.length; i++) {
            const item = targetItems[i];
            const row = sheet.getRow(rowNum);
            const isEven = i % 2 === 0;
            const gross = item.gross_pay;
            const empESIC = item.esic_deduction;
            const emrESIC = Math.round(gross * 0.0325);
            const totalESIC = empESIC + emrESIC;
            sumWages += gross;
            sumEmpESIC += empESIC;
            sumEmrESIC += emrESIC;
            sumTotalESIC += totalESIC;
            const vals = [
                item.emp_code,
                item.emp_name,
                item.esic_number || 'PENDING',
                gross,
                empESIC,
                emrESIC,
                totalESIC
            ];
            vals.forEach((v, idx) => {
                const cell = row.getCell(idx + 1);
                cell.value = v;
                cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFFAF5FF' } };
                cell.border = thinBorder;
                if (idx === 0)
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                else if (idx === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
                }
                else if (idx === 2) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                else {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0.00';
                    if (idx === 6)
                        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF7E22CE' } };
                }
            });
            row.height = 21;
            rowNum++;
        }
        // Totals Row
        const totalsRow = sheet.getRow(rowNum);
        totalsRow.height = 24;
        sheet.mergeCells(`A${rowNum}:C${rowNum}`);
        const totLabel = totalsRow.getCell(1);
        totLabel.value = `TOTAL ESIC CONTRIBUTIONS (${targetItems.length} EMPLOYEES)`;
        totLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF7E22CE' } };
        totLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        const totalsObj = {
            4: sumWages,
            5: sumEmpESIC,
            6: sumEmrESIC,
            7: sumTotalESIC
        };
        for (let c = 1; c <= 7; c++) {
            const cell = totalsRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
            cell.border = {
                top: { style: 'double', color: { argb: 'FF7E22CE' } },
                bottom: { style: 'medium', color: { argb: 'FF7E22CE' } },
            };
            if (totalsObj[c] !== undefined) {
                cell.value = totalsObj[c];
                cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF7E22CE' } };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0.00';
            }
        }
        colWidths.forEach((w, idx) => {
            sheet.getColumn(idx + 1).width = w;
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ESIC_Report_${data.month}_${data.year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    /**
     * Export Summary PDF (Landscape)
     */
    static async exportPayrollSummaryPDF(params, res) {
        const data = await this.getReportData(params);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[data.month - 1];
        const doc = new pdfkit_1.default({ margin: 30, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Payroll_Summary_${data.month}_${data.year}.pdf"`);
        doc.pipe(res);
        // Render company logo
        const logoPath = (0, logoHelper_1.getCompanyLogoPath)();
        let textStartX = 30;
        if (logoPath) {
            try {
                doc.image(logoPath, 30, 20, { width: 44, height: 44 });
                textStartX = 84;
            }
            catch (e) {
                console.warn('Could not render logo in Payroll Summary PDF:', e);
            }
        }
        // Title banner
        doc.fillColor('#0E3B5C').fontSize(14).font('Helvetica-Bold')
            .text(`FALCON INFO SOLUTIONS PVT. LTD. — PAYROLL SUMMARY`, textStartX, 25);
        doc.fillColor('#5A6B75').fontSize(9).font('Helvetica')
            .text(`Period: ${monthName} ${data.year}  |  Status: ${data.status}  |  Total Working Days: ${data.total_working_days}  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`, textStartX, 46);
        let y = 72;
        doc.rect(30, y, 782, 22).fill('#0E3B5C');
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
            .text('Emp Code', 35, y + 6, { width: 65 })
            .text('Employee Name', 105, y + 6, { width: 140 })
            .text('Department', 250, y + 6, { width: 100 })
            .text('Payable Days', 355, y + 6, { width: 65, align: 'right' })
            .text('Gross Earnings', 425, y + 6, { width: 95, align: 'right' })
            .text('PF (12%)', 525, y + 6, { width: 50, align: 'right' })
            .text('ESIC', 580, y + 6, { width: 50, align: 'right' })
            .text('PT / TDS', 635, y + 6, { width: 60, align: 'right' })
            .text('Net Salary (INR)', 700, y + 6, { width: 105, align: 'right' });
        y += 22;
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (y > 540) {
                doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
                y = 40;
            }
            const bg = i % 2 === 0 ? '#FFFFFF' : '#F0F7FB';
            doc.rect(30, y, 782, 18).fill(bg).stroke('#CFE9F7');
            const ptTds = (item.pt_deduction || 0) + (item.tds_deduction || 0);
            doc.fillColor('#1A1A1A').fontSize(8).font('Helvetica')
                .text(item.emp_code, 35, y + 4, { width: 65 })
                .text(item.emp_name, 105, y + 4, { width: 140 })
                .text(item.department, 250, y + 4, { width: 100 })
                .text(String(item.payable_days), 355, y + 4, { width: 65, align: 'right' })
                .text(Number(item.gross_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 425, y + 4, { width: 95, align: 'right' })
                .text(Number(item.pf_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 525, y + 4, { width: 50, align: 'right' })
                .text(Number(item.esic_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 580, y + 4, { width: 50, align: 'right' })
                .text(ptTds.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 635, y + 4, { width: 60, align: 'right' })
                .font('Helvetica-Bold')
                .text(Number(item.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 700, y + 4, { width: 105, align: 'right' });
            y += 18;
        }
        // Totals Box
        doc.rect(30, y, 782, 24).fill('#EAF4FA').stroke('#0E3B5C');
        doc.fillColor('#0E3B5C').fontSize(9).font('Helvetica-Bold')
            .text('ORGANIZATION TOTALS:', 105, y + 7)
            .text(`INR ${Number(data.total_gross_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 425, y + 7, { width: 95, align: 'right' })
            .text(`INR ${Number(data.total_net_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 700, y + 7, { width: 105, align: 'right' });
        doc.end();
    }
}
exports.PayrollReportService = PayrollReportService;
