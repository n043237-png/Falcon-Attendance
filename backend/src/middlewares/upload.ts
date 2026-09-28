import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';

// Define uploads directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profiles');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Memory storage for processing through Sharp
const storage = multer.memoryStorage();

// File filter: only JPG, JPEG, PNG, WEBP allowed
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are supported.'));
  }
};

// Multer upload instance (limit 5MB)
export const uploadProfilePhoto = multer({
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
export const processAndSaveProfilePhoto = async (buffer: Buffer, prefix = 'profile'): Promise<string> => {
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  const filePath = path.join(UPLOAD_DIR, filename);

  const webpBuffer = await sharp(buffer)
    .rotate()
    .resize(400, 400, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 80 })
    .toBuffer();

  try {
    await fs.promises.writeFile(filePath, webpBuffer);
  } catch (err) {
    console.warn('Could not write local upload file:', err);
  }

  // Returning base64 data URI ensures the photo persists in Supabase DB and renders on localhost, Vercel, and Mobile APK
  return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
};

/**
 * Delete a profile photo safely from the filesystem
 */
export const deleteProfilePhotoFile = async (photoUrl?: string | null): Promise<void> => {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  
  const filename = path.basename(photoUrl);
  if (!filename || (!filename.endsWith('.webp') && !filename.endsWith('.jpg') && !filename.endsWith('.png'))) {
    return;
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.warn(`Could not delete photo file ${filePath}:`, err);
  }
};
