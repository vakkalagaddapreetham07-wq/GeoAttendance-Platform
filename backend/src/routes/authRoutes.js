const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { loginRateLimiter, otpRateLimiter } = require('../middleware/rateLimiter');

// Public authentication & registration routes
router.post('/login', loginRateLimiter, authController.login);
router.post('/firebase-login', authController.firebaseLogin);
router.post('/register', authController.register); // Allowed for employee onboarding / setup
router.post('/registration-otp/send', authController.sendRegistrationOtp);
router.post('/registration-otp/verify', authController.verifyRegistrationOtp);

// Gmail & Email Mobile Verification Routes
router.post('/registration-email/send', authController.sendRegistrationEmail);
router.get('/verify-email', authController.verifyEmailLink);
router.post('/registration-email/verify-code', authController.verifyEmailCode);
router.get('/registration-email/status', authController.checkEmailVerificationStatus);

// OTP-based device registration routes
router.post('/request-otp', otpRateLimiter, authController.requestOtp);
router.post('/verify-otp-device', authController.verifyOtpAndBindDevice);

// Protected routes
router.get('/me', verifyToken, authController.getMe);
router.post('/logout', verifyToken, authController.logout);
router.get('/device-binding', verifyToken, authController.getDeviceBinding);
router.get('/device-binding/:employeeId', verifyToken, requireRole('admin'), authController.getDeviceBinding);

module.exports = router;
