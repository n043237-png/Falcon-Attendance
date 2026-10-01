"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("../db");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, "Email or Employee ID is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const login = async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.issues?.[0]?.message || "Invalid input" });
            return;
        }
        const { identifier, password } = parsed.data;
        const result = await (0, db_1.query)(`SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(employee_id) = LOWER($1) OR LOWER(employee_code) = LOWER($1)`, [identifier]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const user = result.rows[0];
        if (user.status !== 'active') {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const rawRoles = user.roles;
        const roles = Array.isArray(rawRoles)
            ? rawRoles.map((r) => String(r).toLowerCase())
            : [String(user.role || 'employee').toLowerCase()];
        const token = jsonwebtoken_1.default.sign({ id: user.id, employee_id: user.employee_id, role: user.role, roles }, JWT_SECRET, { expiresIn: '7d' });
        // Don't send the password hash back
        if (user.email) {
            user.email = user.email.toLowerCase().trim();
        }
        const { password_hash, ...userWithoutPassword } = user;
        let photoUrl = user.profile_photo_url;
        if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('/')) {
            const host = req.get('host');
            if (host) {
                photoUrl = `${req.protocol}://${host}${photoUrl}`;
            }
        }
        userWithoutPassword.profilePhotoUrl = photoUrl;
        userWithoutPassword.profile_photo_url = photoUrl;
        userWithoutPassword.roles = roles;
        userWithoutPassword.attendanceMode = user.attendance_mode || 'Office';
        userWithoutPassword.attendance_mode = user.attendance_mode || 'Office';
        res.json({
            message: 'Login successful',
            token,
            user: userWithoutPassword,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
const logout = async (req, res) => {
    res.json({ message: 'Logout successful' });
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await (0, db_1.query)(`SELECT id, employee_id, name, email, phone, role, roles, status, COALESCE(attendance_mode, 'Office') as "attendanceMode", COALESCE(attendance_mode, 'Office') as attendance_mode, profile_photo_url, profile_photo_url as "profilePhotoUrl", created_at FROM users WHERE id = $1`, [req.user.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const dbUser = result.rows[0];
        if (dbUser.email) {
            dbUser.email = dbUser.email.toLowerCase().trim();
        }
        const rawRoles = dbUser.roles;
        dbUser.roles = Array.isArray(rawRoles)
            ? rawRoles.map((r) => String(r).toLowerCase())
            : [String(dbUser.role || 'employee').toLowerCase()];
        if (dbUser.profilePhotoUrl && typeof dbUser.profilePhotoUrl === 'string' && dbUser.profilePhotoUrl.startsWith('/')) {
            const host = req.get('host');
            if (host) {
                dbUser.profilePhotoUrl = `${req.protocol}://${host}${dbUser.profilePhotoUrl}`;
            }
        }
        dbUser.profile_photo_url = dbUser.profilePhotoUrl;
        res.json({ user: dbUser });
    }
    catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMe = getMe;
