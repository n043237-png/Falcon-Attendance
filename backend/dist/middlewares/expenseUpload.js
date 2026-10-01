"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadExpenseFiles = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const EXPENSE_UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'expenses');
if (!fs_1.default.existsSync(EXPENSE_UPLOAD_DIR)) {
    fs_1.default.mkdirSync(EXPENSE_UPLOAD_DIR, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, EXPENSE_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const unique = `receipt-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}${ext}`;
        cb(null, unique);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp'
    ];
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid document format. Only PDF, JPG, and PNG receipts are supported (up to 10MB).'));
    }
};
exports.uploadExpenseFiles = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter
});
