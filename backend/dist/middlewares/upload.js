"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProfilePhotoFile = exports.processAndSaveAttendanceSelfie = exports.processAndSaveProfilePhoto = exports.uploadProfilePhoto = void 0;
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
// Define uploads directory
const UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'profiles');
// Ensure upload directory exists
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// Memory storage for processing through Sharp
const storage = multer_1.default.memoryStorage();
// File filter: only JPG, JPEG, PNG, WEBP allowed
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are supported.'));
    }
};
// Multer upload instance (limit 5MB)
exports.uploadProfilePhoto = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
    },
    fileFilter,
});
/**
 * Process buffer with Sharp:
 * - Auto-rotate based on EXIF
 * - Square crop 400x400 with cover fit
 * - Compress to WebP with 85% quality
 * - Save with secure randomized filename
 */
const processAndSaveProfilePhoto = async (buffer, prefix = 'profile') => {
    const filename = `${prefix}-${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}.webp`;
    const filePath = path_1.default.join(UPLOAD_DIR, filename);
    const webpBuffer = await (0, sharp_1.default)(buffer)
        .rotate()
        .resize(400, 400, {
        fit: 'cover',
        position: 'center',
    })
        .webp({ quality: 80 })
        .toBuffer();
    try {
        await fs_1.default.promises.writeFile(filePath, webpBuffer);
    }
    catch (err) {
        console.warn('Could not write local upload file:', err);
    }
    // Returning base64 data URI ensures the photo persists in Supabase DB and renders on localhost, Vercel, and Mobile APK
    return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
};
exports.processAndSaveProfilePhoto = processAndSaveProfilePhoto;
const ATTENDANCE_UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'attendance');
if (!fs_1.default.existsSync(ATTENDANCE_UPLOAD_DIR)) {
    fs_1.default.mkdirSync(ATTENDANCE_UPLOAD_DIR, { recursive: true });
}
const processAndSaveAttendanceSelfie = async (rawInput, prefix = 'selfie') => {
    let buffer;
    if (Buffer.isBuffer(rawInput)) {
        buffer = rawInput;
    }
    else if (typeof rawInput === 'string' && rawInput.startsWith('data:')) {
        const base64Data = rawInput.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
    }
    else if (typeof rawInput === 'string') {
        buffer = Buffer.from(rawInput, 'base64');
    }
    else {
        throw new Error('Invalid selfie image data');
    }
    const filename = `${prefix}-${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}.webp`;
    const filePath = path_1.default.join(ATTENDANCE_UPLOAD_DIR, filename);
    const webpBuffer = await (0, sharp_1.default)(buffer)
        .rotate()
        .resize(500, 500, { fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toBuffer();
    try {
        await fs_1.default.promises.writeFile(filePath, webpBuffer);
    }
    catch (err) {
        console.warn('Could not write local selfie file:', err);
    }
    return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
};
exports.processAndSaveAttendanceSelfie = processAndSaveAttendanceSelfie;
/**
 * Delete a profile photo safely from the filesystem
 */
const deleteProfilePhotoFile = async (photoUrl) => {
    if (!photoUrl || typeof photoUrl !== 'string')
        return;
    const filename = path_1.default.basename(photoUrl);
    if (!filename || (!filename.endsWith('.webp') && !filename.endsWith('.jpg') && !filename.endsWith('.png'))) {
        return;
    }
    const filePath = path_1.default.join(UPLOAD_DIR, filename);
    try {
        if (fs_1.default.existsSync(filePath)) {
            await fs_1.default.promises.unlink(filePath);
        }
    }
    catch (err) {
        console.warn(`Could not delete photo file ${filePath}:`, err);
    }
};
exports.deleteProfilePhotoFile = deleteProfilePhotoFile;
