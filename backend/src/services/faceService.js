const crypto = require('crypto');
const dbBridge = require('./dbBridge');
const { encryptEmbedding, decryptEmbedding } = require('../utils/biometricCrypto');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

/**
 * Call Python Face Recognition microservice
 */
async function callFaceService(endpoint, body) {
  const url = `${ML_SERVICE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[FaceService] Error connecting to ML service at ${url}:`, err.message);
    throw new Error(`Face verification engine unavailable: ${err.message}`);
  }
}

/**
 * Enroll a face: extract embedding, encrypt, and store in database
 */
async function enrollEmployeeFace({ employeeId, workplaceId, imageData, consentGiven, consentStatement, clientIp, userAgent }) {
  if (!consentGiven) {
    throw new Error('Explicit consent is required for biometric face enrollment.');
  }

  // 1. Process image through face engine
  const result = await callFaceService('/face/detect-and-embed', { image: imageData });
  if (!result.success) {
    const errorMsg = result.error || 'Face enrollment failed. Please ensure a clear, well-lit photo with only one face.';
    throw new Error(errorMsg);
  }

  const { embedding, quality, face_box, model_info } = result;

  // 2. Encrypt embedding with AES-256-GCM (Security requirement: never store plaintext biometric vectors)
  const protectedEmbedding = encryptEmbedding(embedding);

  // 3. Upsert face enrollment record
  const enrollmentData = {
    employeeId,
    workplaceId,
    enrollmentStatus: 'enrolled',
    protectedEmbedding,
    modelName: model_info?.name || 'opencv_sface_yunet',
    modelVersion: model_info?.version || '1.0.0',
    consentGiven: true,
    consentVersion: 'v1.0',
    consentTimestamp: new Date(),
    consentStatement: consentStatement || 'I consent to biometric face verification solely for work attendance identity validation and fraud prevention.',
    qualityMetrics: {
      sharpness: quality?.sharpness || 0,
      brightness: quality?.brightness || 0,
      confidence: 0.99
    },
    auditLog: [
      {
        action: 'enrolled',
        timestamp: new Date(),
        similarityScore: 1.0,
        ip: clientIp,
        userAgent,
        details: 'Initial biometric enrollment during onboarding.'
      }
    ]
  };

  const existing = await dbBridge.findFaceEnrollment({ employeeId });
  let saved;
  if (existing) {
    saved = await dbBridge.updateFaceEnrollment({ employeeId }, enrollmentData);
  } else {
    saved = await dbBridge.createFaceEnrollment(enrollmentData);
  }

  return {
    success: true,
    message: 'Face enrolled successfully.',
    enrollmentStatus: 'enrolled',
    modelName: enrollmentData.modelName,
    quality
  };
}

/**
 * Verify a face capture against the enrolled employee template.
 * If match passes empirical threshold, issues a short-lived one-time verification reference.
 */
async function verifyEmployeeFace({ employeeId, workplaceId, imageData, clientIp, userAgent }) {
  // 1. Fetch employee's enrolled biometric record
  const enrollment = await dbBridge.findFaceEnrollment({ employeeId });
  if (!enrollment || enrollment.enrollmentStatus !== 'enrolled') {
    return {
      success: false,
      verified: false,
      isEnrolled: false,
      error: 'No active face enrollment found for this employee. Please complete face registration first.'
    };
  }

  // 2. Multi-workplace tenant check: prevent cross-workplace matching
  if (workplaceId && enrollment.workplaceId && enrollment.workplaceId !== workplaceId) {
    return {
      success: false,
      verified: false,
      error: 'Workplace mismatch. Biometric template is bound to another workplace.'
    };
  }

  // 3. Decrypt stored embedding
  let enrolledEmbedding;
  try {
    enrolledEmbedding = decryptEmbedding(enrollment.protectedEmbedding);
  } catch (err) {
    console.error('[FaceService] Decryption error:', err.message);
    throw new Error('Failed to decrypt stored biometric template.');
  }

  // 4. Send to face verification microservice
  const result = await callFaceService('/face/verify', {
    image: imageData,
    enrolled_embedding: enrolledEmbedding
  });

  if (!result.success) {
    return {
      success: false,
      verified: false,
      error: result.error || 'Face verification failed during image processing.'
    };
  }

  const { verified, similarity, distance, threshold, quality, liveness } = result;

  // 5. Update audit trail
  const auditEntry = {
    action: verified ? 'verified' : 'verify_failed',
    timestamp: new Date(),
    similarityScore: similarity,
    ip: clientIp,
    userAgent,
    details: verified
      ? `Biometric match confirmed (Score: ${similarity}, Threshold: ${threshold})`
      : `Biometric mismatch rejected (Score: ${similarity}, Required: >= ${threshold})`
  };

  if (Array.isArray(enrollment.auditLog)) {
    enrollment.auditLog.push(auditEntry);
  }
  await dbBridge.updateFaceEnrollment({ employeeId }, { auditLog: enrollment.auditLog });

  // 6. If verified, issue a single-use 120-second verification reference token
  if (verified) {
    const referenceId = `VREF_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = Date.now() + 120 * 1000; // 2 minutes TTL

    dbBridge.saveVerificationToken({
      referenceId,
      employeeId,
      workplaceId: enrollment.workplaceId,
      expiresAt,
      similarityScore: similarity
    });

    return {
      success: true,
      verified: true,
      verificationReference: referenceId,
      similarityScore: similarity,
      distance,
      threshold,
      expiresInSeconds: 120,
      quality,
      liveness
    };
  }

  return {
    success: false,
    verified: false,
    similarityScore: similarity,
    threshold,
    error: `Face verification failed: Biometric match score (${similarity}) is below required threshold (${threshold}). Buddy-punching or impostor attempt detected.`
  };
}

module.exports = {
  enrollEmployeeFace,
  verifyEmployeeFace
};
