import { query } from '../db';

const MAX_ACCURACY = parseInt(process.env.MAX_LOCATION_ACCURACY_METERS || '100', 10);
const WEB_OFFICE_RADIUS_METERS = parseInt(process.env.WEB_OFFICE_RADIUS_METERS || '12000', 10);

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
  
  // Mobile devices require high-precision GPS (<= 100m).
  // Web Portal (PC/laptop) uses Wi-Fi / IP geolocation without GPS hardware.
  const maxAllowedAccuracy = isWeb ? 50000 : MAX_ACCURACY;

  if (accuracy > maxAllowedAccuracy) {
    throw {
      status: 400,
      code: 'LOCATION_ACCURACY_TOO_LOW',
      message: isWeb
        ? 'Location accuracy is too low. Please ensure location services are enabled.'
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

  // For Web Portal, office PCs use wired broadband or Wi-Fi where ISP IP routing places them within regional exchange range (~7-10km).
  const allowedRadius = isWeb 
    ? Math.max(office.radius_meters, WEB_OFFICE_RADIUS_METERS) 
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
