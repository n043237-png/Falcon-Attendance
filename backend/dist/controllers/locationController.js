"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLocation = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const locationService_1 = require("../services/locationService");
const locationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    accuracy: zod_1.z.number().positive(),
    source: zod_1.z.string().optional(),
});
const validateLocation = async (req, res) => {
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
            const result = await (0, locationService_1.verifyLocation)(latitude, longitude, accuracy, isWeb);
            // Audit log
            await (0, db_1.query)(`
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
        }
        catch (verr) {
            if (verr.status) {
                res.status(verr.status).json({ success: false, error: { code: verr.code, message: verr.message } });
                return;
            }
            throw verr;
        }
    }
    catch (error) {
        console.error('Location validation error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while validating location.' }
        });
    }
};
exports.validateLocation = validateLocation;
