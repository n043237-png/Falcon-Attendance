import { query } from '../db';

const MAX_ACCURACY = parseInt(process.env.MAX_LOCATION_ACCURACY_METERS || '100', 10);
const WEB_MAX_ACCURACY = parseInt(process.env.WEB_MAX_LOCATION_ACCURACY_METERS || '150', 10);
const WEB_OFFICE_RADIUS_OVERRIDE = process.env.WEB_OFFICE_RADIUS_METERS 
  ? parseInt(process.env.WEB_OFFICE_RADIUS_METERS, 10) 
  : null;

export interface LocationValidationResult {
  insideOffice: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  accuracyMeters: number;
  officeId: number;
  officeName: string;
}

export const verifyLocation = async (
  latitude: number, 
  longitude: number, 
  accuracy: number,
  isWeb: boolean = false
): Promise<LocationValidationResult> => {
  
  // High-accuracy location required: <= 100m for mobile GPS, <= 150m for Web Portal Wi-Fi
  const maxAllowedAccuracy = isWeb ? WEB_MAX_ACCURACY : MAX_ACCURACY;

  if (accuracy > maxAllowedAccuracy) {
    throw {
      status: 400,
      code: 'LOCATION_ACCURACY_TOO_LOW',
      message: isWeb
        ? `Location accuracy is too low (${Math.round(accuracy)}m). Please enable Wi-Fi on your PC/laptop so your physical office location can be accurately verified.`
        : 'GPS accuracy is too low. Please move to an area with better GPS signal and try again.',
    };
  }

  const officeResult = await query(`
    SELECT 
      id, 
      name,
      radius_meters,
      ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
    FROM offices 
    WHERE status = 'active' 
    LIMIT 1
  `, [longitude, latitude]);

  if (officeResult.rows.length === 0) {
    throw {
      status: 404,
      code: 'OFFICE_NOT_CONFIGURED',
      message: 'No active office location is configured.',
    };
  }

  const office = officeResult.rows[0];
  const distanceMeters = parseFloat(office.distance_meters);

  // Strictly enforce the office geofence radius for both Web Portal and Mobile
  const allowedRadius = (isWeb && WEB_OFFICE_RADIUS_OVERRIDE !== null)
    ? WEB_OFFICE_RADIUS_OVERRIDE
    : office.radius_meters;

  const insideOffice = distanceMeters <= allowedRadius;

  return {
    insideOffice,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    allowedRadiusMeters: allowedRadius,
    accuracyMeters: Math.round(accuracy),
    officeId: office.id,
    officeName: office.name || 'Falcon Info Solutions HQ'
  };
};
