/**
 * Geofence calculation utilities using Haversine formula
 * Standard Earth Radius R = 6,371,000 meters
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} radians
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Validate latitude and longitude values
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isValidCoordinates(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
  return latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180;
}

/**
 * Calculate great-circle distance between two GPS coordinates using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const lat1Num = Number(lat1);
  const lon1Num = Number(lon1);
  const lat2Num = Number(lat2);
  const lon2Num = Number(lon2);

  if (!isValidCoordinates(lat1Num, lon1Num) || !isValidCoordinates(lat2Num, lon2Num)) {
    throw new Error('Invalid coordinates provided for distance calculation');
  }

  const phi1 = toRadians(lat1Num);
  const phi2 = toRadians(lat2Num);
  const deltaPhi = toRadians(lat2Num - lat1Num);
  const deltaLambda = toRadians(lon2Num - lon1Num);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100; // rounded to 2 decimal places
}

/**
 * Check if coordinate is inside geofence radius
 * @param {number} userLat
 * @param {number} userLon
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} radiusMeters Default 50m
 * @returns {{ isInside: boolean, distance: number }}
 */
function verifyGeofence(userLat, userLon, centerLat, centerLon, radiusMeters = 50) {
  const distance = calculateDistance(userLat, userLon, centerLat, centerLon);
  const safeRadius = Number(radiusMeters);

  if (!Number.isFinite(safeRadius) || safeRadius < 0) {
    return {
      isInside: false,
      distance,
      radius: 0
    };
  }

  return {
    isInside: distance <= safeRadius,
    distance,
    radius: safeRadius
  };
}

module.exports = {
  EARTH_RADIUS_METERS,
  toRadians,
  isValidCoordinates,
  calculateDistance,
  verifyGeofence
};
