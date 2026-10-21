const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken, requireRole, attachTenantContext } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole('admin', 'superadmin'));
router.use(attachTenantContext);

// Admin Analytics Dashboard
router.get('/dashboard-summary', analyticsController.getDashboardSummary);
router.get('/attendance-records', analyticsController.getAttendanceRecords);

// Anomaly Management
router.get('/anomalies', analyticsController.getAnomalyRecords);
router.put('/anomalies/:id/review', analyticsController.reviewAnomaly);

// Shift Schedule Management
router.get('/shift-schedule', analyticsController.getShiftSchedule);
router.put('/shift-schedule', analyticsController.updateShiftSchedule);

module.exports = router;
