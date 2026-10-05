import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export const getCurrentLocation = async (): Promise<LocationData> => {
  // 1. Check whether location services are enabled
  const hasServicesEnabled = await Location.hasServicesEnabledAsync();
  if (!hasServicesEnabled) {
    throw new Error('Please enable Location Services to continue.');
  }

  // 2. Request foreground location permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to verify that you are at the Falcon office.');
  }

  // 4. Get the current position
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      // Adding a reasonable timeout so it doesn't hang indefinitely
    });

    // 5. Return location data
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 1000,
      timestamp: location.timestamp,
    };
  } catch (error) {
    throw new Error('Failed to retrieve location. Please try again.');
  }
};

export const getReadableAddress = async (latitude: number, longitude: number): Promise<string> => {
  // 1. Try native Expo reverse geocoding
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addresses && addresses.length > 0) {
      const item = addresses[0];
      const parts = [
        item.name || item.street,
        item.district || item.subregion,
        item.city,
        item.region,
        item.postalCode,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (e) {
    console.warn('Native reverseGeocode failed, trying web service fallback:', e);
  }

  // 2. Try OpenStreetMap Nominatim reverse geocode
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: { 'User-Agent': 'FalconAttendanceApp/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data: any = await res.json();
      if (data?.address) {
        const addr = data.address;
        const road = addr.road || addr.street || addr.neighbourhood || addr.suburb || addr.hamlet || addr.village;
        const city = addr.city || addr.town || addr.county || addr.state_district;
        const state = addr.state;
        const postcode = addr.postcode;
        const parts = [road, city, state, postcode].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
      if (data?.display_name) return data.display_name;
    }
  } catch (osmErr) {
    // Continue to next fallback
  }

  // 3. Fallback: BigDataCloud free client reverse geocoding
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (bdcRes.ok) {
      const bdc: any = await bdcRes.json();
      const parts = [
        bdc.locality,
        bdc.city,
        bdc.principalSubdivision,
        bdc.postcode,
      ].filter(Boolean);
      if (parts.length > 0) {
        return Array.from(new Set(parts)).join(', ');
      }
    }
  } catch (bdcErr) {}

  return `GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
};
