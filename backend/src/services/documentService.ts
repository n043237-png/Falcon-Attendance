import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { query } from '../db';

const DOCS_DIR = path.join(process.cwd(), 'uploads', 'documents');

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// Multer disk storage for documents up to 10MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const docType = (req.body.documentType || 'DOC').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const unique = `${docType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, unique);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG documents up to 10MB are permitted.'));
  }
};

export const uploadDocumentMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter
});

export class DocumentService {
  /**
   * Save uploaded document record
   */
  static async saveDocumentRecord(params: {
    userId: number;
    documentType: string;
    documentTitle: string;
    file: Express.Multer.File;
    uploadedBy: number;
  }) {
    const fileUrl = `/uploads/documents/${params.file.filename}`;

    const res = await query(`
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
    await query(`
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
  static async deleteDocument(docId: number, targetUserId: number, deletedBy: number, isAdmin: boolean) {
    const checkRes = await query(`
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
      const fileName = path.basename(doc.fileUrl);
      const filePath = path.join(DOCS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to remove physical file:', err);
    }

    await query('DELETE FROM employee_documents WHERE id = $1', [docId]);

    // Audit log
    await query(`
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
