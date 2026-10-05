/**
 * Geocoding Service for Reverse Geocoding Coordinates to Readable Location Names
 */

export class GeocodingService {
  private static cache = new Map<string, string>();

  public static async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (isNaN(latitude) || isNaN(longitude)) return null;

    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 1. Try OpenStreetMap Nominatim
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: { 'User-Agent': 'FalconAttendanceApp/1.0 (contact@falconinfo.net)' },
          signal: controller.signal
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.street || addr.neighbourhood || addr.suburb || addr.hamlet || addr.village;
          const city = addr.city || addr.town || addr.county || addr.state_district;
          const state = addr.state;
          const postcode = addr.postcode;

          const parts = [road, city, state, postcode].filter(Boolean);
          if (parts.length > 0) {
            const formatted = parts.join(', ');
            this.cache.set(key, formatted);
            return formatted;
          }
        }
        if (data && data.display_name) {
          this.cache.set(key, data.display_name);
          return data.display_name;
        }
      }
    } catch (osmErr) {
      // Continue to fallback
    }

    // 2. Fallback: BigDataCloud free client reverse geocode
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const bdc: any = await res.json();
        const parts = [
          bdc.locality,
          bdc.city,
          bdc.principalSubdivision,
          bdc.postcode
        ].filter(Boolean);
        if (parts.length > 0) {
          const formatted = Array.from(new Set(parts)).join(', ');
          this.cache.set(key, formatted);
          return formatted;
        }
      }
    } catch (bdcErr) {
      // Ignore
    }

    return null;
  }
}
