"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVerificationPage = exports.verifyIdCard = exports.downloadBulkIdCardsZip = exports.downloadBulkIdCardsPdf = exports.getBulkIdCardsData = exports.downloadEmployeeIdCardPdf = exports.getEmployeeIdCard = exports.downloadMyIdCardPdf = exports.getMyIdCard = void 0;
const idCardService_1 = require("../services/idCardService");
const db_1 = require("../db");
const logoHelper_1 = require("../utils/logoHelper");
/**
 * Get current logged in employee's ID card data
 */
const getMyIdCard = async (req, res) => {
    try {
        const userId = req.user.id;
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        res.json({ success: true, data: cardData });
    }
    catch (error) {
        console.error('getMyIdCard error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to generate ID card' }
        });
    }
};
exports.getMyIdCard = getMyIdCard;
/**
 * Download current logged in employee's ID card as PDF
 */
const downloadMyIdCardPdf = async (req, res) => {
    try {
        const userId = req.user.id;
        const pdfBuffer = await idCardService_1.IdCardService.generateCardPdf(userId);
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        const filename = `Falcon_ID_Card_${cardData.employee.employeeId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    }
    catch (error) {
        console.error('downloadMyIdCardPdf error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to download ID card PDF' }
        });
    }
};
exports.downloadMyIdCardPdf = downloadMyIdCardPdf;
/**
 * Admin: Get specific employee's ID card data
 */
const getEmployeeIdCard = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId || isNaN(userId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
            return;
        }
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        res.json({ success: true, data: cardData });
    }
    catch (error) {
        console.error('getEmployeeIdCard error:', error);
        res.status(404).json({
            success: false,
            error: { message: error.message || 'Employee ID card not found' }
        });
    }
};
exports.getEmployeeIdCard = getEmployeeIdCard;
/**
 * Admin: Download specific employee's ID card as PDF
 */
const downloadEmployeeIdCardPdf = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId || isNaN(userId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
            return;
        }
        const pdfBuffer = await idCardService_1.IdCardService.generateCardPdf(userId);
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        const filename = `Falcon_ID_Card_${cardData.employee.employeeId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    }
    catch (error) {
        console.error('downloadEmployeeIdCardPdf error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to download ID card PDF' }
        });
    }
};
exports.downloadEmployeeIdCardPdf = downloadEmployeeIdCardPdf;
/**
 * Admin: Get bulk card data for all employees with optional filters
 */
