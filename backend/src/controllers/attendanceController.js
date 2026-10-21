const dbBridge = require('../services/dbBridge');
const { calculateDistance, isValidCoordinates, verifyGeofence } = require('../utils/geofence');
const mlService = require('../services/mlService');

function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Handle Geofence Entry / Check-In event
 * Strictly enforces active workplace membership, single-device binding, and workplace geofence
 */
async function checkIn(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { deviceId, latitude, longitude, accuracy = 10, isNativeEvent = false, verificationReference } = req.body;

    // 0. Verify active workplace membership (Tenant Isolation Rule)
    const workplaceId = req.workplaceId;
    if (!workplaceId || (req.user.role === 'employee' && req.membership?.status !== 'approved')) {
      return res.status(403).json({
        success: false,
        error: 'Attendance rejected. You must hold an approved active membership in a workplace before recording attendance. Please select a workplace and wait for administrator approval.',
        requiresMembership: true
      });
    }

    // 0b. Mandatory Biometric Face Verification for Manual Check-In
    let faceVerificationData = null;
    if (!isNativeEvent) {
      if (!verificationReference) {
        return res.status(403).json({
          success: false,
          error: 'Biometric face verification is required before check-in. Please complete your face scan.',
          requiresFaceVerification: true
        });
      }

      const tokenCheck = dbBridge.consumeVerificationToken(verificationReference, employeeId);
      if (!tokenCheck.valid) {
        return res.status(403).json({
          success: false,
          error: `Face verification invalid: ${tokenCheck.reason}`,
          requiresFaceVerification: true
        });
      }

      faceVerificationData = {
        checkInVerified: true,
        checkInVerificationReference: verificationReference,
        similarityScore: tokenCheck.token.similarityScore
      };
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required to record attendance.'
      });
    }

    // 1. Verify single-device binding (SRS Requirement 4)
    const boundDevice = await dbBridge.findDevice({
      employeeId,
      deviceId,
      isBound: true
    });

    if (!boundDevice) {
      return res.status(403).json({
        success: false,
        error: 'Attendance rejected. Request must originate from the registered and bound device.'
      });
    }

    boundDevice.lastSeenAt = new Date();

    // 2. Validate GPS coordinates
    const lat = Number(latitude);
    const lon = Number(longitude);
    const gpsAccuracy = Number(accuracy);

    if (!isValidCoordinates(lat, lon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GPS coordinates provided.'
      });
    }

    // 3. Retrieve workplace-specific geofence
    const geofence = await dbBridge.findGeofence(workplaceId, employeeId);
    if (!geofence || !geofence.center) {
      return res.status(404).json({
        success: false,
        error: 'No active geofence configured for your assigned workplace. Please contact your workplace administrator.'
      });
    }

    // Dynamic acceptable GPS accuracy (accommodates indoor browser/Wi-Fi fixes up to 250m or 1.5x geofence radius)
    const targetRadius = geofence.radius || 50;
    const maxAllowedAccuracy = Math.max(250, targetRadius * 1.5);
    if (gpsAccuracy > maxAllowedAccuracy) {
      return res.status(400).json({
        success: false,
        error: `GPS accuracy (${gpsAccuracy}m) is insufficient. Must be within ${Math.round(maxAllowedAccuracy)}m for geofence verification.`
      });
    }

    // 4. Verify location within workplace geofence radius
    const geofenceCheck = verifyGeofence(lat, lon, geofence.center.latitude, geofence.center.longitude, targetRadius);

    if (!geofenceCheck.isInside) {
      return res.status(400).json({
        success: false,
        isOutside: true,
        error: `Outside workplace geofence. You are ${geofenceCheck.distance} meters away from your designated workplace. Required: within ${targetRadius}m.`,
        currentDistance: geofenceCheck.distance,
        geofenceRadius: targetRadius
      });
    }

    // 5. Prevent duplicate check-ins
    const existingActiveSession = await dbBridge.findActiveAttendance(employeeId);

    if (existingActiveSession) {
      return res.status(409).json({
        success: false,
        error: 'Already checked in. An active attendance session is already in progress.',
        activeSession: {
          attendanceDate: existingActiveSession.attendanceDate,
          checkInTime: existingActiveSession.checkIn.timestamp
        }
      });
    }

    // 6. Create attendance check-in record associated with the workplace
    const attendanceRecord = await dbBridge.createAttendance({
      workplaceId,
      employeeId,
      deviceId,
      attendanceDate: getLocalDateString(),
      checkIn: {
        timestamp: new Date(),
        latitude: lat,
        longitude: lon,
        accuracy: gpsAccuracy,
        distanceToCenter: geofenceCheck.distance
      },
      status: 'checked_in',
      geofenceCenter: {
        latitude: geofence.center.latitude,
        longitude: geofence.center.longitude,
        radius: targetRadius
      },
      auditLog: [
        {
          action: 'CHECK_IN',
          performedBy: employeeId,
          timestamp: new Date(),
          note: isNativeEvent ? 'Native Android Geofence Entry Event' : 'Web Geolocation Check-In (Biometric Face Verified)'
        }
      ],
      faceVerification: faceVerificationData || {
        checkInVerified: false,
        checkInVerificationReference: null,
        similarityScore: null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Check-in successful! Welcome to work.',
      attendance: {
        id: attendanceRecord._id,
        workplaceId: attendanceRecord.workplaceId,
        employeeId: attendanceRecord.employeeId,
        attendanceDate: attendanceRecord.attendanceDate,
        checkInTime: attendanceRecord.checkIn.timestamp,
        distanceToCenter: attendanceRecord.checkIn.distanceToCenter,
        status: attendanceRecord.status,
        faceVerified: Boolean(faceVerificationData?.checkInVerified),
        similarityScore: faceVerificationData?.similarityScore || null
      }
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ success: false, error: 'Internal error processing check-in.' });
  }
}

