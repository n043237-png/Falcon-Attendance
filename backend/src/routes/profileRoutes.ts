import { Router } from 'express';
import { 
  getProfile, 
  updateProfile, 
  changePassword, 
  uploadProfilePhotoHandler, 
  deleteProfilePhotoHandler,
  uploadProfileDocumentHandler,
  deleteProfileDocumentHandler,
  getProfileActivityHandler
} from '../controllers/profileController';
import { getMyIdCard, downloadMyIdCardPdf } from '../controllers/idCardController';
import { authenticateToken } from '../middlewares/auth';
import { uploadProfilePhoto } from '../middlewares/upload';
import { uploadDocumentMiddleware } from '../services/documentService';

const router = Router();

router.use(authenticateToken); // Protect all profile routes

router.get('/', getProfile);
router.patch('/', updateProfile);
router.patch('/change-password', changePassword);
router.post('/photo', uploadProfilePhoto.single('photo'), uploadProfilePhotoHandler);
router.delete('/photo', deleteProfilePhotoHandler);

// Digital Employee ID Card
router.get('/id-card', getMyIdCard);
router.get('/id-card/pdf', downloadMyIdCardPdf);

// Document management
router.post('/documents', uploadDocumentMiddleware.single('file'), uploadProfileDocumentHandler);
router.delete('/documents/:docId', deleteProfileDocumentHandler);

// Profile activity / audit history
router.get('/activity', getProfileActivityHandler);

export default router;
