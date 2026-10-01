import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { IdCardService } from '../services/idCardService';
import { query } from '../db';

/**
 * Get current logged in employee's ID card data
 */
export const getMyIdCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cardData = await IdCardService.getEmployeeCardData(userId);
    res.json({ success: true, data: cardData });
  } catch (error: any) {
    console.error('getMyIdCard error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate ID card' }
    });
  }
};

/**
 * Download current logged in employee's ID card as PDF
 */
export const downloadMyIdCardPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const pdfBuffer = await IdCardService.generateCardPdf(userId);
    const cardData = await IdCardService.getEmployeeCardData(userId);

    const filename = `Falcon_ID_Card_${cardData.employee.employeeId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('downloadMyIdCardPdf error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to download ID card PDF' }
    });
  }
};

/**
 * Admin: Get specific employee's ID card data
 */
export const getEmployeeIdCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }
    const cardData = await IdCardService.getEmployeeCardData(userId);
    res.json({ success: true, data: cardData });
  } catch (error: any) {
    console.error('getEmployeeIdCard error:', error);
    res.status(404).json({
      success: false,
      error: { message: error.message || 'Employee ID card not found' }
    });
  }
};

/**
 * Admin: Download specific employee's ID card as PDF
 */
export const downloadEmployeeIdCardPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
      return;
    }
    const pdfBuffer = await IdCardService.generateCardPdf(userId);
    const cardData = await IdCardService.getEmployeeCardData(userId);

    const filename = `Falcon_ID_Card_${cardData.employee.employeeId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('downloadEmployeeIdCardPdf error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to download ID card PDF' }
    });
  }
};

/**
 * Admin: Get bulk card data for all employees with optional filters
 */
export const getBulkIdCardsData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const department = req.query.department as string | undefined;
    const attendanceMode = req.query.attendanceMode as string | undefined;
    const search = req.query.search as string | undefined;

    let sql = `
      SELECT u.id, u.name, u.employee_id as "employeeId", u.department, u.designation,
             COALESCE(u.attendance_mode, 'Office') as "attendanceMode",
             u.profile_photo_url as "profilePhotoUrl"
      FROM users u
      WHERE u.status = 'active'
    `;
    const params: any[] = [];

    if (department && department !== 'All') {
      params.push(department);
      sql += ` AND u.department = $${params.length}`;
    }
    if (attendanceMode && attendanceMode !== 'All') {
      params.push(attendanceMode);
      sql += ` AND COALESCE(u.attendance_mode, 'Office') = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR u.employee_id ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    sql += ` ORDER BY u.name ASC`;

    const result = await query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error: any) {
    console.error('getBulkIdCardsData error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to load employees for ID cards' }
    });
  }
};

/**
 * Admin: Bulk download multi-page PDF
 */
export const downloadBulkIdCardsPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    const pdfBuffer = await IdCardService.generateBulkCardsPdf(userIds);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Falcon_Bulk_ID_Cards_${timestamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('downloadBulkIdCardsPdf error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate bulk ID cards PDF' }
    });
  }
};

/**
 * Admin: Bulk download ZIP archive of individual PDFs
 */
export const downloadBulkIdCardsZip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    const zipBuffer = await IdCardService.generateBulkCardsZip(userIds);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Falcon_Bulk_ID_Cards_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.end(zipBuffer);
  } catch (error: any) {
    console.error('downloadBulkIdCardsZip error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate bulk ID cards ZIP' }
    });
  }
};

/**
 * Public Verification endpoint: Verify ID card credentials
 */
export const verifyIdCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.verificationId;
    const verificationId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!verificationId || typeof verificationId !== 'string') {
      res.status(400).json({ success: false, error: { message: 'Verification ID required' } });
      return;
    }

    // Format: FALCON-VERIFY-{userId}-{hash}
    const parts = verificationId.split('-');
    if (parts.length < 3) {
      res.status(400).json({ success: false, verified: false, message: 'Invalid verification ID format' });
      return;
    }

    const userId = parseInt(parts[2], 10);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ success: false, verified: false, message: 'Invalid employee reference in verification ID' });
      return;
    }

    const cardData = await IdCardService.getEmployeeCardData(userId);
    if (cardData.verificationId !== verificationId) {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'Security verification signature mismatch. This ID card might be counterfeit.'
      });
      return;
    }

    res.json({
      success: true,
      verified: true,
      message: 'Official Falcon Info Solutions ID Card Verified Successfully',
      data: {
        employeeName: cardData.employee.name,
        employeeId: cardData.employee.employeeId,
        department: cardData.employee.department,
        designation: cardData.employee.designation,
        attendanceMode: cardData.employee.attendanceMode,
        joiningDate: cardData.employee.joiningDate,
        profilePhotoUrl: cardData.employee.profilePhotoUrl,
        companyName: cardData.company.name,
        verificationTimestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('verifyIdCard error:', error);
    res.status(404).json({
      success: false,
      verified: false,
      message: error.message || 'Employee credentials not found'
    });
  }
};