/**
 * Handle Geofence Exit / Check-Out event
 */
async function checkOut(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { deviceId, latitude, longitude, accuracy = 10, isNativeEvent = false, verificationReference } = req.body;

    // 0. Mandatory Biometric Face Verification for Manual Check-Out
    let faceVerificationData = null;
    if (!isNativeEvent) {
      if (!verificationReference) {
        return res.status(403).json({
          success: false,
          error: 'Biometric face verification is required before check-out. Please complete your face scan.',
          requiresFaceVerification: true
        });
      }

      const tokenCheck = dbBridge.consumeVerificationToken(verificationReference, employeeId);
      if (!tokenCheck.valid) {
        return res.status(403).json({
          success: false,
          error: `Face verification invalid: ${tokenCheck.reason}`,
          requiresFaceVerification: true
        });
      }

      faceVerificationData = {
        checkOutVerified: true,
        checkOutVerificationReference: verificationReference,
        similarityScore: tokenCheck.token.similarityScore
      };
    }

    const boundDevice = await dbBridge.findDevice({ employeeId, isBound: true });
    if (!boundDevice || (deviceId && boundDevice.deviceId !== deviceId)) {
      return res.status(403).json({
        success: false,
        error: 'Check-out rejected. Device binding mismatch.'
      });
    }

    const activeSession = await dbBridge.findActiveAttendance(employeeId);
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        error: 'No active check-in session found to check out from.'
      });
    }

    const checkOutTime = new Date();
    const lat = latitude !== undefined ? Number(latitude) : activeSession.checkIn.latitude;
    const lon = longitude !== undefined ? Number(longitude) : activeSession.checkIn.longitude;
    const gpsAccuracy = Number(accuracy) || 10;

    let distanceToCenter = 0;
    if (activeSession.geofenceCenter && activeSession.geofenceCenter.latitude) {
      distanceToCenter = calculateDistance(
        lat,
        lon,
        activeSession.geofenceCenter.latitude,
        activeSession.geofenceCenter.longitude
      );
    }

    const checkInMs = new Date(activeSession.checkIn.timestamp).getTime();
    const checkOutMs = checkOutTime.getTime();
    const durationMinutes = Math.max(0, Math.round((checkOutMs - checkInMs) / (1000 * 60)));

    // Machine Learning and Hard Rule Assessment against employee's workplace shift
    const assessment = await mlService.assessAttendanceRecord({
      checkInTime: activeSession.checkIn.timestamp,
      checkOutTime,
      durationMinutes,
      distanceFromCenter: distanceToCenter,
      workplaceId: activeSession.workplaceId
    });

    const updates = {
      checkOut: {
        timestamp: checkOutTime,
        latitude: lat,
        longitude: lon,
        accuracy: gpsAccuracy,
        distanceToCenter
      },
      durationMinutes,
      status: 'completed',
      anomaly: {
        isAnomaly: assessment.isAnomaly,
        score: assessment.score,
        mlScore: assessment.mlScore,
        mlPrediction: assessment.mlPrediction,
        detectionSource: assessment.detectionSource,
        hardRuleViolations: assessment.hardRuleViolations,
        features: assessment.features,
        reviewStatus: assessment.reviewStatus,
        explanation: assessment.explanation,
        assessedAt: assessment.assessedAt
      },
      faceVerification: {
        ...(activeSession.faceVerification || {}),
        checkOutVerified: Boolean(faceVerificationData?.checkOutVerified),
        checkOutVerificationReference: faceVerificationData?.checkOutVerificationReference || null,
        checkOutSimilarityScore: faceVerificationData?.similarityScore || null
      }
    };

    const updated = await dbBridge.updateAttendanceRecord(activeSession._id, updates);

    return res.status(200).json({
      success: true,
      message: 'Check-out successfully recorded.',
      attendance: {
        id: updated._id,
        workplaceId: updated.workplaceId,
        employeeId: updated.employeeId,
        attendanceDate: updated.attendanceDate,
        checkInTime: updated.checkIn.timestamp,
        checkOutTime: updated.checkOut.timestamp,
        durationMinutes: updated.durationMinutes,
        status: updated.status,
        faceVerified: Boolean(faceVerificationData?.checkOutVerified),
        similarityScore: faceVerificationData?.similarityScore || null,
        anomaly: {
          isAnomaly: updated.anomaly.isAnomaly,
          detectionSource: updated.anomaly.detectionSource,
          explanation: updated.anomaly.explanation
        }
      }
    });
  } catch (err) {
    console.error('Check-out error:', err);
    return res.status(500).json({ success: false, error: 'Internal error processing check-out.' });
  }
}

