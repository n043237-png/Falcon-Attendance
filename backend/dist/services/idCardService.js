"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdCardService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const qrcode_1 = __importDefault(require("qrcode"));
const jszip_1 = __importDefault(require("jszip"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const employeeProfileService_1 = require("./employeeProfileService");
const logoHelper_1 = require("../utils/logoHelper");
const sharp_1 = __importDefault(require("sharp"));
class IdCardService {
    /**
     * Deterministically generates a secure verification code for an employee
     */
    static generateVerificationId(userId, email) {
        const hash = crypto_1.default
            .createHash('sha256')
            .update(`falcon-verify-salt-${userId}-${email}`)
            .digest('hex')
            .substring(0, 8)
            .toUpperCase();
        return `FALCON-VERIFY-${userId}-${hash}`;
    }
    /**
     * Formats ISO or DB date to "DD MMM YYYY" (e.g., "15 Jan 2024")
     */
    static formatDate(dateVal) {
        if (!dateVal)
            return 'N/A';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime()))
                return String(dateVal);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        catch {
            return String(dateVal);
        }
    }
    /**
     * Fetches full ID card data including QR code for an employee
     */
    static async getEmployeeCardData(userId) {
        const profile = await employeeProfileService_1.EmployeeProfileService.getFullProfile(userId, false);
        if (!profile) {
            throw new Error(`Employee with ID ${userId} not found`);
        }
        const verificationId = this.generateVerificationId(profile.id, profile.email);
        const empId = profile.employeeId || profile.employeeCode || `EMP${String(profile.id).padStart(4, '0')}`;
        const formattedJoiningDate = this.formatDate(profile.joiningDate);
        const baseUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || 'https://falcon-attendance-bcyo.onrender.com').replace(/\/+$/, '');
        const verifyUrl = `${baseUrl}/verify-id/${verificationId}`;
        // Encode the direct verification URL into the QR code so phone cameras and Google Lens open it directly as a link
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(verifyUrl, {
            width: 400,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        });
        return {
            employee: {
                id: profile.id,
                employeeId: empId,
                employeeCode: profile.employeeCode || empId,
                name: profile.name,
                email: profile.email,
                phone: profile.phone || '',
                department: profile.department || 'General',
                designation: profile.designation || 'Staff',
                attendanceMode: profile.attendanceMode || 'Office',
                bloodGroup: profile.bloodGroup || 'N/A',
                joiningDate: formattedJoiningDate,
                profilePhotoUrl: profile.profilePhotoUrl || null,
                emergencyContactPhone: profile.emergencyContactPhone || profile.phone || '+91 98765 43210',
                emergencyContactName: profile.emergencyContactName || 'HR Desk',
                verificationId: verificationId
            },
            company: {
                name: 'Falcon Info Solutions Pvt. Ltd.',
                shortName: 'Falcon Info Solutions',
                website: 'www.falconinfo.net',
                email: 'info@falconinfo.net',
                phone: '01204108910',
                officeAddress: 'A-166, Sector 63 Rd, A Block, Sector 63, Noida, Uttar Pradesh 201309',
                emergencyMessage: 'If found, please return this card to Falcon Info Solutions Pvt. Ltd.',
                logoUrl: '/logo.png'
            },
            qrCodeDataUrl,
            qrPayload: verifyUrl,
            verificationId
        };
    }
    /**
     * Generates a high-resolution, print-ready 2-page PDF (Page 1: Front, Page 2: Back)
     * in standard ID card format (portrait CR80: 2.125" x 3.375" / 153pt x 243pt scaled to 220pt x 340pt)
     */
    static async generateCardPdf(userId) {
        const cardData = await this.getEmployeeCardData(userId);
        return this.createPdfDocument([cardData]);
    }
    /**
     * Generates a multi-employee print-ready PDF containing all or selected employees
     */
    static async generateBulkCardsPdf(userIds) {
        let usersList = [];
        const orderClause = `
      ORDER BY 
        CASE 
          WHEN employee_id ILIKE 'ADMIN%' THEN 0 
          WHEN employee_id ILIKE 'FISPL%' THEN 1 
          ELSE 2 
        END, 
        NULLIF(substring(employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
        employee_id ASC
    `;
        if (userIds && userIds.length > 0) {
            const res = await (0, db_1.query)(`SELECT id FROM users WHERE id = ANY($1::int[]) AND status = 'active' ${orderClause}`, [userIds]);
            usersList = res.rows;
        }
        else {
            const res = await (0, db_1.query)(`SELECT id FROM users WHERE status = 'active' ${orderClause}`);
            usersList = res.rows;
        }
        const cardsData = [];
        const chunkSize = 5;
        for (let i = 0; i < usersList.length; i += chunkSize) {
            const chunk = usersList.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(chunk.map(async (u) => {
                try {
                    return await this.getEmployeeCardData(u.id);
                }
                catch (e) {
                    console.warn(`Skipping ID card for user ${u.id}:`, e);
                    return null;
                }
            }));
            for (const card of chunkResults) {
                if (card)
                    cardsData.push(card);
            }
        }
        return this.createPdfDocument(cardsData);
    }
    /**
     * Generates a ZIP archive containing individual PDFs for all selected employees
     */
    static async generateBulkCardsZip(userIds) {
        let usersList = [];
        const orderClause = `
      ORDER BY 
        CASE 
          WHEN employee_id ILIKE 'ADMIN%' THEN 0 
          WHEN employee_id ILIKE 'FISPL%' THEN 1 
          ELSE 2 
        END, 
        NULLIF(substring(employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
        employee_id ASC
    `;
        if (userIds && userIds.length > 0) {
            const res = await (0, db_1.query)(`SELECT id FROM users WHERE id = ANY($1::int[]) AND status = 'active' ${orderClause}`, [userIds]);
            usersList = res.rows;
        }
        else {
            const res = await (0, db_1.query)(`SELECT id FROM users WHERE status = 'active' ${orderClause}`);
            usersList = res.rows;
        }
        const zip = new jszip_1.default();
        const chunkSize = 5;
        for (let i = 0; i < usersList.length; i += chunkSize) {
            const chunk = usersList.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (u) => {
                try {
                    const card = await this.getEmployeeCardData(u.id);
                    const pdfBuf = await this.createPdfDocument([card]);
                    const safeName = card.employee.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                    const filename = `ID_Card_${card.employee.employeeId}_${safeName}.pdf`;
                    zip.file(filename, pdfBuf);
                }
                catch (e) {
                    console.warn(`Error generating zip entry for user ${u.id}:`, e);
                }
            }));
        }
        return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    }
    /**
     * Internal PDF builder using PDFKit
     */
    static async createPdfDocument(cards) {
        return new Promise(async (resolve, reject) => {
            try {
                // Standard Portrait ID Card dimensions (CR80 standard: 2.125" x 3.375" / 54 mm x 85.6 mm)
                const cardW = 230;
                const cardH = 365; // 230 * (3.375 / 2.125) = 365.29 points (1 : 1.588 ratio)
                const doc = new pdfkit_1.default({
                    size: [cardW, cardH],
                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                    autoFirstPage: false
                });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);
                const logoPath = (0, logoHelper_1.getCompanyLogoPath)();
                for (let i = 0; i < cards.length; i++) {
                    const card = cards[i];
                    // -----------------------------------------------------------------
                    // PAGE 1: FRONT SIDE
                    // -----------------------------------------------------------------
                    doc.addPage({ size: [cardW, cardH], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
                    // Card Background & Border
                    doc.rect(0, 0, cardW, cardH).fill('#FFFFFF');
                    // Header Falcon Globe Blue Banner
                    doc.rect(0, 0, cardW, 85).fill('#0072BC');
                    // Falcon Globe Sky Cyan Accent Stripe
                    doc.rect(0, 82, cardW, 4).fill('#38BDF8');
                    // Top Header Content: Company Logo / Name
                    if (logoPath && fs_1.default.existsSync(logoPath)) {
                        try {
                            doc.image(logoPath, (cardW - 32) / 2, 8, { width: 32, height: 32, fit: [32, 32] });
                        }
                        catch {
                            // fallback
                        }
                    }
                    doc.fillColor('#FFFFFF')
                        .fontSize(10.5)
                        .font('Helvetica-Bold')
                        .text('FALCON INFO SOLUTIONS', 0, 44, { width: cardW, align: 'center' });
                    doc.fillColor('#BAE6FD')
                        .fontSize(6.5)
                        .font('Helvetica')
                        .text('INNOVATION • INTEGRITY • EXCELLENCE', 0, 58, { width: cardW, align: 'center', characterSpacing: 0.5 });
                    // Employee Photo Box
                    const photoY = 66;
                    const photoSize = 64;
                    const photoX = (cardW - photoSize) / 2;
                    // Outer shadow/border box
                    doc.roundedRect(photoX - 2, photoY - 2, photoSize + 4, photoSize + 4, 8)
                        .fillAndStroke('#FFFFFF', '#0072BC');
                    let photoRendered = false;
                    if (card.employee.profilePhotoUrl) {
                        if (card.employee.profilePhotoUrl.startsWith('data:image/')) {
                            try {
                                const base64Data = card.employee.profilePhotoUrl.split(',')[1];
                                if (base64Data) {
                                    let imgBuffer = Buffer.from(base64Data, 'base64');
                                    if (card.employee.profilePhotoUrl.includes('webp') || card.employee.profilePhotoUrl.includes('svg')) {
                                        try {
                                            imgBuffer = await (0, sharp_1.default)(imgBuffer).png().toBuffer();
                                        }
                                        catch (convErr) {
                                            console.warn('[IdCardService] Sharp conversion error:', convErr);
                                        }
                                    }
                                    doc.save();
                                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
                                    doc.image(imgBuffer, photoX, photoY, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
                                    doc.restore();
                                    photoRendered = true;
                                }
                            }
                            catch (e) {
                                console.warn('[IdCardService] Failed to render base64 photo in PDF:', e);
                                photoRendered = false;
                            }
                        }
                        else {
                            const diskPhotoPath = path_1.default.join(process.cwd(), card.employee.profilePhotoUrl.replace(/^\//, ''));
                            if (fs_1.default.existsSync(diskPhotoPath)) {
                                try {
                                    doc.save();
                                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
                                    doc.image(diskPhotoPath, photoX, photoY, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
                                    doc.restore();
                                    photoRendered = true;
                                }
                                catch (e) {
                                    photoRendered = false;
                                }
                            }
                        }
                    }
                    if (!photoRendered) {
                        // Draw placeholder initials avatar
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).fill('#F0F9FF');
                        const initials = card.employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'EMP';
                        doc.fillColor('#0072BC').fontSize(20).font('Helvetica-Bold')
                            .text(initials, photoX, photoY + 20, { width: photoSize, align: 'center' });
                    }
                    // Employee Name & Designation
                    const nameY = photoY + photoSize + 6;
                    doc.fillColor('#024E79')
                        .fontSize(12)
                        .font('Helvetica-Bold')
                        .text(card.employee.name, 10, nameY, { width: cardW - 20, align: 'center' });
                    doc.fillColor('#0072BC')
                        .fontSize(8.5)
                        .font('Helvetica-Bold')
                        .text(card.employee.designation, 10, nameY + 15, { width: cardW - 20, align: 'center' });
                    // Attendance Mode Pill Badge
                    const modeBadgeY = nameY + 28;
                    const isField = card.employee.attendanceMode === 'Field';
                    const badgeW = 86;
                    const badgeH = 13;
                    const badgeX = (cardW - badgeW) / 2;
                    doc.roundedRect(badgeX, modeBadgeY, badgeW, badgeH, 6)
                        .fill(isField ? '#FEF3C7' : '#DCFCE7');
                    doc.fillColor(isField ? '#92400E' : '#15803D')
                        .fontSize(6.2)
                        .font('Helvetica-Bold')
                        .text(isField ? 'FIELD EMPLOYEE' : 'OFFICE EMPLOYEE', badgeX, modeBadgeY + 3.5, { width: badgeW, align: 'center' });
                    // Details Table Area
                    const tableBoxX = 14;
                    const tableY = modeBadgeY + 18;
                    const tableBoxW = cardW - 28;
                    const tableBoxH = 88;
                    doc.roundedRect(tableBoxX, tableY, tableBoxW, tableBoxH, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
                    const leftX = tableBoxX + 10;
                    const valueX = tableBoxX + 68;
                    const rowH = 13.5;
                    const rows = [
                        { label: 'Employee ID', val: card.employee.employeeId, bold: true },
                        { label: 'Designation', val: card.employee.designation || 'Staff', bold: false },
                        { label: 'Department', val: card.employee.department || 'General', bold: false },
                        { label: 'Mobile No.', val: card.employee.phone || 'N/A', bold: false },
                        { label: 'Blood Group', val: card.employee.bloodGroup || 'N/A', bold: false },
                        { label: 'Joining Date', val: card.employee.joiningDate || 'N/A', bold: false },
                    ];
                    rows.forEach((r, idx) => {
                        const currentY = tableY + 6 + (idx * rowH);
                        doc.fillColor('#64748B')
                            .fontSize(6.8)
                            .font('Helvetica-Bold')
                            .text(r.label, leftX, currentY, { width: 55 });
                        doc.fillColor('#024E79')
                            .fontSize(7)
                            .font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
                            .text(r.val, valueX, currentY, { width: tableBoxW - 74, ellipsis: true });
                    });
                    // Footer Falcon Globe Blue Banner
                    const footerH = 26;
                    doc.rect(0, cardH - footerH, cardW, footerH).fill('#0072BC');
                    doc.rect(0, cardH - footerH, cardW, 2.5).fill('#38BDF8');
                    doc.fillColor('#FFFFFF')
                        .fontSize(7.5)
                        .font('Helvetica-Bold')
                        .text('Falcon Info Solutions Pvt. Ltd.', 0, cardH - 18, { width: cardW, align: 'center' });
                    // -----------------------------------------------------------------
                    // PAGE 2: BACK SIDE
                    // -----------------------------------------------------------------
                    doc.addPage({ size: [cardW, cardH], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
                    // Back Background
                    doc.rect(0, 0, cardW, cardH).fill('#FFFFFF');
                    // Header
                    doc.rect(0, 0, cardW, 36).fill('#0072BC');
                    doc.rect(0, 34, cardW, 2.5).fill('#38BDF8');
                    doc.fillColor('#FFFFFF')
                        .fontSize(9)
                        .font('Helvetica-Bold')
                        .text('OFFICIAL VERIFICATION', 0, 9, { width: cardW, align: 'center' });
                    doc.fillColor('#BAE6FD')
                        .fontSize(6)
                        .font('Helvetica')
                        .text('SECURE QR CREDENTIAL', 0, 22, { width: cardW, align: 'center', characterSpacing: 0.5 });
                    // QR Code container box
                    const qrBoxW = 126;
                    const qrBoxH = 134;
                    const qrBoxX = (cardW - qrBoxW) / 2;
                    const qrBoxY = 44;
                    doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 8).fillAndStroke('#FFFFFF', '#E2E8F0');
                    const qrBuf = await qrcode_1.default.toBuffer(card.qrPayload, {
                        width: 90,
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    });
                    const qrSize = 90;
                    const qrX = (cardW - qrSize) / 2;
                    const qrY = qrBoxY + 8;
                    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
                    doc.fillColor('#64748B')
                        .fontSize(5.8)
                        .font('Helvetica')
                        .text('SCAN TO VERIFY EMPLOYEE', qrBoxX, qrBoxY + 104, { width: qrBoxW, align: 'center' });
                    doc.fillColor('#024E79')
                        .fontSize(6.5)
                        .font('Helvetica-Bold')
                        .text(card.verificationId, qrBoxX, qrBoxY + 114, { width: qrBoxW, align: 'center' });
                    // Official Company Details Box
                    const contactBoxX = 14;
                    const contactBoxY = qrBoxY + qrBoxH + 10;
                    const contactBoxW = cardW - 28;
                    const contactBoxH = 72;
                    doc.roundedRect(contactBoxX, contactBoxY, contactBoxW, contactBoxH, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
                    // Row 1: Website
                    doc.fillColor('#0072BC').fontSize(6.8).font('Helvetica-Bold')
                        .text(card.company.website, contactBoxX + 12, contactBoxY + 8, { width: contactBoxW - 24 });
                    // Row 2: Official Email
                    doc.fillColor('#024E79').fontSize(6.5).font('Helvetica')
                        .text(card.company.email, contactBoxX + 12, contactBoxY + 21, { width: contactBoxW - 24 });
                    // Row 3: Emergency Contact Phone (No overlapping, clearly styled)
                    const emergencyPhone = card.employee.emergencyContactPhone || card.company.phone || '9654503616';
                    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica')
                        .text('Emergency: ', contactBoxX + 12, contactBoxY + 34, { continued: true })
                        .fillColor('#DC2626').font('Helvetica-Bold')
                        .text(emergencyPhone);
                    // Row 4: Office Address
                    doc.fillColor('#64748B').fontSize(5.8).font('Helvetica')
                        .text(card.company.officeAddress, contactBoxX + 12, contactBoxY + 47, { width: contactBoxW - 24, lineGap: 1.5 });
                    // Emergency Notice Box
                    const noticeY = contactBoxY + contactBoxH + 8;
                    const noticeH = 26;
                    doc.roundedRect(14, noticeY, cardW - 28, noticeH, 6).fillAndStroke('#F0F9FF', '#7DD3FC');
                    doc.fillColor('#0369A1')
                        .fontSize(6.2)
                        .font('Helvetica-Bold')
                        .text('"If found, please return this card to Falcon Info Solutions Pvt. Ltd."', 18, noticeY + 9, { width: cardW - 36, align: 'center' });
                    // Back Footer
                    doc.rect(0, cardH - 24, cardW, 24).fill('#0072BC');
                    doc.rect(0, cardH - 24, cardW, 2).fill('#38BDF8');
                    doc.fillColor('#BAE6FD')
                        .fontSize(6.2)
                        .font('Helvetica-Bold')
                        .text('Property of Falcon Info Solutions Pvt. Ltd.', 0, cardH - 16, { width: cardW, align: 'center' });
                }
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
exports.IdCardService = IdCardService;