const getBulkIdCardsData = async (req, res) => {
    try {
        const department = req.query.department;
        const attendanceMode = req.query.attendanceMode;
        const search = req.query.search;
        let sql = `
      SELECT u.id, u.name, u.employee_id as "employeeId", u.department, u.designation,
             COALESCE(u.attendance_mode, 'Office') as "attendanceMode",
             u.profile_photo_url as "profilePhotoUrl"
      FROM users u
      WHERE u.status = 'active'
    `;
        const params = [];
        if (department && department !== 'All') {
            params.push(department);
            sql += ` AND u.department = $${params.length}`;
        }
        if (attendanceMode && attendanceMode !== 'All') {
            params.push(attendanceMode);
            sql += ` AND COALESCE(u.attendance_mode, 'Office') = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (u.name ILIKE $${params.length} OR u.employee_id ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }
        sql += ` ORDER BY 
      CASE 
        WHEN u.employee_id ILIKE 'ADMIN%' THEN 0 
        WHEN u.employee_id ILIKE 'FISPL%' THEN 1 
        ELSE 2 
      END, 
      NULLIF(substring(u.employee_id from '[0-9]+'), '')::bigint ASC NULLS LAST, 
      u.employee_id ASC`;
        const result = await (0, db_1.query)(sql, params);
        res.json({ success: true, count: result.rows.length, data: result.rows });
    }
    catch (error) {
        console.error('getBulkIdCardsData error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to load employees for ID cards' }
        });
    }
};
exports.getBulkIdCardsData = getBulkIdCardsData;
/**
 * Admin: Bulk download multi-page PDF
 */
const downloadBulkIdCardsPdf = async (req, res) => {
    try {
        const { userIds } = req.body || {};
        console.log(`[IdCardController] Starting bulk PDF generation for ${userIds?.length || 'all'} users...`);
        const pdfBuffer = await idCardService_1.IdCardService.generateBulkCardsPdf(userIds);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Falcon_Bulk_ID_Cards_${timestamp}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        console.log(`[IdCardController] Bulk PDF generated successfully (${pdfBuffer.length} bytes).`);
    }
    catch (error) {
        console.error('downloadBulkIdCardsPdf error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to generate bulk ID cards PDF' }
        });
    }
};
exports.downloadBulkIdCardsPdf = downloadBulkIdCardsPdf;
/**
 * Admin: Bulk download ZIP archive of individual PDFs
 */
const downloadBulkIdCardsZip = async (req, res) => {
    try {
        const { userIds } = req.body || {};
        console.log(`[IdCardController] Starting bulk ZIP generation for ${userIds?.length || 'all'} users...`);
        const zipBuffer = await idCardService_1.IdCardService.generateBulkCardsZip(userIds);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Falcon_Bulk_ID_Cards_${timestamp}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.end(zipBuffer);
        console.log(`[IdCardController] Bulk ZIP generated successfully (${zipBuffer.length} bytes).`);
    }
    catch (error) {
        console.error('downloadBulkIdCardsZip error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to generate bulk ID cards ZIP' }
        });
    }
};
exports.downloadBulkIdCardsZip = downloadBulkIdCardsZip;
/**
 * Public Verification endpoint: Verify ID card credentials
 */
const verifyIdCard = async (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return (0, exports.renderVerificationPage)(req, res);
    }
    try {
        const rawId = req.params.verificationId;
        const verificationId = Array.isArray(rawId) ? rawId[0] : rawId;
        if (!verificationId || typeof verificationId !== 'string') {
            res.status(400).json({ success: false, error: { message: 'Verification ID required' } });
            return;
        }
        // Format: FALCON-VERIFY-{userId}-{hash}
        const parts = verificationId.split('-');
        if (parts.length < 3) {
            res.status(400).json({ success: false, verified: false, message: 'Invalid verification ID format' });
            return;
        }
        const userId = parseInt(parts[2], 10);
        if (!userId || isNaN(userId)) {
            res.status(400).json({ success: false, verified: false, message: 'Invalid employee reference in verification ID' });
            return;
        }
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        if (cardData.verificationId !== verificationId) {
            res.status(400).json({
                success: false,
                verified: false,
                message: 'Security verification signature mismatch. This ID card might be counterfeit.'
            });
            return;
        }
        res.json({
            success: true,
            verified: true,
            message: 'Official Falcon Info Solutions ID Card Verified Successfully',
            data: {
                employeeName: cardData.employee.name,
                employeeId: cardData.employee.employeeId,
                department: cardData.employee.department,
                designation: cardData.employee.designation,
                attendanceMode: cardData.employee.attendanceMode,
                joiningDate: cardData.employee.joiningDate,
                profilePhotoUrl: cardData.employee.profilePhotoUrl,
                companyName: cardData.company.name,
                verificationTimestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('verifyIdCard error:', error);
        res.status(404).json({
            success: false,
            verified: false,
            message: error.message || 'Employee credentials not found'
        });
    }
};
exports.verifyIdCard = verifyIdCard;
/**
 * Public Verification web page: Renders verified employee credential page
 */
const renderVerificationPage = async (req, res) => {
    const rawId = req.params.verificationId;
    const verificationId = Array.isArray(rawId) ? rawId[0] : rawId;
    try {
        if (!verificationId || typeof verificationId !== 'string') {
            throw new Error('Verification ID is required');
        }
        const parts = verificationId.split('-');
        if (parts.length < 3) {
            throw new Error('Invalid verification credential format');
        }
        const userId = parseInt(parts[2], 10);
        if (!userId || isNaN(userId)) {
            throw new Error('Invalid employee reference in verification ID');
        }
        const cardData = await idCardService_1.IdCardService.getEmployeeCardData(userId);
        if (cardData.verificationId !== verificationId) {
            throw new Error('Security verification signature mismatch. This ID card might be counterfeit or altered.');
        }
        const emp = cardData.employee;
        const comp = cardData.company;
        // Fix photo resolution: Support direct base64 data URLs as well as absolute URLs
        const photoUrl = emp.profilePhotoUrl
            ? emp.profilePhotoUrl.startsWith('data:') || emp.profilePhotoUrl.startsWith('http')
                ? emp.profilePhotoUrl
                : `${req.protocol}://${req.get('host')}${emp.profilePhotoUrl.startsWith('/') ? '' : '/'}${emp.profilePhotoUrl}`
            : '';
        const logoBuf = (0, logoHelper_1.getCompanyLogoBuffer)();
        const logoSrc = logoBuf
            ? `data:image/png;base64,${logoBuf.toString('base64')}`
            : '/logo.png';
        const initials = emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emp.name} - Official Employee ID Card | Falcon Info Solutions</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%);
      color: #0F172A;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container { width: 100%; max-width: 400px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }

    /* Top Brand & Verified Header */
    .brand-header { text-align: center; margin-bottom: 14px; }
    .brand-title { color: #FFFFFF; font-size: 15px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; }
    .brand-subtitle { color: #94A3B8; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }

    .verified-banner {
      width: 100%;
      max-width: 330px;
      background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);
      color: #FFFFFF;
      padding: 10px 14px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
    }
    .verified-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .verified-sub { font-size: 10.5px; color: rgba(255, 255, 255, 0.9); margin-top: 2px; }

    /* 3D Perspective Flip Container (Exact CR80 Proportions 1 : 1.588) */
    .perspective-container {
      perspective: 1200px;
      width: 320px;
      height: 508px;
      position: relative;
    }
    .id-card-flipper {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1);
    }
    .id-card-flipper.flipped {
      transform: rotateY(180deg);
    }

    .id-card-face {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: 20px;
      overflow: hidden;
      background: #FFFFFF;
      box-shadow: 0 20px 45px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
    }
    .id-card-back {
      transform: rotateY(180deg);
    }

    /* Card Navy Top Bar */
    .card-top-navy {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 70%, #0F172A 100%);
      padding: 14px 12px 10px 12px;
      text-align: center;
      border-bottom: 3px solid #2563EB;
      position: relative;
    }
    .card-top-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .card-logo {
      width: 26px;
      height: 26px;
      object-fit: contain;
    }
    .card-comp-name {
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      line-height: 1.1;
      text-align: left;
    }
    .card-comp-tag {
      color: #94A3B8;
      font-size: 7.5px;
      letter-spacing: 0.8px;
      font-weight: 600;
      text-align: left;
    }

    /* Photo & Name Section */
    .photo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 14px 16px 6px 16px;
    }
    .photo-border {
      width: 88px;
      height: 88px;
      border-radius: 16px;
      padding: 3px;
      background: linear-gradient(135deg, #2563EB 0%, #60A5FA 100%);
      box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.35);
      margin-bottom: 8px;
    }
    .photo-inner {
      width: 100%;
      height: 100%;
      border-radius: 13px;
      overflow: hidden;
      background: #F1F5F9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-initials {
      font-size: 26px;
      font-weight: 800;
      color: #2563EB;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    .emp-name-text {
      color: #0F172A;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.3px;
      text-align: center;
      line-height: 1.2;
    }
    .emp-desig-text {
      color: #2563EB;
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .mode-pill {
      display: inline-block;
      padding: 2.5px 8px;
      border-radius: 10px;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-top: 5px;
    }
    .mode-office { background: #DCFCE7; color: #166534; }
    .mode-field { background: #FEF3C7; color: #92400E; }

    /* Front Specifications Box */
    .specs-box {
      flex: 1;
      padding: 4px 16px 8px 16px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .specs-card {
      background: #F8FAFC;
      border-radius: 12px;
      padding: 10px 12px;
      border: 1px solid #E2E8F0;
    }
    .spec-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3.5px 0;
      font-size: 11px;
    }
    .spec-label { color: #64748B; font-weight: 600; }
    .spec-val { color: #0F172A; font-weight: 700; text-align: right; }

    /* Card Navy Footer Bar */
    .card-footer-navy {
      background: #0F172A;
      border-top: 2px solid #2563EB;
      padding: 7px 10px;
      text-align: center;
    }
    .card-footer-text {
      color: #FFFFFF;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    /* Back Side Styles */
    .back-header-navy {
      background: #0F172A;
      padding: 10px;
      text-align: center;
      border-bottom: 2px solid #2563EB;
    }
    .back-header-title {
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .back-body {
      flex: 1;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
    }
    .qr-box {
      background: #FFFFFF;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid #CBD5E1;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .qr-box img {
      width: 115px;
      height: 115px;
      display: block;
    }
    .qr-caption {
      font-size: 8px;
      color: #64748B;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .back-contacts {
      width: 100%;
      background: #F8FAFC;
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid #E2E8F0;
      font-size: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .back-contact-row {
      display: flex;
      justify-content: space-between;
      color: #334155;
    }
    .back-contact-label { color: #64748B; font-weight: 600; }
    .back-contact-val { font-weight: 700; color: #0F172A; }
    .return-notice {
      background: #EFF6FF;
      border: 1px dashed #93C5FD;
      border-radius: 8px;
      padding: 6px 10px;
      text-align: center;
      font-size: 9px;
      color: #1E40AF;
      font-weight: 600;
      line-height: 1.3;
      width: 100%;
    }

    /* Flip Controls */
    .controls {
      margin-top: 16px;
      display: flex;
      gap: 10px;
    }
    .flip-btn {
      background: #2563EB;
      color: #FFFFFF;
      border: none;
      border-radius: 24px;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      transition: background 0.2s, transform 0.1s;
    }
    .flip-btn:hover { background: #1D4ED8; }
    .flip-btn:active { transform: scale(0.98); }

    .footer { text-align: center; color: #64748B; font-size: 11px; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-header">
      <div class="brand-title">Falcon Info Solutions</div>
      <div class="brand-subtitle">Official Employment Verification Portal</div>
    </div>

    <!-- Officially Verified Banner -->
    <div class="verified-banner">
      <div class="verified-pill">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        OFFICIALLY VERIFIED
      </div>
      <div class="verified-sub">Authentic Employee of Falcon Info Solutions Pvt. Ltd.</div>
    </div>

    <!-- Official CR80 Identity Card Container -->
    <div class="perspective-container">
      <div class="id-card-flipper" id="cardFlipper">
        
        <!-- ======================================================== -->
        <!-- FRONT SIDE OF ID CARD                                    -->
        <!-- ======================================================== -->
        <div class="id-card-face id-card-front">
          <!-- Top Navy Header -->
          <div class="card-top-navy">
            <div class="card-top-brand">
              <img src="${logoSrc}" alt="Falcon Logo" class="card-logo" onerror="this.style.display='none';" />
              <div>
                <div class="card-comp-name">Falcon Info Solutions</div>
                <div class="card-comp-tag">ENTERPRISE IDENTIFICATION</div>
              </div>
            </div>
          </div>

          <!-- Photo & Profile Section -->
          <div class="photo-section">
            <div class="photo-border">
              <div class="photo-inner">
                ${photoUrl ? `
                  <img src="${photoUrl}" alt="${emp.name}" class="photo-img" onerror="this.style.display='none'; document.getElementById('initialsBox').style.display='flex';" />
                  <div id="initialsBox" class="photo-initials" style="display:none;">${initials}</div>
                ` : `
                  <div class="photo-initials">${initials}</div>
                `}
              </div>
            </div>

            <div class="emp-name-text">${emp.name}</div>
            <div class="emp-desig-text">${emp.designation || 'Staff'}</div>
            <span class="mode-pill ${emp.attendanceMode === 'Field' ? 'mode-field' : 'mode-office'}">
              ${emp.attendanceMode === 'Field' ? 'FIELD EMPLOYEE' : 'OFFICE EMPLOYEE'}
            </span>
          </div>

          <!-- Specifications Box -->
          <div class="specs-box">
            <div class="specs-card">
              <div class="spec-row">
                <span class="spec-label">Employee ID</span>
                <span class="spec-val">${emp.employeeId || 'N/A'}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Department</span>
                <span class="spec-val">${emp.department || 'General'}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Joining Date</span>
                <span class="spec-val">${emp.joiningDate || 'N/A'}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Blood Group</span>
                <span class="spec-val" style="color: #DC2626;">${emp.bloodGroup || 'N/A'}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Status</span>
                <span class="spec-val" style="color: #16A34A;">● Active Employment</span>
              </div>
            </div>
          </div>

          <!-- Footer Navy Bar -->
          <div class="card-footer-navy">
            <div class="card-footer-text">Falcon Info Solutions Pvt. Ltd.</div>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- BACK SIDE OF ID CARD                                     -->
        <!-- ======================================================== -->
        <div class="id-card-face id-card-back">
          <div class="back-header-navy">
            <div class="back-header-title">Employee Verification</div>
          </div>

          <div class="back-body">
            <!-- QR Code -->
            <div class="qr-box">
              <img src="${cardData.qrCodeDataUrl}" alt="Verification QR Code" />
              <div class="qr-caption">Scan to Verify Employee</div>
            </div>

            <!-- Contacts Table -->
            <div class="back-contacts">
              <div class="back-contact-row">
                <span class="back-contact-label">Website:</span>
                <span class="back-contact-val">${comp.website}</span>
              </div>
              <div class="back-contact-row">
                <span class="back-contact-label">Email:</span>
                <span class="back-contact-val">${comp.email}</span>
              </div>
              <div class="back-contact-row">
                <span class="back-contact-label">Emergency:</span>
                <span class="back-contact-val" style="color: #DC2626;">${emp.emergencyContactPhone || comp.phone}</span>
              </div>
              <div class="back-contact-row" style="margin-top:2px;">
                <span class="back-contact-label">Office:</span>
                <span class="back-contact-val" style="font-size:8.5px; text-align:right; max-width:180px; line-height:1.2;">${comp.officeAddress}</span>
              </div>
            </div>

            <!-- Return Notice -->
            <div class="return-notice">
              ${comp.emergencyMessage}
            </div>
          </div>

          <div class="card-footer-navy">
            <div class="card-footer-text">Property of Falcon Info Solutions Pvt. Ltd.</div>
          </div>
        </div>

      </div>
    </div>

    <!-- Flip Controls -->
    <div class="controls">
      <button class="flip-btn" id="flipBtn" onclick="toggleCardFlip()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
        <span id="flipBtnLabel">Flip to Back Side</span>
      </button>
    </div>

    <div class="footer">
      Falcon Info Solutions Pvt. Ltd. &copy; ${new Date().getFullYear()} • All Rights Reserved
    </div>
  </div>

  <script>
    let isFlipped = false;
    function toggleCardFlip() {
      isFlipped = !isFlipped;
      const flipper = document.getElementById('cardFlipper');
      const label = document.getElementById('flipBtnLabel');
      if (isFlipped) {
        flipper.classList.add('flipped');
        label.textContent = 'Flip to Front Side';
      } else {
        flipper.classList.remove('flipped');
        label.textContent = 'Flip to Back Side';
      }
    }
  </script>
</body>
</html>`);
    }
    catch (err) {
        res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Failed - Falcon Info Solutions</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0F172A;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #FFFFFF;
      color: #0F172A;
      max-width: 420px;
      width: 100%;
      border-radius: 16px;
      padding: 30px 24px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .icon {
      width: 60px; height: 60px; border-radius: 50%;
      background: #FEE2E2; color: #DC2626;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px auto; font-size: 30px; font-weight: bold;
    }
    h2 { font-size: 20px; font-weight: 800; color: #DC2626; margin-bottom: 8px; }
    p { font-size: 13.5px; color: #64748B; margin-bottom: 20px; line-height: 1.5; }
    .help { font-size: 12px; color: #475569; background: #F8FAFC; border-radius: 8px; padding: 12px; border: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h2>Verification Failed</h2>
    <p>${err.message || 'Unable to verify ID card credentials. The credential signature may be invalid or expired.'}</p>
    <div class="help">
      If you suspect this card is counterfeit, please contact <strong>info@falconinfo.net</strong>.
    </div>
  </div>
</body>
</html>`);
    }
};
exports.renderVerificationPage = renderVerificationPage;
