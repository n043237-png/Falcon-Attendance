"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = exports.uploadDocumentMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const DOCS_DIR = path_1.default.join(process.cwd(), 'uploads', 'documents');
if (!fs_1.default.existsSync(DOCS_DIR)) {
    fs_1.default.mkdirSync(DOCS_DIR, { recursive: true });
}
// Multer disk storage for documents up to 10MB
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DOCS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const docType = (req.body.documentType || 'DOC').toUpperCase().replace(/[^A-Z0-9_]/g, '');
        const unique = `${docType}-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}${ext}`;
        cb(null, unique);
    }
});
const fileFilter = (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only PDF, JPG, and PNG documents up to 10MB are permitted.'));
    }
};
exports.uploadDocumentMiddleware = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter
});
class DocumentService {
    /**
     * Save uploaded document record
     */
    static async saveDocumentRecord(params) {
        const fileUrl = `/uploads/documents/${params.file.filename}`;
        const res = await (0, db_1.query)(`
      INSERT INTO employee_documents (
        user_id, document_type, document_title, file_url, file_name, file_size, mime_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id, 
        user_id as "userId", 
        document_type as "documentType", 
        document_title as "documentTitle", 
        file_url as "fileUrl", 
        file_name as "fileName", 
        file_size as "fileSize", 
        mime_type as "mimeType", 
        uploaded_by as "uploadedBy", 
        created_at as "createdAt"
    `, [
            params.userId,
            params.documentType,
            params.documentTitle,
            fileUrl,
            params.file.originalname,
            params.file.size,
            params.file.mimetype,
            params.uploadedBy
        ]);
        // Audit log
        await (0, db_1.query)(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
            params.uploadedBy,
            'DOCUMENT_UPLOADED',
            'employee_document',
            res.rows[0].id,
            JSON.stringify({
                targetUserId: params.userId,
                documentType: params.documentType,
                documentTitle: params.documentTitle,
                fileName: params.file.originalname,
                fileSize: params.file.size,
                timestamp: new Date().toISOString()
            })
        ]);
        return res.rows[0];
    }
    /**
     * Delete document by id
     */
    static async deleteDocument(docId, targetUserId, deletedBy, isAdmin) {
        const checkRes = await (0, db_1.query)(`
      SELECT id, user_id as "userId", file_url as "fileUrl", document_title as "documentTitle", document_type as "documentType"
      FROM employee_documents
      WHERE id = $1
    `, [docId]);
        if (checkRes.rows.length === 0) {
            throw new Error('DOCUMENT_NOT_FOUND');
        }
        const doc = checkRes.rows[0];
        if (!isAdmin && doc.userId !== targetUserId) {
            throw new Error('FORBIDDEN');
        }
        // Attempt to remove physical file
        try {
            const fileName = path_1.default.basename(doc.fileUrl);
            const filePath = path_1.default.join(DOCS_DIR, fileName);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        catch (err) {
            console.error('Failed to remove physical file:', err);
        }
        await (0, db_1.query)('DELETE FROM employee_documents WHERE id = $1', [docId]);
        // Audit log
        await (0, db_1.query)(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
            deletedBy,
            'DOCUMENT_DELETED',
            'employee_document',
            docId,
            JSON.stringify({
                targetUserId: doc.userId,
                documentType: doc.documentType,
                documentTitle: doc.documentTitle,
                timestamp: new Date().toISOString()
            })
        ]);
        return true;
    }
}
exports.DocumentService = DocumentService;
