import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { query } from '../db';
import { CalculatedPayrollItem } from './payrollCalculationService';
import { getCompanyLogoPath } from '../utils/logoHelper';

function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero Rupees';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return b[tens] + (ones ? ' ' + a[ones] : '');
  }

  function convertGroup(n: number): string {
    let str = '';
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    if (hundreds > 0) {
      str += a[hundreds] + ' Hundred';
      if (remainder > 0) str += ' and ';
    }
    if (remainder > 0) {
      str += convertTwoDigits(remainder);
    }
    return str;
  }

  const crores = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundredsPart = rem;

  let words = '';
  if (crores > 0) words += convertGroup(crores) + ' Crore ';
  if (lakhs > 0) words += convertGroup(lakhs) + ' Lakh ';
  if (thousands > 0) words += convertGroup(thousands) + ' Thousand ';
  if (hundredsPart > 0) words += convertGroup(hundredsPart) + ' ';

  return (words.trim() + ' Rupees Only');
}

export class SalarySlipService {
  /**
   * Generates official Falcon Info Solutions PDF salary slip matching the official Falcon Payslip Template
   */
  static async generateSalarySlipPDF(
    item: CalculatedPayrollItem,
    year: number,
    month: number,
    profileData?: any
  ): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'salary_slips');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `salary_slip_${item.employee_id}_${year}_${String(month).padStart(2, '0')}.pdf`;
    const filePath = path.join(uploadDir, filename);
    const publicUrl = `/uploads/salary_slips/${filename}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthShortNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthName = monthNames[month - 1];
    const monthShort = monthShortNames[month - 1];
    const payPeriod = `For the month of ${monthName}, ${year}`;

    const logoPath = getCompanyLogoPath();
    const hasLogo = !!(logoPath && fs.existsSync(logoPath));

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Official Falcon Brand Colors from Template
      const cPrimaryNavy = '#0E3B5C';
      const cCyanAccent = '#2AAAE2';
      const cBgLightBlue = '#EAF4FA';
      const cBorderBlue = '#CFE9F7';
      const cTextDark = '#1A1A1A';
      const cTextMuted = '#5A6B75';

      let y = 36;
      const contentWidth = 523;
      const leftMargin = 36;

      // ==================== 1. HEADER SECTION ====================
      if (hasLogo) {
        try {
          doc.image(logoPath, leftMargin, y, { width: 56 });
        } catch (e) {
          // If image fails, fallback to title text
        }
      }

      const textStartX = hasLogo ? leftMargin + 66 : leftMargin;

      doc.fillColor(cPrimaryNavy).fontSize(14).font('Helvetica-Bold')
        .text('FALCON INFO SOLUTIONS PVT. LTD.', textStartX, y + 2);

      const addressY = y + 20;

      doc.fillColor(cTextMuted).fontSize(7.5).font('Helvetica')
        .text('E-13, Diya Park, Hanuvatkheda, Ladpura, Kota - 324004, Rajasthan, India', textStartX, addressY)
        .text('info@falconinfo.net  |  01204108910', textStartX, addressY + 11);

      // ==================== 2. EMPLOYEE DETAILS TABLE ====================
      y = 90;

      doc.rect(leftMargin, y, contentWidth, 18).fill(cPrimaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('EMPLOYEE DETAILS', leftMargin + 8, y + 5);

      y += 18;
      const empDetailsRows = [
        [
          { label: 'Employee Name', val: item.name },
          { label: 'Employee Code', val: item.employee_code }
        ],
        [
          { label: 'Designation', val: item.designation || 'Staff' },
          { label: 'Department', val: item.department || 'General' }
        ],
        [
          { label: 'Date of Joining', val: profileData?.joining_date ? new Date(profileData.joining_date).toLocaleDateString('en-GB') : 'On File' },
          { label: 'Pay Period', val: payPeriod }
        ],
        [
          { label: 'Paid Days', val: `${item.payable_days} Days` },
          { label: 'PAN No.', val: profileData?.pan_number || 'On File' }
        ],
        [
          { label: 'Account Number', val: profileData?.account_number ? `••••${String(profileData.account_number).slice(-4)} (${profileData?.bank_name || 'Bank'})` : 'Registered on File' },
          { label: 'EPF A/c Number', val: profileData?.uan_number || 'On File' }
        ],
      ];

      const rowH = 16;
      const c1W = 100;
      const c2W = 155;
      const c3W = 85;
      const c4W = 183;

      for (let i = 0; i < empDetailsRows.length; i++) {
        const rY = y + (i * rowH);
        const bg = i % 2 === 0 ? '#FFFFFF' : cBgLightBlue;
        doc.rect(leftMargin, rY, contentWidth, rowH).fill(bg).stroke(cBorderBlue);

        const pair = empDetailsRows[i];
        // Col 1 & 2
        doc.fillColor(cTextMuted).fontSize(7.5).font('Helvetica')
          .text(pair[0].label, leftMargin + 8, rY + 4);
        doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica-Bold')
          .text(pair[0].val, leftMargin + c1W, rY + 4, { width: c2W - 10 });

        // Col 3 & 4
        doc.fillColor(cTextMuted).fontSize(7.5).font('Helvetica')
          .text(pair[1].label, leftMargin + c1W + c2W + 8, rY + 4);
        doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica-Bold')
          .text(pair[1].val, leftMargin + c1W + c2W + c3W, rY + 4, { width: c4W - 10 });
      }

      y += empDetailsRows.length * rowH + 10;

      // ==================== 3. FIXED EARNINGS & DEDUCTIONS ====================
      const tblW = 256;
      const leftTblX = leftMargin;
      const rightTblX = leftMargin + tblW + 11; // 36 + 256 + 11 = 303

      // Headers
      doc.rect(leftTblX, y, tblW, 18).fill(cPrimaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('FIXED EARNINGS', leftTblX + 8, y + 5)
        .text('AMOUNT (INR)', leftTblX + 160, y + 5, { width: 88, align: 'right' });

      doc.rect(rightTblX, y, tblW, 18).fill(cPrimaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('DEDUCTIONS', rightTblX + 8, y + 5)
        .text('AMOUNT (INR)', rightTblX + 160, y + 5, { width: 88, align: 'right' });

      y += 18;
      const earningsData = [
        { label: 'Basic', val: item.earned_basic },
        { label: 'Dearness Allowance', val: item.earned_da },
        { label: 'Conveyance Allowance', val: item.earned_conveyance },
        { label: 'Travel Allowance', val: item.earned_hra }, // HRA / Travel component
        { label: 'Other Allowance', val: item.earned_medical + item.earned_special },
      ];

      // Other deductions combines PT, Advance, and other misc deductions
      const otherDeductionsTotal = (item.pt_deduction || 0) + (item.advance_deduction || 0) + (item.other_deductions || 0);

      const deductionsData = [
        { label: 'Provident Fund (PF)', val: item.pf_deduction },
        { label: 'ESIC', val: item.esic_deduction },
        { label: 'TDS', val: item.tds_deduction },
        { label: 'Other Deductions', val: otherDeductionsTotal },
        { label: '-', val: 0 },
      ];

      const itemRowH = 16;
      for (let i = 0; i < earningsData.length; i++) {
        const rY = y + (i * itemRowH);
        const bg = i % 2 === 0 ? '#FFFFFF' : cBgLightBlue;

        // Earnings row
        doc.rect(leftTblX, rY, tblW, itemRowH).fill(bg).stroke(cBorderBlue);
        const e = earningsData[i];
        doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica')
          .text(e.label, leftTblX + 8, rY + 4)
          .font('Helvetica-Bold')
          .text(e.val.toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftTblX + 160, rY + 4, { width: 88, align: 'right' });

        // Deductions row
        doc.rect(rightTblX, rY, tblW, itemRowH).fill(bg).stroke(cBorderBlue);
        const d = deductionsData[i];
        if (d.label !== '-') {
          doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica')
            .text(d.label, rightTblX + 8, rY + 4)
            .font('Helvetica-Bold')
            .text(d.val.toLocaleString('en-IN', { minimumFractionDigits: 2 }), rightTblX + 160, rY + 4, { width: 88, align: 'right' });
        }
      }

      y += earningsData.length * itemRowH;

      // Subtotals (Total Gross Earnings & Total Deductions)
      const subtotalH = 18;
      doc.rect(leftTblX, y, tblW, subtotalH).fill(cBgLightBlue).stroke(cPrimaryNavy);
      doc.fillColor(cPrimaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('Total Gross Earnings', leftTblX + 8, y + 5)
        .text(`INR ${item.gross_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, leftTblX + 130, y + 5, { width: 118, align: 'right' });

      doc.rect(rightTblX, y, tblW, subtotalH).fill(cBgLightBlue).stroke(cPrimaryNavy);
      doc.fillColor(cPrimaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('Total Deductions', rightTblX + 8, y + 5)
        .text(`INR ${item.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightTblX + 130, y + 5, { width: 118, align: 'right' });

      y += subtotalH + 10;

      // ==================== 4. EMPLOYER CONTRIBUTION & FLEXIBLE COMPENSATION ====================
      doc.rect(leftTblX, y, tblW, 18).fill(cPrimaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('EMPLOYER CONTRIBUTION', leftTblX + 8, y + 5)
        .text('AMOUNT (INR)', leftTblX + 160, y + 5, { width: 88, align: 'right' });

      doc.rect(rightTblX, y, tblW, 18).fill(cPrimaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('FLEXIBLE COMPENSATION', rightTblX + 8, y + 5)
        .text('AMOUNT (INR)', rightTblX + 160, y + 5, { width: 88, align: 'right' });

      y += 18;
      // Employer contribution matches: PF = 12% of basic; ESIC = 3.25% of gross (if applicable); LWF = 0
      const employerPF = item.pf_deduction > 0 ? item.pf_deduction : 0;
      const employerESIC = item.esic_deduction > 0 ? Math.round(item.gross_pay * 0.0325) : 0;
      const employerLWF = 0;
      const totalCTCContrib = employerPF + employerESIC + employerLWF;

      const flexibleBonus = (item.bonus || 0) + (item.incentive || 0);
      const flexibleOT = item.overtime_pay || 0;
      const flexibleShift = 0;
      const totalFlexible = flexibleBonus + flexibleOT + flexibleShift;

      const employerRows = [
        { label: 'Employer PF', val: employerPF },
        { label: 'Employer ESIC', val: employerESIC },
        { label: 'Employer LWF', val: employerLWF },
      ];

      const flexibleRows = [
        { label: 'Shift Allowance', val: flexibleShift },
        { label: 'Overtime (OT)', val: flexibleOT },
        { label: 'Field Allowance / Incentive', val: flexibleBonus },
      ];

      for (let i = 0; i < 3; i++) {
        const rY = y + (i * itemRowH);
        const bg = i % 2 === 0 ? '#FFFFFF' : cBgLightBlue;

        // Left Col
        doc.rect(leftTblX, rY, tblW, itemRowH).fill(bg).stroke(cBorderBlue);
        const er = employerRows[i];
        doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica')
          .text(er.label, leftTblX + 8, rY + 4)
          .font('Helvetica-Bold')
          .text(er.val.toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftTblX + 160, rY + 4, { width: 88, align: 'right' });

        // Right Col
        doc.rect(rightTblX, rY, tblW, itemRowH).fill(bg).stroke(cBorderBlue);
        const fr = flexibleRows[i];
        doc.fillColor(cTextDark).fontSize(7.5).font('Helvetica')
          .text(fr.label, rightTblX + 8, rY + 4)
          .font('Helvetica-Bold')
          .text(fr.val.toLocaleString('en-IN', { minimumFractionDigits: 2 }), rightTblX + 160, rY + 4, { width: 88, align: 'right' });
      }

      y += 3 * itemRowH;

      // Employer Contribution Total & Flexible Total
      doc.rect(leftTblX, y, tblW, subtotalH).fill(cBgLightBlue).stroke(cPrimaryNavy);
      doc.fillColor(cPrimaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('Total CTC Contribution', leftTblX + 8, y + 5)
        .text(`INR ${totalCTCContrib.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, leftTblX + 130, y + 5, { width: 118, align: 'right' });

      doc.rect(rightTblX, y, tblW, subtotalH).fill(cBgLightBlue).stroke(cPrimaryNavy);
      doc.fillColor(cPrimaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('Total Flexible', rightTblX + 8, y + 5)
        .text(`INR ${totalFlexible.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightTblX + 130, y + 5, { width: 118, align: 'right' });

      y += subtotalH + 10;

      // ==================== 5. NET SALARY BANNER ====================
      const netSalaryH = 40;
      doc.rect(leftMargin, y, contentWidth, netSalaryH).fill(cPrimaryNavy);

      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('NET SALARY', leftMargin + 12, y + 8);

      const netInWords = numberToIndianWords(Math.round(item.net_salary));
      doc.fillColor(cCyanAccent).fontSize(7.5).font('Helvetica-Oblique')
        .text(`In Words: ${netInWords}`, leftMargin + 12, y + 24, { width: 330 });

      doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold')
        .text(`INR ${item.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, leftMargin + 320, y + 12, { width: 190, align: 'right' });

      y += netSalaryH + 20;

      // ==================== 7. CONFIDENTIALITY NOTE ====================
      doc.rect(leftMargin, y, contentWidth, 32).fill(cBgLightBlue).stroke(cBorderBlue);
      doc.fillColor(cTextMuted).fontSize(6.5).font('Helvetica')
        .text(
          'Note: This payslip is a confidential record between Falcon Info Solutions Pvt. Ltd. and the employee named above. All figures are subject to statutory deductions and company policy as applicable for the stated pay period. For queries regarding this payslip, please contact the HR & Payroll department at info@falconinfo.net.',
          leftMargin + 8,
          y + 6,
          { width: contentWidth - 16, align: 'justify', lineGap: 1.5 }
        );

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    // Record in salary_slips table for employee access
    await query(`
      INSERT INTO salary_slips (employee_id, month, year, status, file_url, generated_date, updated_at)
      VALUES ($1, $2, $3, 'GENERATED', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (employee_id, month, year)
      DO UPDATE SET status = 'GENERATED', file_url = $4, generated_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    `, [item.employee_id, month, year, publicUrl]);

    return publicUrl;
  }
}
