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
(0, schedulerService_1.startScheduler)();
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Falcon Office Backend is running' });
});
// SPA catch-all — serve index.html for any non-API route
app.get('/{*path}', (req, res) => {
    res.sendFile(path_1.default.join(adminDistPath, 'index.html'));
});
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port} (0.0.0.0)`);
});
