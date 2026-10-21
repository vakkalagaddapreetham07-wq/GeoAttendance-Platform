const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, requireRole, attachTenantContext } = require('../middleware/auth');

// All attendance routes require valid JWT authentication and tenant context
router.use(verifyToken);
router.use(attachTenantContext);

// Employee attendance operations
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/status', attendanceController.getCurrentStatus);
router.get('/history', attendanceController.getHistory);

// Geofence operations
router.get('/geofence', attendanceController.getGeofence);
router.get('/geofence/:employeeId', requireRole('admin', 'superadmin'), attendanceController.getGeofence);
router.put('/geofence', requireRole('admin', 'superadmin'), attendanceController.updateGeofence);
router.put('/geofence/:employeeId', requireRole('admin', 'superadmin'), attendanceController.updateGeofence);

// Shift schedule
router.get('/shift-schedule', attendanceController.getShiftSchedule);
router.put('/shift-schedule', requireRole('admin', 'superadmin'), attendanceController.updateShiftSchedule);

module.exports = router;