/**
 * Retrieve current attendance, workplace & geofence status
 */
async function getCurrentStatus(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const workplaceId = req.workplaceId;

    const activeSession = await dbBridge.findActiveAttendance(employeeId);
    const geofence = workplaceId ? await dbBridge.findGeofence(workplaceId, employeeId) : null;
    const shiftSchedule = workplaceId ? await dbBridge.getCompanyShift(workplaceId) : null;
    const boundDevice = await dbBridge.findDevice({ employeeId, isBound: true });
    const workplace = workplaceId ? await dbBridge.findWorkplaceById(workplaceId) : null;

    return res.status(200).json({
      success: true,
      isCheckedIn: !!activeSession,
      activeSession: activeSession || null,
      workplaceId: workplaceId || null,
      workplace: workplace
        ? {
            workplaceId: workplace.workplaceId,
            name: workplace.name,
            organizationName: workplace.organizationName,
            category: workplace.category,
            city: workplace.address?.city
          }
        : null,
      membershipStatus: req.membership ? req.membership.status : 'unassigned',
      geofence: geofence || null,
      shiftSchedule: shiftSchedule || null,
      isDeviceBound: !!boundDevice,
      boundDeviceId: boundDevice ? boundDevice.deviceId : null
    });
  } catch (err) {
    console.error('Get status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve attendance status.' });
  }
}

/**
 * Get employee attendance history (strictly scoped to requesting employee)
 */
async function getHistory(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { employeeId };
    if (startDate && endDate) {
      filter.attendanceDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.attendanceDate = { $gte: startDate };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { records, total } = await dbBridge.queryAttendance(filter, skip, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      records
    });
  } catch (err) {
    console.error('Get history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve attendance history.' });
  }
}

/**
 * Get geofence configuration for user's assigned workplace
 */
async function getGeofence(req, res) {
  try {
    const workplaceId = req.workplaceId;
    if (!workplaceId) {
      return res.status(404).json({ success: false, error: 'No workplace assigned.' });
    }

    const employeeIdParam = req.params.employeeId;
    const targetEmployeeId = employeeIdParam && employeeIdParam !== 'ALL'
      ? employeeIdParam.toUpperCase()
      : (req.user.role === 'employee' ? req.user.employeeId : null);

    let geofence = await dbBridge.findGeofence(workplaceId, targetEmployeeId);
    if (!geofence) {
      // Fallback to workplace-wide geofence
      geofence = await dbBridge.findGeofence(workplaceId, null);
    }
    if (!geofence) {
      geofence = {
        workplaceId,
        center: { latitude: 12.9715987, longitude: 77.5945627 },
        radius: 50,
        locationName: 'Designated Office Site'
      };
    }

    return res.status(200).json({
      success: true,
      geofence
    });
  } catch (err) {
    console.error('Get geofence error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get geofence.' });
  }
}

/**
 * Update workplace geofence center and radius (Workplace Admin only)
 * If employeeId param is specified (and not 'ALL'), updates that specific employee's geofence.
 * Otherwise updates workplace-wide geofence.
 */
