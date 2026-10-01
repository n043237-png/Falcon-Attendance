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
    console.warn('reverseGeocode failed:', e);
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};
