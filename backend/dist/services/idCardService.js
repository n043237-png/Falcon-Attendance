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
        // Format QR code payload
        const qrPayloadObj = {
            issuer: 'Falcon Info Solutions Pvt. Ltd.',
            employeeId: empId,
            name: profile.name,
            department: profile.department || 'General',
            designation: profile.designation || 'Staff',
            attendanceMode: profile.attendanceMode || 'Office',
            verificationId: verificationId,
            verifyUrl: `${process.env.FRONTEND_URL || 'https://attendance.falconinfosolutions.com'}/verify-id/${verificationId}`
        };
        const qrPayload = JSON.stringify(qrPayloadObj);
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(qrPayload, {
            width: 400,
            margin: 1,
            color: {
                dark: '#0F172A',
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
                bloodGroup: profile.bloodGroup || 'Not Specified',
                joiningDate: formattedJoiningDate,
                profilePhotoUrl: profile.profilePhotoUrl || null,
                emergencyContactPhone: profile.emergencyContactPhone || profile.phone || '+91 98765 43210',
                emergencyContactName: profile.emergencyContactName || 'HR Desk',
                verificationId: verificationId
            },
            company: {
                name: 'Falcon Info Solutions Pvt. Ltd.',
                shortName: 'Falcon Info Solutions',
                website: 'www.falconinfosolutions.com',
                email: 'hr@falconinfosolutions.com',
                phone: '+91 120 4567890',
                officeAddress: 'Falcon Info Solutions HQ, Sector 62, Noida, UP - 201309',
                emergencyMessage: 'If found, please return this card to Falcon Info Solutions Pvt. Ltd.',
                logoUrl: '/logo.png'
            },
            qrCodeDataUrl,
            qrPayload,
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
                // Standard Portrait ID Card dimensions: 230 x 360 points
                const cardW = 230;
                const cardH = 360;
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
                    // Header Navy Banner
                    doc.rect(0, 0, cardW, 85).fill('#0F172A');
                    // Accent Stripe
                    doc.rect(0, 82, cardW, 4).fill('#2563EB');
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
                    doc.fillColor('#94A3B8')
                        .fontSize(6.5)
                        .font('Helvetica')
                        .text('INNOVATION • INTEGRITY • EXCELLENCE', 0, 58, { width: cardW, align: 'center', characterSpacing: 0.5 });
                    // Employee Photo Box
                    const photoY = 66;
                    const photoSize = 64;
                    const photoX = (cardW - photoSize) / 2;
                    // Outer shadow/border box
                    doc.roundedRect(photoX - 2, photoY - 2, photoSize + 4, photoSize + 4, 8)
                        .fillAndStroke('#FFFFFF', '#2563EB');
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
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).fill('#EFF6FF');
                        const initials = card.employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'EMP';
                        doc.fillColor('#2563EB').fontSize(20).font('Helvetica-Bold')
                            .text(initials, photoX, photoY + 20, { width: photoSize, align: 'center' });
                    }
                    // Employee Name & Designation
                    const nameY = photoY + photoSize + 6;
                    doc.fillColor('#0F172A')
                        .fontSize(12)
                        .font('Helvetica-Bold')
                        .text(card.employee.name, 10, nameY, { width: cardW - 20, align: 'center' });
                    doc.fillColor('#2563EB')
                        .fontSize(8.5)
                        .font('Helvetica-Bold')
                        .text(card.employee.designation, 10, nameY + 15, { width: cardW - 20, align: 'center' });
                    // Details Table Area
                    const tableY = nameY + 34;
                    const leftX = 16;
                    const valueX = 82;
                    const rowH = 13.5;
                    const rows = [
                        { label: 'EMP ID', val: card.employee.employeeId, bold: true },
                        { label: 'Designation', val: card.employee.designation || 'Staff', bold: false },
                        { label: 'Department', val: card.employee.department || 'General', bold: false },
                        { label: 'Mobile No.', val: card.employee.phone || 'N/A', bold: false },
                        { label: 'Company Email', val: card.employee.email || 'N/A', bold: false },
                        { label: 'Joining Date', val: card.employee.joiningDate || 'N/A', bold: false },
                    ];
                    rows.forEach((r, idx) => {
                        const currentY = tableY + (idx * rowH);
                        doc.fillColor('#64748B')
                            .fontSize(6.8)
                            .font('Helvetica-Bold')
                            .text(r.label.toUpperCase(), leftX, currentY);
                        doc.fillColor('#0F172A')
                            .fontSize(7.2)
                            .font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
                            .text(r.val, valueX, currentY, { width: cardW - valueX - 14, ellipsis: true });
                    });
                    // Footer Navy Banner
                    const footerH = 26;
                    doc.rect(0, cardH - footerH, cardW, footerH).fill('#0F172A');
                    doc.rect(0, cardH - footerH, cardW, 2).fill('#2563EB');
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
                    doc.rect(0, 0, cardW, 36).fill('#0F172A');
                    doc.rect(0, 34, cardW, 2).fill('#2563EB');
                    doc.fillColor('#FFFFFF')
                        .fontSize(8.5)
                        .font('Helvetica-Bold')
                        .text('EMPLOYEE VERIFICATION', 0, 12, { width: cardW, align: 'center' });
                    // QR Code rendering
                    const qrBuf = await qrcode_1.default.toBuffer(card.qrPayload, {
                        width: 110,
                        margin: 1,
                        errorCorrectionLevel: 'M'
                    });
                    const qrY = 44;
                    const qrX = (cardW - 100) / 2;
                    doc.image(qrBuf, qrX, qrY, { width: 100, height: 100 });
                    // Verification ID & Scan Instruction
                    doc.fillColor('#64748B')
                        .fontSize(6)
                        .font('Helvetica')
                        .text('SCAN TO VERIFY CREDENTIALS', 0, qrY + 102, { width: cardW, align: 'center' });
                    doc.fillColor('#0F172A')
                        .fontSize(7)
                        .font('Helvetica-Bold')
                        .text(card.verificationId, 0, qrY + 111, { width: cardW, align: 'center' });
                    // Divider Line
                    doc.moveTo(18, qrY + 124).lineTo(cardW - 18, qrY + 124).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
                    // Official Company Details
                    const contactY = qrY + 130;
                    const cRowH = 13;
                    const contactRows = [
                        { label: 'Website', val: card.company.website },
                        { label: 'Official Email', val: card.company.email },
                        { label: 'Emergency Contact', val: card.employee.emergencyContactPhone },
                        { label: 'Office Address', val: 'HQ, Sector 62, Noida, UP - 201309' }
                    ];
                    contactRows.forEach((cr, cIdx) => {
                        const cy = contactY + (cIdx * cRowH);
                        doc.fillColor('#64748B')
                            .fontSize(6.5)
                            .font('Helvetica-Bold')
                            .text(cr.label.toUpperCase() + ':', 18, cy);
                        doc.fillColor('#0F172A')
                            .fontSize(6.5)
                            .font('Helvetica')
                            .text(cr.val, 85, cy, { width: cardW - 100, ellipsis: true });
                    });
                    // Emergency Notice Box
                    const noticeY = cardH - 74;
                    doc.roundedRect(14, noticeY, cardW - 28, 36, 4).fillAndStroke('#EFF6FF', '#BFDBFE');
                    doc.fillColor('#1E40AF')
                        .fontSize(6.5)
                        .font('Helvetica-Bold')
                        .text('NOTICE', 18, noticeY + 5, { width: cardW - 36, align: 'center' });
                    doc.fillColor('#1E293B')
                        .fontSize(6)
                        .font('Helvetica')
                        .text(card.company.emergencyMessage, 18, noticeY + 16, { width: cardW - 36, align: 'center' });
                    // Back Footer
                    doc.rect(0, cardH - 24, cardW, 24).fill('#0F172A');
                    doc.fillColor('#94A3B8')
                        .fontSize(6)
                        .font('Helvetica')
                        .text('This card is the property of Falcon Info Solutions Pvt. Ltd.', 0, cardH - 16, { width: cardW, align: 'center' });
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
