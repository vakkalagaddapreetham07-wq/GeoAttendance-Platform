const express = require('express');
const router = express.Router();
const faceController = require('../controllers/faceController');
const { verifyToken, attachTenantContext } = require('../middleware/auth');

// All face routes require authentication and tenant context
router.use(verifyToken);
router.use(attachTenantContext);

// GET /api/face/status - Check if authenticated employee has enrolled their face
router.get('/status', faceController.getFaceStatus);

// POST /api/face/enroll - Initial Face Enrollment with explicit consent
router.post('/enroll', faceController.enrollFace);

// POST /api/face/verify - Face Verification before Attendance check-in / check-out
router.post('/verify', faceController.verifyFace);

// POST /api/face/re-enroll - Re-enroll biometric template (password required)
router.post('/re-enroll', faceController.reEnrollFace);

// DELETE /api/face/enrollment - Revoke and delete biometric template (password required)
router.delete('/enrollment', faceController.deleteEnrollment);

module.exports = router;
