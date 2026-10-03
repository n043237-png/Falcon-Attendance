"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceReport = void 0;
const db_1 = require("../db");
const attendanceStatusService_1 = require("../services/attendanceStatusService");
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const logoHelper_1 = require("../utils/logoHelper");
const getAttendanceReport = async (req, res) => {
    try {
        const { from, to, month, year, employeeId, shiftId, status, search, export: exportType } = req.query;
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        if (limit > 100 && !exportType)
            limit = 100;
        // 1. Determine Date Range
        let startDateStr = '';
        let endDateStr = '';
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (from && to) {
            startDateStr = String(from);
            endDateStr = String(to);
            if (startDateStr > endDateStr) {
                res.status(400).json({ success: false, error: { message: 'Invalid date range: from > to' } });
                return;
            }
        }
        else {
            const y = year ? parseInt(String(year)) : parseInt(todayStr.split('-')[0]);
            const m = month ? parseInt(String(month)) : parseInt(todayStr.split('-')[1]);
            startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
            const endDate = new Date(y, m, 0);
            endDateStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        // Do not project future attendance statuses
        const actualEndStr = endDateStr > todayStr ? todayStr : endDateStr;
        // 2. Fetch Employees
        let empQuery = `
      SELECT u.id, u.name, u.email, u.employee_id, u.employee_code, u.department, u.designation,
             COALESCE(u.attendance_mode, 'Office') as attendance_mode,
             u.shift_id, s.name as shift_name, s.code as shift_code
      FROM users u
      LEFT JOIN shifts s ON s.id = u.shift_id
      WHERE u.status = 'active'
    `;
        const empParams = [];
        if (employeeId) {
            empParams.push(employeeId);
            empQuery += ` AND u.id = $${empParams.length}`;
        }
        if (shiftId && shiftId !== 'All') {
            empParams.push(parseInt(shiftId, 10));
            empQuery += ` AND u.shift_id = $${empParams.length}`;
        }
        if (search) {
            empParams.push(`%${search}%`);
            empQuery += ` AND (u.name ILIKE $${empParams.length} OR u.employee_id ILIKE $${empParams.length} OR u.employee_code ILIKE $${empParams.length} OR u.email ILIKE $${empParams.length} OR u.department ILIKE $${empParams.length} OR u.designation ILIKE $${empParams.length})`;
        }
        empQuery += ` ORDER BY 
      CASE 
        WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
        WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
        ELSE 2 
      END, 
      NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
      u.employee_id ASC`;
        const empRes = await (0, db_1.query)(empQuery, empParams);
        const employees = empRes.rows;
        if (employees.length === 0) {
            res.json({
                success: true,
                data: {
                    period: { from: startDateStr, to: endDateStr },
                    summary: { employees: 0, workingDays: 0, present: 0, absent: 0, halfDay: 0, onLeave: 0, late: 0, totalWorkingMinutes: 0, attendancePercentage: 0 },
                    employees: [],
                    pagination: { total: 0, page, limit, totalPages: 0 }
                }
            });
            return;
        }
        // Pagination slice for UI (if export, we process all filtered)
        let paginatedEmployees = employees;
        if (!exportType) {
            const offset = (page - 1) * limit;
            paginatedEmployees = employees.slice(offset, offset + limit);
        }
        // We actually need to calculate the summary for the *paginated* employees or ALL employees? 
        // Usually, top-level summary represents the filtered dataset (all pages).
        // Let's process all matched employees to get the exact summary, then paginate the final output array.
        // 3. Fetch Related Data
        const empIds = employees.map(e => e.id);
        // Be careful with large array in IN clause. If it's too large, we might need a join. But 100-200 employees is fine.
        const [attRes, settings, holRes, leaveRes] = await Promise.all([
            (0, db_1.query)(`SELECT * FROM attendance WHERE attendance_date >= $1 AND attendance_date <= $2`, [startDateStr, actualEndStr]),
            (0, attendanceStatusService_1.getAttendanceSettings)(),
            (0, db_1.query)(`SELECT holiday_date, name FROM holidays WHERE is_active = true AND holiday_date >= $1 AND holiday_date <= $2`, [startDateStr, actualEndStr]),
            (0, db_1.query)(`SELECT *, from_date as start_date, to_date as end_date FROM leave_requests WHERE status = 'APPROVED' AND from_date <= $2 AND to_date >= $1`, [startDateStr, actualEndStr])
        ]);
        const attMap = new Map();
        for (const r of attRes.rows) {
            const d = new Date(r.attendance_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const k = `${r.employee_id}_${d}`;
            attMap.set(k, r);
        }
        const holMap = new Map(holRes.rows.map(r => [new Date(r.holiday_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), r]));
        const leaveMap = new Map();
        for (const lr of leaveRes.rows) {
            let d = new Date(lr.start_date);
            const end = new Date(lr.end_date);
            while (d <= end) {
                const dStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const k = `${lr.employee_id}_${dStr}`;
                leaveMap.set(k, lr);
                d.setDate(d.getDate() + 1);
            }
        }
        let globalSummary = {
            employees: employees.length,
            workingDays: 0,
            present: 0,
            absent: 0,
            halfDay: 0,
            insufficientHours: 0,
            checkoutMissing: 0,
            onLeave: 0,
            paidLeave: 0,
            lwp: 0,
            late: 0,
            totalWorkingMinutes: 0,
            attendancePercentage: 0,
            totalExpectedDays: 0
        };
        const employeeReports = [];
        // Precalculate working days in the period
        let workingDaysCount = 0;
        if (startDateStr <= actualEndStr) {
            let curr = new Date(startDateStr);
            const end = new Date(actualEndStr);
            while (curr <= end) {
                const dStr = curr.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                if (curr.getDay() !== 0 && !holMap.has(dStr)) {
                    workingDaysCount++;
                }
                curr.setDate(curr.getDate() + 1);
            }
        }
        globalSummary.workingDays = workingDaysCount;
        for (const emp of employees) {
            let empSummary = {
                present: 0,
                absent: 0,
                halfDay: 0,
                insufficientHours: 0,
                checkoutMissing: 0,
                onLeave: 0,
                paidLeave: 0,
                lwp: 0,
                late: 0,
                totalWorkingMinutes: 0,
                attendancePercentage: 0,
                totalExpectedDays: 0
            };
            const dailyRecords = [];
            let curr = new Date(startDateStr);
            const end = new Date(actualEndStr);
            while (curr <= end) {
                const dStr = curr.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const rec = attMap.get(`${emp.id}_${dStr}`);
                const hol = holMap.has(dStr) ? { holiday_date: dStr, name: holMap.get(dStr).name } : null;
                const lve = leaveMap.get(`${emp.id}_${dStr}`);
                const result = (0, attendanceStatusService_1.calculateStatus)(dStr, rec, settings, hol, lve, new Date());
                result.holidayName = result.holidayName || null;
                result.leaveType = lve ? lve.leave_type : null;
                if (!status || status === 'All' || result.status === status) {
                    dailyRecords.push({
                        date: dStr,
                        day: curr.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
                        status: result.status,
                        checkIn: result.checkIn ? result.checkIn.toISOString() : null,
                        checkOut: result.checkOut ? result.checkOut.toISOString() : null,
                        workingMinutes: Math.round(result.workingMinutes),
                        lateMinutes: rec?.late_minutes || 0,
                        overtimeMinutes: rec?.overtime_minutes || 0,
                        earlyDepartureMinutes: rec?.early_departure_minutes || 0,
                        shiftId: rec?.shift_id || emp.shift_id,
                        shiftName: emp.shift_name,
                        leaveType: result.leaveType,
                        holidayName: result.holidayName,
                        isLate: result.status === 'PRESENT' && result.isLate,
                        attendanceMode: rec?.attendance_mode || emp.attendance_mode || 'Office',
                        address: rec?.check_in_address || null,
                        selfieUrl: rec?.check_in_selfie_url || null
                    });
                }
                // Summary calculations
                if (result.status === 'PRESENT') {
                    empSummary.present++;
                    if (result.isLate)
                        empSummary.late++;
                }
                else if (result.status === 'ABSENT') {
                    empSummary.absent++;
                }
                else if (result.status === 'INSUFFICIENT_HOURS') {
                    empSummary.insufficientHours++;
                }
                else if (result.status === 'HALF_DAY') {
                    empSummary.halfDay++;
                }
                else if (result.status === 'CHECKOUT_MISSING') {
                    empSummary.checkoutMissing++;
                }
                else if (result.status === 'ON_LEAVE' || result.status === 'HALF_DAY_LEAVE') {
                    empSummary.onLeave++;
                    if (result.leaveType === 'Paid Leave')
                        empSummary.paidLeave++;
                    else if (result.leaveType === 'Leave Without Pay')
                        empSummary.lwp++;
                }
                empSummary.totalWorkingMinutes += result.workingMinutes;
                if (result.status !== 'HOLIDAY' && result.status !== 'SUNDAY' && result.status !== 'NOT_MARKED') {
                    empSummary.totalExpectedDays++;
                }
                curr.setDate(curr.getDate() + 1);
            }
            const attended = empSummary.present + (empSummary.halfDay * 0.5);
            const required = empSummary.totalExpectedDays - empSummary.onLeave;
            empSummary.attendancePercentage = required > 0 ? Math.round((attended / required) * 100) : 100;
            globalSummary.present += empSummary.present;
            globalSummary.absent += empSummary.absent;
            globalSummary.halfDay += empSummary.halfDay;
            globalSummary.insufficientHours += empSummary.insufficientHours;
            globalSummary.checkoutMissing += empSummary.checkoutMissing;
            globalSummary.onLeave += empSummary.onLeave;
            globalSummary.paidLeave += empSummary.paidLeave;
            globalSummary.lwp += empSummary.lwp;
            globalSummary.late += empSummary.late;
            globalSummary.totalWorkingMinutes += empSummary.totalWorkingMinutes;
            globalSummary.totalExpectedDays += empSummary.totalExpectedDays;
            // Only include employee if they have daily records matching the filter (or if no status filter)
            if (dailyRecords.length > 0) {
                employeeReports.push({
                    id: emp.id,
                    name: emp.name,
                    email: emp.email,
                    empId: emp.employee_code || emp.employee_id,
                    employeeCode: emp.employee_code || emp.employee_id,
                    attendanceMode: emp.attendance_mode || 'Office',
                    shiftId: emp.shift_id,
                    shiftName: emp.shift_name,
                    shiftCode: emp.shift_code,
                    summary: empSummary,
                    daily: dailyRecords
                });
            }
        }
        const totalAttended = globalSummary.present + (globalSummary.halfDay * 0.5);
        const totalRequired = globalSummary.totalExpectedDays - globalSummary.onLeave;
        globalSummary.attendancePercentage = totalRequired > 0 ? Math.round((totalAttended / totalRequired) * 100) : 100;
        // Apply sorting to employeeReports (by % attendance, present count, name, or serial-wise employee ID)
        const sortField = req.query.sort;
        const order = req.query.order === 'desc' ? -1 : 1;
        if (sortField === 'attendancePercentage') {
            employeeReports.sort((a, b) => (a.summary.attendancePercentage - b.summary.attendancePercentage) * order);
        }
        else if (sortField === 'present') {
            employeeReports.sort((a, b) => (a.summary.present - b.summary.present) * order);
        }
        else if (sortField === 'name') {
            employeeReports.sort((a, b) => a.name.localeCompare(b.name) * order);
        }
        else {
            // Default: Serial-wise as per Employee ID (ADMIN001, FISPL0001, FISPL0002...)
            employeeReports.sort((a, b) => {
                const codeA = (a.employeeCode || a.empId || '').trim();
                const codeB = (b.employeeCode || b.empId || '').trim();
                const rankA = codeA.toUpperCase().startsWith('ADMIN') ? 0 : (codeA.toUpperCase().startsWith('FISPL') ? 1 : 2);
                const rankB = codeB.toUpperCase().startsWith('ADMIN') ? 0 : (codeB.toUpperCase().startsWith('FISPL') ? 1 : 2);
                if (rankA !== rankB)
                    return (rankA - rankB) * order;
                const numA = parseInt(codeA.replace(/\D/g, ''), 10);
                const numB = parseInt(codeB.replace(/\D/g, ''), 10);
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                    return (numA - numB) * order;
                }
                return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' }) * order;
            });
        }
        if (exportType === 'excel') {
            return await exportExcel(res, globalSummary, employeeReports, startDateStr, endDateStr);
        }
        else if (exportType === 'pdf') {
            return await exportPdf(res, globalSummary, employeeReports, startDateStr, endDateStr);
        }
        // Pagination for UI
        const offset = (page - 1) * limit;
        const paginated = employeeReports.slice(offset, offset + limit);
        res.json({
            success: true,
            data: {
                period: { from: startDateStr, to: endDateStr },
                summary: globalSummary,
                employees: paginated,
                pagination: {
                    total: employeeReports.length,
                    page,
                    limit,
                    totalPages: Math.ceil(employeeReports.length / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ success: false, error: { message: 'Server error generating report' } });
    }
};
exports.getAttendanceReport = getAttendanceReport;
const formatMins = (m) => `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m`;
async function exportExcel(res, summary, employeeReports, from, to) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = 'Falcon Info Solutions';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Attendance Report', {
        properties: { tabColor: { argb: 'FF2563EB' } }
    });
    // 1. Column Widths
    sheet.columns = [
        { width: 16 }, // A: Employee ID
        { width: 28 }, // B: Employee Name
        { width: 15 }, // C: Date
        { width: 14 }, // D: Day
        { width: 15 }, // E: Check In
        { width: 15 }, // F: Check Out
        { width: 16 }, // G: Working Hours
        { width: 16 }, // H: Status
        { width: 22 }, // I: Location / Notes
    ];
    // 2. Borders and Styles
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    const cardBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    // 3. Top Banner (Rows 1 to 4)
    sheet.getRow(1).height = 10;
    sheet.getRow(2).height = 26;
    sheet.getRow(3).height = 20;
    sheet.getRow(4).height = 18;
    sheet.getRow(5).height = 14;
    // Add company logo cleanly in Column A without overlapping any text
    const logoBuffer = (0, logoHelper_1.getCompanyLogoBuffer)();
    if (logoBuffer) {
        try {
            const logoId = workbook.addImage({
                buffer: logoBuffer,
                extension: 'png'
            });
            sheet.addImage(logoId, {
                tl: { col: 0.15, row: 1.1 },
                ext: { width: 56, height: 56 }
            });
        }
        catch (e) {
            console.error('Logo add error in exportExcel:', e);
        }
    }
    sheet.mergeCells('B2:I2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = 'FALCON INFO SOLUTIONS';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.mergeCells('B3:I3');
    const subCell = sheet.getCell('B3');
    subCell.value = 'Enterprise Attendance & Compliance Report';
    subCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.mergeCells('B4:I4');
    const metaCell = sheet.getCell('B4');
    const genDate = new Date().toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    metaCell.value = `Reporting Range: ${from} to ${to}   |   Generated On: ${genDate}   |   GPS & Office Verified`;
    metaCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    // 4. Blank Buffer Row (Row 5)
    sheet.getRow(5).height = 12;
    // 5. Table Header (Row 6)
    sheet.getRow(6).height = 30;
    const headers = [
        'Employee ID',
        'Employee Name',
        'Date',
        'Day',
        'Check In',
        'Check Out',
        'Working Hours',
        'Status',
        'Location / Remarks'
    ];
    headers.forEach((h, idx) => {
        const cell = sheet.getRow(6).getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = {
            vertical: 'middle',
            horizontal: idx === 1 ? 'left' : 'center',
            indent: idx === 1 ? 1 : 0
        };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
            left: { style: 'thin', color: { argb: 'FF3B82F6' } },
            bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
            right: { style: 'thin', color: { argb: 'FF3B82F6' } }
        };
    });
    // 6. Table Data Rows (Row 7+)
    let currentRowIdx = 7;
    for (const er of employeeReports) {
        for (const d of er.daily) {
            const inTime = d.checkIn
                ? new Date(d.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                : '-';
            const outTime = d.checkOut
                ? new Date(d.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                : '-';
            const hours = d.workingMinutes ? formatMins(d.workingMinutes) : (d.status === 'PRESENT' ? '8h 0m' : '-');
            let loc = d.leaveType || d.holidayName || '-';
            if ((d.status === 'PRESENT' || d.status === 'HALF_DAY') && loc === '-') {
                loc = 'Office (GPS)';
            }
            let st = d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase().replace(/_/g, ' ');
            if (d.status === 'ON_LEAVE' || d.status === 'HALF_DAY_LEAVE')
                st = 'Leave';
            if (d.status === 'INSUFFICIENT_HOURS')
                st = 'Insufficient Hours';
            if (d.status === 'CHECKOUT_MISSING')
                st = 'Checkout Missing';
            const row = sheet.getRow(currentRowIdx);
            row.height = 22;
            const isEven = currentRowIdx % 2 === 0;
            const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
            // Status pill coloring - completely distinct per status
            let statusBg = 'FFF1F5F9';
            let statusColor = 'FF475569';
            if (d.status === 'PRESENT') {
                statusBg = 'FFDCFCE7'; // Soft emerald
                statusColor = 'FF15803D';
            }
            else if (d.status === 'ABSENT') {
                statusBg = 'FFFEE2E2'; // Soft rose red
                statusColor = 'FFB91C1C';
            }
            else if (d.status === 'INSUFFICIENT_HOURS') {
                statusBg = 'FFFFEDD5'; // Warm orange / peach (distinct from absent!)
                statusColor = 'FFC2410C';
            }
            else if (d.status === 'CHECKOUT_MISSING') {
                statusBg = 'FFF3E8FF'; // Lavender purple (distinct from absent!)
                statusColor = 'FF7E22CE';
            }
            else if (d.status === 'HALF_DAY') {
                statusBg = 'FFFEF3C7'; // Amber yellow
                statusColor = 'FFB45309';
            }
            else if (d.status === 'ON_LEAVE' || d.status === 'HALF_DAY_LEAVE') {
                statusBg = 'FFDBEAFE'; // Soft blue
                statusColor = 'FF1D4ED8';
            }
            else if (d.status === 'SUNDAY') {
                statusBg = 'FFF1F5F9';
                statusColor = 'FF64748B';
            }
            else if (d.status === 'HOLIDAY') {
                statusBg = 'FFEDE9FE';
                statusColor = 'FF6D28D9';
            }
            const cellData = [
                { val: er.empId || `EMP${String(er.id).padStart(3, '0')}`, align: 'center', bold: true, color: 'FF334155' },
                { val: er.name, align: 'left', bold: true, color: 'FF0F172A', indent: 1 },
                { val: d.date, align: 'center', color: 'FF475569' },
                { val: d.day || '-', align: 'center', color: 'FF64748B' },
                { val: inTime, align: 'center', color: inTime !== '-' ? 'FF0F172A' : 'FF94A3B8' },
                { val: outTime, align: 'center', color: outTime !== '-' ? 'FF0F172A' : 'FF94A3B8' },
                { val: hours, align: 'center', bold: hours !== '-', color: hours !== '-' ? 'FF0F172A' : 'FF94A3B8' },
                { val: st, align: 'center', bold: true, color: statusColor, bg: statusBg },
                { val: loc, align: 'center', color: 'FF64748B' }
            ];
            cellData.forEach((cd, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                cell.value = cd.val;
                cell.font = {
                    name: 'Segoe UI',
                    size: 9.5,
                    bold: !!cd.bold,
                    color: { argb: cd.color || 'FF0F172A' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: cd.bg || rowBg }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: cd.align,
                    indent: cd.indent || 0
                };
                cell.border = thinBorder;
            });
            currentRowIdx++;
        }
    }
    // 7. Auto-filter and Frozen Panes
    sheet.autoFilter = { from: 'A6', to: 'I6' };
    sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 6, showGridLines: true }
    ];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${from}-to-${to}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
}
async function exportPdf(res, summary, employeeReports, from, to) {
    const doc = new pdfkit_1.default({
        margin: 36,
        size: 'A4',
        layout: 'landscape',
        bufferPages: true
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${from}-to-${to}.pdf`);
    doc.pipe(res);
    const pageWidth = doc.page.width; // 841.89
    const pageHeight = doc.page.height; // 595.28
    const tableW = pageWidth - 72; // 769.89
    const drawHeader = () => {
        // Top navy accent line
        doc.rect(0, 0, pageWidth, 5).fill('#1E3A8A');
        // Company logo
        const logoPath = (0, logoHelper_1.getCompanyLogoPath)();
        let logoX = 36;
        if (logoPath) {
            try {
                doc.image(logoPath, 36, 18, { width: 44, height: 44 });
                logoX = 88;
            }
            catch (e) {
                console.error('Logo add error in exportPdf:', e);
            }
        }
        // Title & Subtitle
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text('FALCON INFO SOLUTIONS', logoX, 22);
        doc.font('Helvetica').fontSize(10).fillColor('#475569').text('Executive Attendance & Workforce Analytics Report', logoX, 42);
        // Right Side Metadata Card
        const badgeW = 240;
        const badgeH = 46;
        const badgeX = pageWidth - 36 - badgeW;
        const badgeY = 20;
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E3A8A').text('REPORTING PERIOD', badgeX + 12, badgeY + 6);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0F172A').text(`${from} to ${to}`, badgeX + 12, badgeY + 17);
        const genDate = new Date().toLocaleDateString('en-US', {
            timeZone: 'Asia/Kolkata',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(`Month-to-Date: ${summary.workingDays} Days × ${summary.employees} Staff = ${summary.totalExpectedDays} Expected`, badgeX + 12, badgeY + 29);
        doc.font('Helvetica').fontSize(7).fillColor('#94A3B8').text(`Generated: ${genDate}  |  GPS & Office Verified`, badgeX + 12, badgeY + 38);
    };
    const columns = [
        { label: 'EMPLOYEE NAME', width: 180, align: 'left' },
        { label: 'PRESENT', width: 56, align: 'center' },
        { label: 'ABSENT', width: 56, align: 'center' },
        { label: 'INSUFFICIENT', width: 74, align: 'center' },
        { label: 'MISSING OUT', width: 74, align: 'center' },
        { label: 'HALF DAY', width: 56, align: 'center' },
        { label: 'LEAVE', width: 54, align: 'center' },
        { label: 'LATE', width: 50, align: 'center' },
        { label: 'TOTAL HOURS', width: 90, align: 'center' },
        { label: 'ATT %', width: 60, align: 'center' }
    ];
    const drawTableHeader = (y) => {
        doc.roundedRect(36, y, tableW, 24, 4).fill('#1E3A8A');
        let x = 36;
        columns.forEach((col) => {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
            const textX = col.align === 'left' ? x + 10 : x;
            doc.text(col.label, textX, y + 8, {
                width: col.width - (col.align === 'left' ? 10 : 0),
                align: col.align,
                lineBreak: false
            });
            x += col.width;
        });
        return y + 24;
    };
    // 1. Initial Page Render (Header banner + table directly without KPI cards)
    drawHeader();
    // Section Title
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E3A8A').text('EMPLOYEE ATTENDANCE BREAKDOWN', 36, 80);
    let currentY = drawTableHeader(100);
    const rowH = 22;
    employeeReports.forEach((er, rIdx) => {
        if (currentY + rowH > pageHeight - 50) {
            doc.addPage();
            doc.rect(0, 0, pageWidth, 5).fill('#1E3A8A');
            currentY = drawTableHeader(36);
        }
        const isEven = rIdx % 2 === 0;
        const rowBg = isEven ? '#FFFFFF' : '#F8FAFC';
        // Row Background & Line
        doc.rect(36, currentY, tableW, rowH).fill(rowBg);
        doc.rect(36, currentY + rowH - 0.5, tableW, 0.5).fill('#E2E8F0');
        const cells = [
            { val: `${er.name}${er.empId ? ` (${er.empId})` : ''}`, align: 'left', font: 'Helvetica-Bold', color: '#0F172A' },
            { val: String(er.summary.present), align: 'center', font: 'Helvetica-Bold', color: er.summary.present > 0 ? '#15803D' : '#0F172A' },
            { val: String(er.summary.absent), align: 'center', font: er.summary.absent > 0 ? 'Helvetica-Bold' : 'Helvetica', color: er.summary.absent > 0 ? '#B91C1C' : '#64748B' },
            { val: String(er.summary.insufficientHours || 0), align: 'center', font: er.summary.insufficientHours > 0 ? 'Helvetica-Bold' : 'Helvetica', color: er.summary.insufficientHours > 0 ? '#C2410C' : '#64748B' },
            { val: String(er.summary.checkoutMissing || 0), align: 'center', font: er.summary.checkoutMissing > 0 ? 'Helvetica-Bold' : 'Helvetica', color: er.summary.checkoutMissing > 0 ? '#7E22CE' : '#64748B' },
            { val: String(er.summary.halfDay), align: 'center', font: 'Helvetica', color: er.summary.halfDay > 0 ? '#B45309' : '#64748B' },
            { val: String(er.summary.onLeave), align: 'center', font: 'Helvetica', color: er.summary.onLeave > 0 ? '#1D4ED8' : '#64748B' },
            { val: String(er.summary.late), align: 'center', font: 'Helvetica', color: er.summary.late > 0 ? '#B45309' : '#64748B' },
            { val: formatMins(er.summary.totalWorkingMinutes), align: 'center', font: 'Helvetica', color: '#1E293B' },
            { val: `${er.summary.attendancePercentage}%`, align: 'center', font: 'Helvetica-Bold', color: '#2563EB' }
        ];
        let x = 36;
        cells.forEach((c, idx) => {
            const col = columns[idx];
            doc.font(c.font).fontSize(8.5).fillColor(c.color);
            const textX = col.align === 'left' ? x + 10 : x;
            doc.text(c.val, textX, currentY + 6, {
                width: col.width - (col.align === 'left' ? 10 : 0),
                align: col.align,
                lineBreak: false
            });
            x += col.width;
        });
        currentY += rowH;
    });
    // Footers on all buffered pages (with bottom margin 0 and lineBreak false to avoid phantom extra pages)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        const footerY = pageHeight - 25;
        doc.rect(36, footerY - 5, tableW, 0.5).fill('#E2E8F0');
        doc.font('Helvetica').fontSize(8).fillColor('#94A3B8')
            .text('Falcon Info Solutions • Confidential Internal Attendance & Compliance Report', 36, footerY, {
            width: 450,
            align: 'left',
            lineBreak: false
        });
        doc.font('Helvetica').fontSize(8).fillColor('#94A3B8')
            .text(`Page ${i + 1} of ${range.count}`, pageWidth - 150, footerY, {
            width: 114,
            align: 'right',
            lineBreak: false
        });
    }
    doc.end();
}
