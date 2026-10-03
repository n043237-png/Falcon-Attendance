import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { getCompanyLogoPath } from '../utils/logoHelper';

/**
 * Generates an executive, print-ready "Rules of Attendance & Punctuality Policy" PDF
 * for Falcon Info Solutions.
 */
export async function generateAttendanceRulesPdf(outputPath?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      autoFirstPage: true,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`[PDF] Attendance Policy PDF saved to: ${outputPath}`);
      }
      resolve(pdfBuffer);
    });
    doc.on('error', (err) => reject(err));

    const pageWidth = doc.page.width;   // 595.28 pt
    const pageHeight = doc.page.height; // 841.89 pt
    const contentW = pageWidth - 80;    // 515.28 pt
    const leftMargin = 40;

    // Helper: Header on each page
    const drawPageHeader = (pageNum: number) => {
      // Top accent bar
      doc.rect(0, 0, pageWidth, 6).fill('#1E3A8A');

      // Top logo & corporate header
      const logoPath = getCompanyLogoPath();
      let headerX = leftMargin;
      if (logoPath && fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, leftMargin, 16, { width: 38, height: 38 });
          headerX = leftMargin + 46;
        } catch {}
      }

      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text('FALCON INFO SOLUTIONS', headerX, 18);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB').text('CORPORATE ATTENDANCE & WORKFORCE PUNCTUALITY POLICY', headerX, 34);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text('Standard Operating Procedures • Policy Doc: FIS-POL-ATT-2026-V2', headerX, 46);

      // Top divider line
      doc.strokeColor('#CBD5E1').lineWidth(0.8).moveTo(leftMargin, 62).lineTo(pageWidth - leftMargin, 62).stroke();
    };

    // Helper: Footer on each page
    const drawPageFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 32;
      doc.strokeColor('#E2E8F0').lineWidth(0.6).moveTo(leftMargin, footerY - 6).lineTo(pageWidth - leftMargin, footerY - 6).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#94A3B8').text(
        'Falcon Info Solutions HQ • Confidential & Proprietary Internal Policy Document',
        leftMargin,
        footerY,
        { width: contentW - 80, align: 'left' }
      );
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth - leftMargin - 70,
        footerY,
        { width: 70, align: 'right' }
      );
    };

    // ------------------------------------------------------------------------
    // PAGE 1: Policy Overview, Shift Schedule & Attendance Rules
    // ------------------------------------------------------------------------
    drawPageHeader(1);

    let y = 74;

    // Title Banner Card
    doc.roundedRect(leftMargin, y, contentW, 46, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1E3A8A').text(
      'RULES OF ATTENDANCE, SHIFT TIMINGS & WORKING HOURS',
      leftMargin + 14,
      y + 10
    );
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(
      'Applicable to: All Corporate Employees, Field Executives, Staff & Trainees across all departments.',
      leftMargin + 14,
      y + 28
    );

    y += 56;

    // SECTION 1: Shift Timings & Core Schedule
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('1. SHIFT TIMINGS & CORE SCHEDULE', leftMargin + 10, y + 1);
    y += 20;

    doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
      'Falcon Info Solutions operates on a standard 6-day working schedule (Monday through Saturday) with Sunday designated as a weekly off. Punctuality is strictly enforced via the Falcon Attendance System.',
      leftMargin,
      y,
      { width: contentW, align: 'justify', lineGap: 2 }
    );
    y += 26;

    // Shift Table
    const tableHeaders = ['PARAMETER', 'SCHEDULED TIME / DURATION', 'SYSTEM ACTION & RULE'];
    const colW = [140, 160, 215.28];

    // Table Header
    doc.roundedRect(leftMargin, y, contentW, 20, 2).fill('#1E3A8A');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
    doc.text(tableHeaders[0], leftMargin + 8, y + 6);
    doc.text(tableHeaders[1], leftMargin + colW[0] + 6, y + 6);
    doc.text(tableHeaders[2], leftMargin + colW[0] + colW[1] + 6, y + 6);
    y += 20;

    const shiftRows = [
      ['Official Shift Start', '09:30 AM', 'Normal check-in window opens. App allows check-in.'],
      ['Grace Period Allowed', '09:30 AM – 10:00 AM (30 Mins)', 'Check-in during this grace period is marked as ON-TIME.'],
      ['Late Mark Threshold', '10:01 AM Onwards', 'Check-ins after 10:00 AM are recorded as LATE with exact minutes.'],
      ['Absence Cutoff Deadline', '11:00 AM Sharp', 'Unmarked employees without approved leave are marked ABSENT.'],
      ['Official Shift End', '06:30 PM', 'Shift ends. Full day completion alerts generated.'],
      ['Checkout Grace Window', '06:30 PM – 07:00 PM (30 Mins)', 'Grace window to punch checkout before missing checkout alert.'],
      ['Missing Checkout Deadline', '07:00 PM (19:00 IST)', 'If no checkout recorded, flagged as CHECKOUT MISSING.'],
    ];

    shiftRows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(leftMargin, y, contentW, 19).fill(bg);
      doc.strokeColor('#E2E8F0').lineWidth(0.5).rect(leftMargin, y, contentW, 19).stroke();

      doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#1E293B').text(r[0], leftMargin + 8, y + 5);
      doc.font('Helvetica').fontSize(7.8).fillColor('#0284C7').text(r[1], leftMargin + colW[0] + 6, y + 5);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(r[2], leftMargin + colW[0] + colW[1] + 6, y + 5, { width: colW[2] - 10 });
      y += 19;
    });

    y += 12;

    // SECTION 2: Working Hours & Attendance Status Hierarchy
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('2. DAILY WORKING HOURS & STATUS CRITERIA', leftMargin + 10, y + 1);
    y += 20;

    doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
      'Daily attendance status is determined strictly by cumulative net working minutes elapsed between verified Check-In and Check-Out timestamps:',
      leftMargin,
      y,
      { width: contentW, align: 'justify', lineGap: 2 }
    );
    y += 22;

    // Status Hierarchy Table
    doc.roundedRect(leftMargin, y, contentW, 20, 2).fill('#0F172A');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
    doc.text('STATUS', leftMargin + 8, y + 6);
    doc.text('MINUTES REQUIRED', leftMargin + 110, y + 6);
    doc.text('HOURS EQUIVALENT', leftMargin + 240, y + 6);
    doc.text('PAYROLL / ATTENDANCE CREDIT', leftMargin + 360, y + 6);
    y += 20;

    const statusRows = [
      ['PRESENT / FULL DAY', '510 Minutes or more', '8 Hours 30 Mins +', '100% Full Day Attendance Credit', '#059669', '#ECFDF5'],
      ['HALF DAY', '255 to 509 Minutes', '4h 15m to 8h 29m', '50% Half Day Credit (0.5 Day)', '#D97706', '#FEF3C7'],
      ['INSUFFICIENT HOURS', 'Less than 255 Minutes', 'Under 4 Hours 15 Mins', '0% Credit — Counted as Absent', '#DC2626', '#FEF2F2'],
      ['CHECKOUT MISSING', 'Check-In only, no Check-Out', 'Indeterminate Duration', 'Requires Administrative Regularization', '#E11D48', '#FFF1F2'],
      ['ABSENT', 'No Check-In by 11:00 AM', '0 Hours', '0% Credit — Unexcused Absence', '#991B1B', '#FEE2E2'],
    ];

    statusRows.forEach((s) => {
      doc.rect(leftMargin, y, contentW, 20).fill(s[5]);
      doc.strokeColor('#E2E8F0').lineWidth(0.5).rect(leftMargin, y, contentW, 20).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(s[4]).text(s[0], leftMargin + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E293B').text(s[1], leftMargin + 110, y + 5);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(s[2], leftMargin + 240, y + 5);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(s[3], leftMargin + 360, y + 5);
      y += 20;
    });

    y += 14;

    // SECTION 3: Geofencing & Attendance Modes
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('3. GEOFENCING & ATTENDANCE MODES', leftMargin + 10, y + 1);
    y += 20;

    // Two-column box for Office vs Field
    const boxW = (contentW - 10) / 2;

    // Office Mode Box
    doc.roundedRect(leftMargin, y, boxW, 82, 4).fillAndStroke('#F0FDF4', '#BBF7D0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#166534').text('🏢 OFFICE MODE (Standard Employees)', leftMargin + 10, y + 10);
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(
      '• Strictly geofenced within 20 metres of Falcon Info Solutions HQ.\n• High-accuracy GPS verification is required before punch is accepted.\n• Check-in outside 20m perimeter is blocked automatically by system.\n• Wi-Fi or Cellular GPS accuracy must be under 30 metres.',
      leftMargin + 10,
      y + 26,
      { width: boxW - 20, lineGap: 2.5 }
    );

    // Field Mode Box
    doc.roundedRect(leftMargin + boxW + 10, y, boxW, 82, 4).fillAndStroke('#EFF6FF', '#BFDBFE');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E40AF').text('📍 FIELD MODE (Designated Executives)', leftMargin + boxW + 20, y + 10);
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(
      '• Allowed from client sites, project premises & external field locations.\n• Mandatory real-time GPS coordinates and address reverse-geocoded.\n• Mandatory live front-camera selfie capture on Check-In & Check-Out.\n• Photo is watermarked with timestamp and GPS coordinates.',
      leftMargin + boxW + 20,
      y + 26,
      { width: boxW - 20, lineGap: 2.5 }
    );

    // ------------------------------------------------------------------------
    // PAGE 2: Punctuality Rules, Reminders, Leaves & Administrative Actions
    // ------------------------------------------------------------------------
    doc.addPage();
    drawPageHeader(2);

    y = 74;

    // SECTION 4: Late Mark & Absence Escalation Policy
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('4. LATE MARK & ABSENCE ESCALATION POLICY', leftMargin + 10, y + 1);
    y += 20;

    const latePolicies = [
      {
        title: 'Grace Period Rule (09:30 AM – 10:00 AM)',
        desc: 'Employees are permitted a 30-minute grace window past official shift start to accommodate transit variations. Any check-in up to 10:00:00 AM is logged as PRESENT without penalty.'
      },
      {
        title: 'Late Mark Rule (10:01 AM – 10:59 AM)',
        desc: 'Arrival between 10:01 AM and 10:59 AM is tagged as LATE. The exact late minutes are archived in monthly compliance registers. Accumulation of repeated late marks will impact performance appraisal and monthly punctuality allowance.'
      },
      {
        title: 'Automatic Absent Marking at 11:00 AM',
        desc: 'At 11:00 AM IST, the automated system cron executes across all active rosters. If an employee has neither checked in nor submitted an approved leave request, their record is irrevocably stamped ABSENT for the calendar day.'
      },
      {
        title: 'Absence Revocation & Manual Regularization',
        desc: 'If an employee was marked ABSENT at 11:00 AM due to official outdoor duty, transport disruption, or app network issue, their reporting manager or an authorized Admin must approve an attendance regularization request.'
      }
    ];

    latePolicies.forEach((item) => {
      doc.roundedRect(leftMargin, y, contentW, 40, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E3A8A').text(`•  ${item.title}`, leftMargin + 10, y + 7);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(item.desc, leftMargin + 18, y + 20, { width: contentW - 28, lineGap: 1.5 });
      y += 46;
    });

    y += 8;

    // SECTION 5: Push Notifications & Daily Reminder Timeline
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('5. AUTOMATED NOTIFICATIONS & ALERT TIMELINE', leftMargin + 10, y + 1);
    y += 20;

    doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
      'To assist employees in maintaining punctuality and avoiding missed checkout penalties, the Falcon System dispatches real-time reminders throughout the shift cycle:',
      leftMargin,
      y,
      { width: contentW, align: 'justify', lineGap: 2 }
    );
    y += 20;

    const notifTimeline = [
      ['09:55 AM', '⏰ Pre-Late Check-In Reminder', 'Dispatched to unchecked employees 5 minutes before the 10:00 AM late mark deadline.'],
      ['11:00 AM', '🚨 Absent Notification & Consolidated Report', 'Direct critical alert to absent employees; consolidated serial-wise absent list sent to Admins.'],
      ['06:25 PM', '⏰ Shift Ending Soon (Pre-Logout Alert)', 'Dispatched to working staff: "Your shift ends at 6:30 PM. Please remember to check out."'],
      ['07:00 PM', '⚠️ Missing Check-Out Notice (19:00 IST)', 'Sent to employees who forgot checkout; consolidated serial-wise report dispatched to Management.'],
      ['Sundays & Holidays', '🛡️ Automatic Alert Suppression', 'On designated public holidays and Sundays, all automated shift reminders are fully suppressed.'],
    ];

    notifTimeline.forEach((nt, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(leftMargin, y, contentW, 20).fill(bg);
      doc.strokeColor('#E2E8F0').lineWidth(0.5).rect(leftMargin, y, contentW, 20).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#2563EB').text(nt[0], leftMargin + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(nt[1], leftMargin + 110, y + 5);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(nt[2], leftMargin + 260, y + 5, { width: contentW - 270 });
      y += 20;
    });

    y += 14;

    // SECTION 6: Leave Policy & Revocation Workflow
    doc.rect(leftMargin, y, 4, 14).fill('#2563EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('6. LEAVE RULES & LEAVE REVOCATION WORKFLOW', leftMargin + 10, y + 1);
    y += 20;

    doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
      '•  Paid Leave (PL): Accrues quarterly at 4.5 days per quarter (18 days/year). Prior approval required via Falcon Portal.\n' +
      '•  Leave Without Pay (LWP): Deducted from monthly gross salary on a pro-rata basis when paid balances are exhausted.\n' +
      '•  Employee Reports to Work on Approved Leave (Leave Override): If an employee previously had an APPROVED leave but reports to office to work, an Administrator must click "Revoke Leave" on the Leave Management console. Revoking automatically restores the leave credit and clears any attendance blocks, allowing check-in.\n' +
      '•  Serial Order: All administrative reports, payroll summaries, and Excel rosters strictly follow Employee ID serial order.',
      leftMargin,
      y,
      { width: contentW, align: 'justify', lineGap: 3.5 }
    );
    y += 54;

    // Signatures & Corporate Seal Block
    doc.strokeColor('#CBD5E1').lineWidth(0.8).moveTo(leftMargin, y).lineTo(pageWidth - leftMargin, y).stroke();
    y += 14;

    const sigW = (contentW - 20) / 2;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text('AUTHORIZED BY MANAGEMENT', leftMargin, y);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text('EMPLOYEE COMPLIANCE OBLIGATION', leftMargin + sigW + 20, y);
    y += 14;

    doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
      'Falcon Info Solutions HR & Operations Directorate\nApproved by Executive Management\nFalcon Attendance App System Ver: 2.0.4',
      leftMargin,
      y,
      { width: sigW, lineGap: 2 }
    );

    doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
      'Compliance with attendance rules is mandatory for all employees.\nUnexcused non-compliance is subject to review under company HR terms.\nQuestions: Contact hr@falconinfo.com or Administrator.',
      leftMargin + sigW + 20,
      y,
      { width: sigW, lineGap: 2 }
    );

    // Apply Page Numbers to All Pages
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawPageFooter(i + 1, totalPages);
    }

    doc.end();
  });
}
