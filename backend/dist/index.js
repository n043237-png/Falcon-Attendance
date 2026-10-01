"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const leaveRoutes_1 = __importDefault(require("./routes/leaveRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const payrollRoutes_1 = __importDefault(require("./routes/payrollRoutes"));
const holidayRoutes_1 = __importDefault(require("./routes/holidayRoutes"));
const expenseRoutes_1 = __importDefault(require("./routes/expenseRoutes"));
const idCardController_1 = require("./controllers/idCardController");
const schedulerService_1 = require("./services/schedulerService");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const corsOptions = {
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : '*',
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Serve admin panel static files
const adminDistPath = path_1.default.join(process.cwd(), '..', 'admin', 'dist');
app.use(express_1.default.static(adminDistPath));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/attendance/location', locationRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/admin/payroll', payrollRoutes_1.default);
app.use('/api/leave', leaveRoutes_1.default);
app.use('/api/profile', profileRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/employee', employeeRoutes_1.default);
app.use('/api/holidays', holidayRoutes_1.default);
app.use('/api/expenses', expenseRoutes_1.default);
app.get('/api/verify/id-card/:verificationId', idCardController_1.verifyIdCard);
(0, schedulerService_1.startScheduler)();
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Falcon Office Backend is running' });
});
// Google Play Store Compliant Privacy Policy
app.get('/privacy-policy', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Falcon Attendance</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 800px; margin: 40px auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { color: #0f172a; font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 30px; }
    h2 { color: #1e3a8a; font-size: 20px; margin-top: 28px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    p, li { font-size: 15px; color: #334155; }
    ul { padding-left: 20px; }
    .highlight-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 6px; margin: 18px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <div class="subtitle">Effective Date: September 29, 2026 | Last Updated: September 2026</div>

    <p>Falcon Info Solutions ("we", "our", or "us") operates the <strong>Falcon Attendance</strong> mobile application and attendance management system. This Privacy Policy informs you of our policies regarding the collection, use, and disclosure of personal data when you use our service.</p>

    <h2>1. Information We Collect</h2>
    <p>To provide accurate workplace attendance, leave management, and communication services, we collect the following types of information:</p>
    <ul>
      <li><strong>Account Details:</strong> Your name, official work email address, employee ID, department, designation, and encrypted login credentials.</li>
      <li><strong>Contact Information:</strong> Phone number and emergency contact numbers (if voluntarily provided in your employee profile).</li>
      <li><strong>Attendance Logs:</strong> Clock-in timestamp, clock-out timestamp, workday duration, and shift assignment data.</li>
    </ul>

    <h2>2. Location Data & Geofencing (Prominent Disclosure)</h2>
    <div class="highlight-box">
      <strong>Important Notice Regarding Location Tracking:</strong><br>
      Falcon Attendance collects GPS location data <strong>solely at the moment you press "Punch In" or "Punch Out"</strong> to verify that you are within authorized office geofence premises.
    </div>
    <ul>
      <li><strong>No Continuous Background Tracking:</strong> Falcon Attendance does <em>not</em> track, log, or monitor your location continuously in the background when you are not actively using attendance features.</li>
      <li><strong>No Third-Party Sharing:</strong> Your GPS coordinates are never sold, rented, or shared with third-party advertisers.</li>
      <li><strong>Purpose:</strong> Strictly utilized to validate physical presence at designated office facilities during shift check-in/check-out.</li>
    </ul>

    <h2>3. Camera and Storage Access</h2>
    <p>Falcon Attendance may request access to your device's Camera and Media/Photo Gallery strictly for the following purposes:</p>
    <ul>
      <li>Allowing you to capture or upload a profile picture for employee identification.</li>
      <li>Allowing you to upload relevant medical or supporting documents when applying for leave.</li>
    </ul>
    <p>We do not access or read any other private photos or files stored on your device.</p>

    <h2>4. Push Notifications & Device Tokens</h2>
    <p>With your permission, we register your device's Google Firebase Cloud Messaging (FCM) push token to deliver essential work-related notifications, including:</p>
    <ul>
      <li>Company announcements and holiday alerts.</li>
      <li>Shift start reminders and clock-out alerts.</li>
      <li>Leave application status updates (Approval / Rejection).</li>
    </ul>
    <p>You can adjust or disable notification permissions at any time through your device's system settings.</p>

    <h2>5. Data Security</h2>
    <p>We implement robust industry-standard technical measures to secure your personal data:</p>
    <ul>
      <li>All data communication between the mobile app and our servers is encrypted using 256-bit SSL/TLS (HTTPS).</li>
      <li>All sensitive account passwords are one-way hashed using salted bcrypt cryptography.</li>
      <li>Database access is strictly restricted and role-governed.</li>
    </ul>

    <h2>6. Data Retention & Account Deletion</h2>
    <p>We retain your profile and attendance records for as long as your corporate employment account remains active. Upon separation from the organization or upon written request by the administrator, corporate records are archived or permanently removed according to organizational compliance guidelines.</p>
    <p>Employees may request account deletion or data review by contacting their HR department or writing to our privacy team.</p>

    <h2>7. Contact Us</h2>
    <p>If you have any questions or concerns regarding this Privacy Policy or data practices, please contact us at:</p>
    <p>
      <strong>Falcon Info Solutions</strong><br>
      Email: support@falconinfo.net<br>
      Website: <a href="https://falcon-attendance-bcyo.onrender.com">https://falcon-attendance-bcyo.onrender.com</a>
    </p>

    <div class="footer">
      &copy; 2026 Falcon Info Solutions. All rights reserved.
    </div>
  </div>
</body>
</html>`);
});
// SPA catch-all — serve index.html for any non-API route
app.get('/{*path}', (req, res) => {
    res.sendFile(path_1.default.join(adminDistPath, 'index.html'));
});
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port} (0.0.0.0)`);
});
