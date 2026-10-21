const axios = require('axios');
const dbBridge = require('./dbBridge');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * Convert HH:mm to minutes from midnight
 * @param {string} timeStr e.g. "09:00"
 * @returns {number} minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return 0;
  }

  const [hoursRaw, minutesRaw] = timeStr.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

/**
 * Extract time of day from Date object as minutes from midnight in local timezone
 * @param {Date} date
 * @returns {number}
 */
function dateToMinutes(date) {
  if (!(date instanceof Date) && !(typeof date === 'string' || typeof date === 'number')) {
    return 0;
  }

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return 0;
  }

  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Compute the 4-feature vector defined by the SRS:
 * 1. Check-in time deviation from shift start (minutes)
 *    Positive = late arrival, Negative = early arrival
 * 2. Check-out time deviation from shift end (minutes)
 *    Positive = late departure, Negative = early departure
 * 3. Duration spent inside the geofence (minutes)
 * 4. GPS distance/accuracy from geofence centre (meters)
 *
 * @param {Date} checkInTime
 * @param {Date} checkOutTime
 * @param {number} durationMinutes
 * @param {number} distanceFromCenter
 * @param {object} shiftSchedule
 * @returns {{ features: number[], featureObj: object }}
 */
function extractFeatures(checkInTime, checkOutTime, durationMinutes, distanceFromCenter, shiftSchedule) {
  const shiftStartMins = timeToMinutes(shiftSchedule?.shiftStart || '09:00');
  const shiftEndMins = timeToMinutes(shiftSchedule?.shiftEnd || '18:00');

  const safeDurationMinutes = Number(durationMinutes);
  const safeDistanceFromCenter = Number(distanceFromCenter);

  const actualCheckInMins = dateToMinutes(checkInTime);
  const actualCheckOutMins = checkOutTime ? dateToMinutes(checkOutTime) : actualCheckInMins + (Number.isFinite(safeDurationMinutes) ? safeDurationMinutes : 0);

  // Feature 1: Check-in deviation
  // Example: Shift 09:00 (540m). In 09:30 (570m) => +30 (Late)
  // In 08:45 (525m) => -15 (Early)
  const checkInDeviation = actualCheckInMins - shiftStartMins;

  // Feature 2: Check-out deviation
  // Example: Shift 18:00 (1080m). Out 17:30 (1050m) => -30 (Early departure)
  // Out 18:30 (1110m) => +30 (Overtime departure)
  const checkOutDeviation = actualCheckOutMins - shiftEndMins;

  // Feature 3: Geofence duration
  const geofenceDuration = Math.max(0, Number.isFinite(safeDurationMinutes) ? Math.round(safeDurationMinutes) : 0);

  // Feature 4: GPS distance from center
  const distance = Math.max(0, Number.isFinite(safeDistanceFromCenter) ? Math.round((safeDistanceFromCenter || 0) * 100) / 100 : 0);

  const featureObj = {
    checkInDeviation,
    checkOutDeviation,
    geofenceDuration,
    distanceFromCenter: distance
  };

  // Fixed 4-feature vector order matching Python Isolation Forest
  const features = [checkInDeviation, checkOutDeviation, geofenceDuration, distance];

  return { features, featureObj };
}

/**
 * Evaluate deterministic hard rules independently of ML
 * @param {object} featureObj
 * @returns {{ isHardRuleViolation: boolean, violations: string[] }}
 */
function evaluateHardRules(featureObj) {
  const violations = [];

  // Hard Rule 1 (SRS Requirement): Recorded geofence duration below 30 minutes
  if (featureObj.geofenceDuration < 30) {
    violations.push('Duration below 30 minutes threshold (SRS Hard Rule)');
  }

  // Hard Rule 2: Distance from centre exceeds 50-metre geofence boundary
  if (featureObj.distanceFromCenter > 50) {
    violations.push(`Recorded GPS distance (${featureObj.distanceFromCenter}m) exceeds 50m geofence boundary`);
  }

  // Hard Rule 3: Extreme late arrival (> 240 mins / 4 hours) without approved leave
  if (featureObj.checkInDeviation > 240) {
    violations.push(`Extreme late arrival (> 4 hours after shift start)`);
  }

  return {
    isHardRuleViolation: violations.length > 0,
    violations
  };
}

