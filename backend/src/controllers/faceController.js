const bcrypt = require('bcryptjs');
const dbBridge = require('../services/dbBridge');
const faceService = require('../services/faceService');

/**
 * Check Face Enrollment Status for authenticated user
 * GET /api/face/status
 */
async function getFaceStatus(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const enrollment = await dbBridge.findFaceEnrollment({ employeeId });

    if (!enrollment || enrollment.enrollmentStatus !== 'enrolled') {
      return res.status(200).json({
        success: true,
        isEnrolled: false,
        message: 'No face enrolled for this account.'
      });
    }

    return res.status(200).json({
      success: true,
      isEnrolled: true,
      enrollmentStatus: enrollment.enrollmentStatus,
      enrolledAt: enrollment.createdAt,
      modelName: enrollment.modelName,
      modelVersion: enrollment.modelVersion,
      consentVersion: enrollment.consentVersion,
      consentTimestamp: enrollment.consentTimestamp,
      qualityMetrics: enrollment.qualityMetrics
    });
  } catch (err) {
    console.error('[FaceController] getFaceStatus error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve face enrollment status: ' + err.message
    });
  }
}

/**
 * Enroll Employee Face
 * POST /api/face/enroll
 */
async function enrollFace(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const workplaceId = req.workplaceId || req.user.assignedWorkplaceId;
    const { image, consentGiven, consentStatement } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Camera frame image is required for biometric face enrollment.'
      });
    }

    if (!consentGiven) {
      return res.status(400).json({
        success: false,
        error: 'Explicit employee consent is legally required before recording biometric facial data.'
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await faceService.enrollEmployeeFace({
      employeeId,
      workplaceId,
      imageData: image,
      consentGiven: Boolean(consentGiven),
      consentStatement,
      clientIp,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Face biometric template successfully enrolled and encrypted.',
      ...result
    });
  } catch (err) {
    console.error('[FaceController] enrollFace error:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message || 'Face enrollment failed.'
    });
  }
}

/**
 * Verify Employee Face before Attendance Check-In / Check-Out
 * POST /api/face/verify
 * Returns short-lived single-use verificationReference token upon match
 */
async function verifyFace(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const workplaceId = req.workplaceId || req.user.assignedWorkplaceId;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Camera face capture is required for biometric verification.'
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await faceService.verifyEmployeeFace({
      employeeId,
      workplaceId,
      imageData: image,
      clientIp,
      userAgent
    });

    if (!result.success || !result.verified) {
      return res.status(401).json({
        success: false,
        verified: false,
        isEnrolled: result.isEnrolled !== undefined ? result.isEnrolled : true,
        error: result.error || 'Biometric verification failed. Face does not match registered employee template.'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      verificationReference: result.verificationReference,
      similarityScore: result.similarityScore,
      expiresInSeconds: result.expiresInSeconds,
      liveness: result.liveness,
      message: 'Face verified successfully. You may now submit your attendance check-in/out.'
    });
  } catch (err) {
    console.error('[FaceController] verifyFace error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Face verification error: ' + err.message
    });
  }
}

/**
 * Re-enroll employee face (requires password authentication)
 * POST /api/face/re-enroll
 */
async function reEnrollFace(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const workplaceId = req.workplaceId || req.user.assignedWorkplaceId;
    const { password, image, consentGiven, consentStatement } = req.body;

    if (!password) {
      return res.status(401).json({
        success: false,
        error: 'Account password confirmation is required to update biometric enrollment.'
      });
    }

    // Verify password
    const user = await dbBridge.findUser({ employeeId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Re-enrollment rejected.' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await faceService.enrollEmployeeFace({
      employeeId,
      workplaceId,
      imageData: image,
      consentGiven: Boolean(consentGiven),
      consentStatement,
      clientIp,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Face biometric template re-enrolled successfully.',
      ...result
    });
  } catch (err) {
    console.error('[FaceController] reEnrollFace error:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message || 'Re-enrollment failed.'
    });
  }
}

/**
 * Revoke and Delete biometric enrollment
 * DELETE /api/face/enrollment
 */
async function deleteEnrollment(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { password } = req.body;

    if (!password) {
      return res.status(401).json({
        success: false,
        error: 'Password confirmation required to permanently delete biometric enrollment.'
      });
    }

    const user = await dbBridge.findUser({ employeeId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Revocation rejected.' });
    }

    await dbBridge.deleteFaceEnrollment({ employeeId });

    return res.status(200).json({
      success: true,
      message: 'Biometric face enrollment permanently revoked and deleted.'
    });
  } catch (err) {
    console.error('[FaceController] deleteEnrollment error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Revocation failed: ' + err.message
    });
  }
}

module.exports = {
  getFaceStatus,
  enrollFace,
  verifyFace,
  reEnrollFace,
  deleteEnrollment
};
