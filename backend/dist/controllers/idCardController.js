"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVerificationPage = exports.verifyIdCard = exports.downloadBulkIdCardsZip = exports.downloadBulkIdCardsPdf = exports.getBulkIdCardsData = exports.downloadEmployeeIdCardPdf = exports.getEmployeeIdCard = exports.downloadMyIdCardPdf = exports.getMyIdCard = void 0;
const idCardService_1 = require("../services/idCardService");
const db_1 = require("../db");
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
        const photoUrl = emp.profilePhotoUrl
            ? emp.profilePhotoUrl.startsWith('http')
                ? emp.profilePhotoUrl
                : `${req.protocol}://${req.get('host')}${emp.profilePhotoUrl.startsWith('/') ? '' : '/'}${emp.profilePhotoUrl}`
            : '';
        const initials = emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
        const formattedDate = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Falcon Info Solutions - Verified Employee Credential</title>
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
      padding: 20px 16px;
    }
    .container { width: 100%; max-width: 440px; margin: 0 auto; }
    .brand-header { text-align: center; margin-bottom: 20px; }
    .brand-title { color: #FFFFFF; font-size: 16px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; }
    .brand-subtitle { color: #94A3B8; font-size: 10.5px; font-weight: 600; letter-spacing: 0.5px; }
    .card {
      background: #FFFFFF;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
    }
    .verified-banner {
      background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);
      color: #FFFFFF;
      padding: 16px 20px;
      text-align: center;
    }
    .verified-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .verified-sub { font-size: 11px; color: rgba(255, 255, 255, 0.85); margin-top: 2px; }
    .card-body { padding: 24px 20px; }
    .profile-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .avatar {
      width: 68px;
      height: 68px;
      border-radius: 14px;
      background: #EFF6FF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
      color: #2563EB;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid #DBEAFE;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .emp-name { font-size: 18px; font-weight: 800; color: #0F172A; line-height: 1.2; }
    .emp-desig { font-size: 13px; font-weight: 600; color: #2563EB; margin-top: 2px; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-top: 4px;
    }
    .badge-success { background: #DCFCE7; color: #166534; }
    .badge-warning { background: #FEF3C7; color: #92400E; }
    .details-table {
      width: 100%;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 12px;
      border-bottom: 1px solid #EDF2F7;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748B; font-weight: 500; }
    .detail-value { color: #0F172A; font-weight: 700; text-align: right; }
    .company-box {
      background: #F1F5F9;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 11.5px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .company-box strong { color: #0F172A; }
    .company-box p { color: #475569; margin-top: 2px; font-size: 11px; }
    .security-badge {
      background: #EFF6FF;
      border: 1px dashed #93C5FD;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .security-id { font-family: monospace; font-size: 11px; font-weight: 700; color: #1E40AF; }
    .security-time { font-size: 10px; color: #64748B; margin-top: 2px; }
    .footer { text-align: center; color: #64748B; font-size: 11px; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-header">
      <div class="brand-title">Falcon Info Solutions</div>
      <div class="brand-subtitle">Official Employment Verification Portal</div>
    </div>
    <div class="card">
      <div class="verified-banner">
        <div class="verified-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          OFFICIALLY VERIFIED
        </div>
        <div class="verified-sub">Authentic Employee of Falcon Info Solutions Pvt. Ltd.</div>
      </div>
      <div class="card-body">
        <div class="profile-row">
          <div class="avatar">
            ${photoUrl ? `<img src="${photoUrl}" alt="${emp.name}">` : initials}
          </div>
          <div>
            <div class="emp-name">${emp.name}</div>
            <div class="emp-desig">${emp.designation || 'Staff'}</div>
            <span class="badge ${emp.attendanceMode === 'Field' ? 'badge-warning' : 'badge-success'}">
              ${emp.attendanceMode === 'Field' ? 'Field Employee' : 'Office Employee'}
            </span>
          </div>
        </div>

        <div class="details-table">
          <div class="detail-row">
            <span class="detail-label">Employee ID</span>
            <span class="detail-value">${emp.employeeId || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Department</span>
            <span class="detail-value">${emp.department || 'General'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Joining Date</span>
            <span class="detail-value">${emp.joiningDate || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Blood Group</span>
            <span class="detail-value" style="color: #DC2626;">${emp.bloodGroup || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value" style="color: #16A34A;">● Active Employment</span>
          </div>
        </div>

        <div class="company-box">
          <strong>${comp.name}</strong>
          <p>${comp.officeAddress}</p>
          <p>Website: <a href="https://${comp.website}" target="_blank" style="color:#2563EB; text-decoration:none;">${comp.website}</a> | Email: ${comp.email} | Tel: ${comp.phone}</p>
        </div>

        <div class="security-badge">
          <div class="security-id">${verificationId}</div>
          <div class="security-time">Verified live on ${formattedDate}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      Falcon Info Solutions Pvt. Ltd. &copy; ${new Date().getFullYear()} • All Rights Reserved
    </div>
  </div>
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
