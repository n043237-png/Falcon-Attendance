import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { processAndSaveProfilePhoto, deleteProfilePhotoFile } from '../middlewares/upload';
import { NotificationService } from '../services/notificationService';
import { EmployeeProfileService } from '../services/employeeProfileService';
import { DocumentService } from '../services/documentService';

const phoneTenDigitSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val === '' || val.length === 10, {
    message: 'Phone number must be exactly 10 digits'
  })
  .optional()
  .or(z.literal(''))
  .or(z.null());

const selfUpdateProfileSchema = z.object({
  phone: phoneTenDigitSchema,
  name: z.string().min(2).max(100).optional(),
  personalEmail: z.string().email().optional().or(z.literal('')).or(z.null()),
  currentAddress: z.string().max(500).optional().or(z.literal('')).or(z.null()),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  emergencyContactRelationship: z.string().max(50).optional().or(z.literal('')).or(z.null()),
  emergencyContactPhone: phoneTenDigitSchema,
  emergencyContactAltPhone: phoneTenDigitSchema,
  motherName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  fatherName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  profilePhotoUrl: z.string().nullable().optional().or(z.literal(''))
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const fullProfile = await EmployeeProfileService.getFullProfile(userId, false);

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
    } else {
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

    if (fullProfile.email) {
      fullProfile.email = fullProfile.email.toLowerCase().trim();
    }

    res.json({ success: true, data: fullProfile });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch profile' } });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = (req.user!.role === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee';

    const parsed = selfUpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const updatedProfile = await EmployeeProfileService.updateProfile(userId, userId, userRole, parsed.data);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to update profile' } });
  }
};

export const uploadProfileDocumentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No file provided' } });
      return;
    }

    const documentType = (req.body.documentType || 'OTHER').toUpperCase();
    const documentTitle = req.body.documentTitle || req.file.originalname;

    // Self-service employee upload check: employees can upload RESUME or general docs
    const savedDoc = await DocumentService.saveDocumentRecord({
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
  } catch (error: any) {
    console.error('uploadProfileDocumentHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload document' } });
  }
};

export const deleteProfileDocumentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const docId = parseInt(req.params.docId as string);

    if (isNaN(docId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid document ID' } });
      return;
    }

    await DocumentService.deleteDocument(docId, userId, userId, req.user?.role === 'admin');

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
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

export const getProfileActivityHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const activities = await EmployeeProfileService.getProfileActivityLogs(userId, 50);
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('getProfileActivityHandler error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch activity logs' } });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = changePasswordSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;

    const userRes = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect current password' } });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [hashed, userId]);

    // Send security notification to user
    try {
      await NotificationService.notifyUser(userId, {
        title: 'Password Changed Successfully',
        message: 'Your account password was updated. If you did not make this change, please contact your administrator immediately.',
        type: 'Security',
        priority: 'Critical',
        actionUrl: '/profile',
      });
    } catch (notifErr) {
      console.warn('Password change notification error:', notifErr);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to change password' } });
  }
};

export const uploadProfilePhotoHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No photo file provided' } });
      return;
    }

    const photoUrl = await processAndSaveProfilePhoto(req.file.buffer, `user-${userId}`);

    const userRes = await query(`SELECT profile_photo_url FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length > 0 && userRes.rows[0].profile_photo_url) {
      await deleteProfilePhotoFile(userRes.rows[0].profile_photo_url);
    }

    await query(`UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [photoUrl, userId]);
    await query(`UPDATE employee_profiles SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`, [photoUrl, userId]);

    res.json({
      success: true,
      data: {
        profilePhotoUrl: photoUrl,
      },
      message: 'Profile photo updated successfully',
    });
  } catch (error: any) {
    console.error('uploadProfilePhotoHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to upload photo' } });
  }
};

export const deleteProfilePhotoHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRes = await query(`SELECT profile_photo_url FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length > 0 && userRes.rows[0].profile_photo_url) {
      await deleteProfilePhotoFile(userRes.rows[0].profile_photo_url);
    }

    await query(`UPDATE users SET profile_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
    await query(`UPDATE employee_profiles SET profile_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);

    res.json({
      success: true,
      message: 'Profile photo removed successfully',
    });
  } catch (error: any) {
    console.error('deleteProfilePhotoHandler error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to remove photo' } });
  }
};