/**
 * Coordinate attendance anomaly assessment between ML service and Hard Rules
 * @param {object} params
 * @param {Date} params.checkInTime
 * @param {Date} params.checkOutTime
 * @param {number} params.durationMinutes
 * @param {number} params.distanceFromCenter
 * @returns {Promise<object>} Assessment result
 */
async function assessAttendanceRecord({ checkInTime, checkOutTime, durationMinutes, distanceFromCenter, workplaceId = null, shiftSchedule = null }) {
  // Load workplace-specific shift schedule or fallback
  if (!shiftSchedule) {
    shiftSchedule = await dbBridge.getCompanyShift(workplaceId);
  }
  if (!shiftSchedule) {
    shiftSchedule = { shiftStart: '09:00', shiftEnd: '18:00' };
  }

  const { features, featureObj } = extractFeatures(
    checkInTime,
    checkOutTime,
    durationMinutes,
    distanceFromCenter,
    shiftSchedule
  );

  // 1. Evaluate Hard Rules
  const hardRuleResult = evaluateHardRules(featureObj);

  // 2. Evaluate Machine Learning Model via Python ML Service
  let mlResult = null;
  let mlServiceAvailable = false;

  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/assess`,
      {
        features,
        feature_names: [
          'check_in_deviation',
          'check_out_deviation',
          'geofence_duration',
          'distance_from_center'
        ]
      },
      { timeout: 3000 }
    );

    if (response.data && response.data.success) {
      mlResult = response.data;
      mlServiceAvailable = true;
    }
  } catch (err) {
    console.warn(`[ML Service Warning] Unable to contact Python ML service at ${ML_SERVICE_URL}: ${err.message}`);
  }

  // 3. Combine results
  const isHardRule = hardRuleResult.isHardRuleViolation;
  const isMlAnomaly = mlServiceAvailable && mlResult && mlResult.is_anomaly;

  let detectionSource = 'none';
  if (isMlAnomaly && isHardRule) {
    detectionSource = 'both';
  } else if (isMlAnomaly && !isHardRule) {
    detectionSource = 'ml_only';
  } else if (!isMlAnomaly && isHardRule) {
    detectionSource = 'hard_rule_only';
  }

  const isAnomaly = isHardRule || isMlAnomaly;

  // Build clear, human-readable explanation
  let explanation = '';
  if (detectionSource === 'both') {
    explanation = `Flagged by both ML Model (Score: ${mlResult.anomaly_score}) and Hard Rules: ${hardRuleResult.violations.join('; ')}`;
  } else if (detectionSource === 'ml_only') {
    explanation = `Flagged by Isolation Forest ML Anomaly Detection (Anomaly Score: ${mlResult.anomaly_score}). Pattern deviates from normal attendance distribution.`;
  } else if (detectionSource === 'hard_rule_only') {
    explanation = `Flagged by deterministic Hard Rule: ${hardRuleResult.violations.join('; ')}` +
      (!mlServiceAvailable ? ' (ML Service was offline during evaluation)' : '');
  } else if (!mlServiceAvailable) {
    explanation = 'Evaluated by Hard Rules only (ML Service unavailable at assessment time). No violations detected.';
  } else {
    explanation = 'Normal attendance session. Within acceptable shift and geofence parameters.';
  }

  return {
    isAnomaly,
    detectionSource,
    score: mlResult ? mlResult.anomaly_score : 0,
    mlScore: mlResult ? mlResult.anomaly_score : null,
    mlPrediction: mlResult ? mlResult.prediction : 1, // 1 for normal, -1 for anomaly
    hardRuleViolations: hardRuleResult.violations,
    features: featureObj,
    reviewStatus: isAnomaly ? 'pending' : 'resolved',
    explanation,
    assessedAt: new Date(),
    mlServiceAvailable
  };
}

module.exports = {
  extractFeatures,
  evaluateHardRules,
  assessAttendanceRecord,
  timeToMinutes,
  dateToMinutes
};
