/**
 * geoUtils.ts
 * Geofencing utility functions for attendance verification.
 */

/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Convenience: returns true when the given coords are within the geofence radius.
 */
export const isWithinGeofence = (
  userLat: number,
  userLng: number,
  officeLat: number,
  officeLng: number,
  radiusMeters: number
): boolean => {
  return calculateDistance(userLat, userLng, officeLat, officeLng) <= radiusMeters;
};

/**
 * Returns a human-readable label for a GPS accuracy reading (meters).
 *   ≤ 10 m   → "Excellent"
 *   ≤ 30 m   → "Good"
 *   ≤ 100 m  → "Fair"
 *   > 100 m  → "Poor"
 */
export const getAccuracyLabel = (accuracyMeters: number | null | undefined): string => {
  if (accuracyMeters == null) return 'Unknown';
  if (accuracyMeters <= 10) return 'Excellent';
  if (accuracyMeters <= 30) return 'Good';
  if (accuracyMeters <= 100) return 'Fair';
  return 'Poor';
};