async function updateGeofence(req, res) {
  try {
    const workplaceId = req.workplaceId;
    if (!workplaceId) {
      return res.status(403).json({ success: false, error: 'Unauthorized. No workplace assigned.' });
    }

    const { latitude, longitude, locationName, radius } = req.body;
    const targetEmployeeId = req.params.employeeId && req.params.employeeId !== 'ALL'
      ? req.params.employeeId.toUpperCase()
      : null;

    const lat = Number(latitude);
    const lon = Number(longitude);
    const rad = radius !== undefined && !isNaN(Number(radius)) && Number(radius) > 0 ? Math.round(Number(radius)) : 50;

    if (!isValidCoordinates(lat, lon)) {
      return res.status(400).json({ success: false, error: 'Invalid latitude or longitude.' });
    }

    let updated;
    if (targetEmployeeId) {
      // Update specific employee's geofence
      updated = await dbBridge.upsertGeofence(workplaceId, targetEmployeeId, {
        center: { latitude: lat, longitude: lon },
        radius: rad,
        locationName: locationName || 'Designated Office Site',
        configuredBy: req.user.employeeId,
        isActive: true
      });

      await dbBridge.logAudit({
        action: 'EMPLOYEE_GEOFENCE_UPDATED',
        performedBy: req.user.employeeId,
        targetEmployeeId,
        workplaceId,
        entityType: 'geofence',
        entityId: String(updated._id),
        details: { latitude: lat, longitude: lon, radius: rad }
      });

      return res.status(200).json({
        success: true,
        message: `Geofence for employee ${targetEmployeeId} updated to ${rad}m radius around [${lat.toFixed(6)}, ${lon.toFixed(6)}].`,
        geofence: updated
      });
    }

    // Update Workplace record
    await dbBridge.updateWorkplace(workplaceId, {
      geofence: {
        center: { latitude: lat, longitude: lon },
        radius: rad,
        locationName: locationName || 'Designated Office Site'
      }
    });

    // Update Workplace-wide Geofence record
    updated = await dbBridge.upsertGeofence(workplaceId, null, {
      center: { latitude: lat, longitude: lon },
      radius: rad,
      locationName: locationName || 'Designated Office Site',
      configuredBy: req.user.employeeId,
      isActive: true
    });

    await dbBridge.logAudit({
      action: 'GEOFENCE_UPDATED',
      performedBy: req.user.employeeId,
      workplaceId,
      entityType: 'geofence',
      entityId: String(updated._id),
      details: { latitude: lat, longitude: lon, radius: rad }
    });

    return res.status(200).json({
      success: true,
      message: `Workplace geofence updated to ${rad}m radius around [${lat.toFixed(6)}, ${lon.toFixed(6)}].`,
      geofence: updated
    });
  } catch (err) {
    console.error('Update geofence error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update geofence.' });
  }
}

/**
 * Retrieve workplace shift schedule
 */
async function getShiftSchedule(req, res) {
  try {
    const workplaceId = req.workplaceId;
    const schedule = await dbBridge.getCompanyShift(workplaceId);
    return res.status(200).json({ success: true, schedule });
  } catch (err) {
    console.error('Get shift schedule error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get shift schedule.' });
  }
}

/**
 * Update workplace shift schedule (Workplace Admin only)
 */
async function updateShiftSchedule(req, res) {
  try {
    const workplaceId = req.workplaceId;
    if (!workplaceId) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }

    const { shiftStart, shiftEnd, gracePeriodMinutes, timezone } = req.body;

    const data = {
      shiftStart: shiftStart || '09:00',
      shiftEnd: shiftEnd || '18:00',
      gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
      timezone: timezone || 'Asia/Kolkata'
    };

    const updated = await dbBridge.updateCompanyShift(workplaceId, data);

    await dbBridge.logAudit({
      action: 'SHIFT_SCHEDULE_UPDATED',
      performedBy: req.user.employeeId,
      workplaceId,
      entityType: 'shift',
      entityId: workplaceId,
      details: data
    });

    return res.status(200).json({
      success: true,
      message: `Workplace shift schedule updated (${data.shiftStart} - ${data.shiftEnd}).`,
      schedule: updated
    });
  } catch (err) {
    console.error('Update shift schedule error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update shift schedule.' });
  }
}

module.exports = {
  checkIn,
  checkOut,
  getCurrentStatus,
  getHistory,
  getGeofence,
  updateGeofence,
  getShiftSchedule,
  updateShiftSchedule
};
