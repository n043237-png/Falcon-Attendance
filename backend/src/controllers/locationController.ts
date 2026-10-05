import { Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { verifyLocation } from '../services/locationService';

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  source: z.string().optional(),
});

export const validateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Invalid latitude, longitude, or accuracy.' }
      });
      return;
    }

    const { latitude, longitude, accuracy } = parsed.data;
    const isWeb = !!(parsed.data.source || req.body?.source)?.toLowerCase().includes('web');

    try {
      const result = await verifyLocation(latitude, longitude, accuracy, isWeb);

      // Audit log
      await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.user?.id, 'LOCATION_VALIDATION', 'OFFICE', result.officeId, JSON.stringify({ latitude, longitude, accuracy, ...result })]);

      res.json({
        success: true,
        data: {
          insideOffice: result.insideOffice,
          distanceMeters: result.distanceMeters,
          allowedRadiusMeters: result.allowedRadiusMeters,
          accuracyMeters: result.accuracyMeters
        }
      });
    } catch (verr: any) {
      if (verr.status) {
        res.status(verr.status).json({ success: false, error: { code: verr.code, message: verr.message } });
        return;
      }
      throw verr;
    }
  } catch (error) {
    console.error('Location validation error:', error);
    res.status(500).json({ 
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while validating location.' }
    });
  }
};
