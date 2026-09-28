"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProfilePhotoHandler = exports.uploadProfilePhotoHandler = exports.changePassword = exports.getProfileActivityHandler = exports.deleteProfileDocumentHandler = exports.uploadProfileDocumentHandler = exports.updateProfile = exports.getProfile = void 0;
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../db");
const upload_1 = require("../middlewares/upload");
const notificationService_1 = require("../services/notificationService");
const employeeProfileService_1 = require("../services/employeeProfileService");
const documentService_1 = require("../services/documentService");
const phoneTenDigitSchema = zod_1.z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val === '' || val.length === 10, {
    message: 'Phone number must be exactly 10 digits'
})
    .optional()
    .or(zod_1.z.literal(''))
    .or(zod_1.z.null());
const selfUpdateProfileSchema = zod_1.z.object({
    phone: phoneTenDigitSchema,
    name: zod_1.z.string().min(2).max(100).optional(),
    personalEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')).or(zod_1.z.null()),
    currentAddress: zod_1.z.string().max(500).optional().or(zod_1.z.literal('')).or(zod_1.z.null()),
    emergencyContactName: zod_1.z.string().max(100).optional().or(zod_1.z.literal('')).or(zod_1.z.null()),
    emergencyContactRelationship: zod_1.z.string().max(50).optional().or(zod_1.z.literal('')).or(zod_1.z.null()),
    emergencyContactPhone: phoneTenDigitSchema,
    emergencyContactAltPhone: phoneTenDigitSchema,
    profilePhotoUrl: zod_1.z.string().max(1000).nullable().optional().or(zod_1.z.literal(''))
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6).max(100),
});
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const fullProfile = await employeeProfileService_1.EmployeeProfileService.getFullProfile(userId, false);
        if (!fullProfile) {
            res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
            return;
        }
        if (fullProfile.joiningDate) {
            fullProfile.joiningDate = new Date(fullProfile.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        if (fullProfile.provisionalStartDate) {
            fullProfile.provisionalStartDate = new Date(fullProfile.provisionalStartDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        if (fullProfile.provisionalEndDate) {
            fullProfile.provisionalEndDate = new Date(fullProfile.provisionalEndDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const today = new Date();
            const end = new Date(fullProfile.provisionalEndDate);
            const diffTime = end.getTime() - today.getTime();
            fullProfile.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        else {
            fullProfile.daysRemaining = null;
        }
        if (fullProfile.dateOfBirth) {
            fullProfile.dateOfBirth = new Date(fullProfile.dateOfBirth).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        if (fullProfile.confirmationDate) {
            fullProfile.confirmationDate = new Date(fullProfile.confirmationDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        if (fullProfile.profilePhotoUrl && typeof fullProfile.profilePhotoUrl === 'string' && fullProfile.profilePhotoUrl.startsWith('/')) {
            const host = req.get('host');
            if (host) {
                fullProfile.profilePhotoUrl = `${req.protocol}://${host}${fullProfile.profilePhotoUrl}`;
            }
        }
        res.json({ success: true, data: fullProfile });
    }
    catch (error) {
        console.error('getProfile error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch profile' } });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = (req.user.role === 'admin' ? 'admin' : 'employee');
        const parsed = selfUpdateProfileSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
            return;
        }
        const updatedProfile = await employeeProfileService_1.EmployeeProfileService.updateProfile(userId, userId, userRole, parsed.data);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile
        });
    }
    catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to update profile' } });
    }
};
exports.updateProfile = updateProfile;
const uploadProfileDocumentHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.file) {
            res.status(400).json({ success: false, error: { message: 'No file provided' } });
            return;
        }
        const documentType = (req.body.documentType || 'OTHER').toUpperCase();
        const documentTitle = req.body.documentTitle || req.file.originalname;
        // Self-service employee upload check: employees can upload RESUME or general docs
        const savedDoc = await documentService_1.DocumentService.saveDocumentRecord({
            userId,
            documentType,
            documentTitle,
            file: req.file,
            uploadedBy: userId
        });
        res.json({
            success: true,
            data: savedDoc,
            message: 'Document uploaded successfully'
        });
    }
    catch (error) {
        console.error('uploadProfileDocumentHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload document' } });
    }
};
exports.uploadProfileDocumentHandler = uploadProfileDocumentHandler;
const deleteProfileDocumentHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        const docId = parseInt(req.params.docId);
        if (isNaN(docId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid document ID' } });
            return;
        }
        await documentService_1.DocumentService.deleteDocument(docId, userId, userId, req.user?.role === 'admin');
        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    }
    catch (error) {
        console.error('deleteProfileDocumentHandler error:', error);
        if (error.message === 'DOCUMENT_NOT_FOUND') {
            res.status(404).json({ success: false, error: { message: 'Document not found' } });
            return;
        }
        if (error.message === 'FORBIDDEN') {
            res.status(403).json({ success: false, error: { message: 'You do not have permission to delete this document' } });
            return;
        }
        res.status(500).json({ success: false, error: { message: 'Failed to delete document' } });
    }
};
exports.deleteProfileDocumentHandler = deleteProfileDocumentHandler;
const getProfileActivityHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        const activities = await employeeProfileService_1.EmployeeProfileService.getProfileActivityLogs(userId, 50);
        res.json({ success: true, data: activities });
    }
    catch (error) {
        console.error('getProfileActivityHandler error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch activity logs' } });
    }
};
exports.getProfileActivityHandler = getProfileActivityHandler;
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
            return;
        }
        const { currentPassword, newPassword } = parsed.data;
        const userRes = await (0, db_1.query)(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
        if (userRes.rows.length === 0) {
            res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
            return;
        }
        const isValid = await bcrypt_1.default.compare(currentPassword, userRes.rows[0].password_hash);
        if (!isValid) {
            res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect current password' } });
            return;
        }
        const hashed = await bcrypt_1.default.hash(newPassword, 10);
        await (0, db_1.query)(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [hashed, userId]);
        // Send security notification to user
        try {
            await notificationService_1.NotificationService.notifyUser(userId, {
                title: 'Password Changed Successfully',
                message: 'Your account password was updated. If you did not make this change, please contact your administrator immediately.',
                type: 'Security',
                priority: 'Critical',
                actionUrl: '/profile',
            });
        }
        catch (notifErr) {
            console.warn('Password change notification error:', notifErr);
        }
        res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('changePassword error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to change password' } });
    }
};
exports.changePassword = changePassword;
const uploadProfilePhotoHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.file) {
            res.status(400).json({ success: false, error: { message: 'No photo file provided' } });
            return;
        }
        const photoUrl = await (0, upload_1.processAndSaveProfilePhoto)(req.file.buffer, `user-${userId}`);
        const userRes = await (0, db_1.query)(`SELECT profile_photo_url FROM users WHERE id = $1`, [userId]);
        if (userRes.rows.length > 0 && userRes.rows[0].profile_photo_url) {
            await (0, upload_1.deleteProfilePhotoFile)(userRes.rows[0].profile_photo_url);
        }
        await (0, db_1.query)(`UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [photoUrl, userId]);
        res.json({
            success: true,
            data: {
                profilePhotoUrl: photoUrl,
            },
            message: 'Profile photo updated successfully',
        });
    }
    catch (error) {
        console.error('uploadProfilePhotoHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload photo' } });
    }
};
exports.uploadProfilePhotoHandler = uploadProfilePhotoHandler;
const deleteProfilePhotoHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRes = await (0, db_1.query)(`SELECT profile_photo_url FROM users WHERE id = $1`, [userId]);
        if (userRes.rows.length > 0 && userRes.rows[0].profile_photo_url) {
            await (0, upload_1.deleteProfilePhotoFile)(userRes.rows[0].profile_photo_url);
        }
        await (0, db_1.query)(`UPDATE users SET profile_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
        res.json({
            success: true,
            message: 'Profile photo removed successfully',
        });
    }
    catch (error) {
        console.error('deleteProfilePhotoHandler error:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to remove photo' } });
    }
};
exports.deleteProfilePhotoHandler = deleteProfilePhotoHandler;
