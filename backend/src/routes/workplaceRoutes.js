const express = require('express');
const router = express.Router();
const workplaceController = require('../controllers/workplaceController');
const {
  verifyToken,
  requireRole,
  attachTenantContext,
  requireWorkplaceAdmin,
  requirePlatformAdmin
} = require('../middleware/auth');

// 1. Public Routes
router.post('/register', workplaceController.registerWorkplace);
router.get('/public', workplaceController.getPublicWorkplaces);

// 2. Workplace Administrator Routes
router.get(
  '/my-workplace',
  verifyToken,
  attachTenantContext,
  requireWorkplaceAdmin,
  workplaceController.getMyWorkplace
);

router.put(
  '/my-workplace',
  verifyToken,
  attachTenantContext,
  requireWorkplaceAdmin,
  workplaceController.updateMyWorkplace
);

router.post(
  '/admin-replacement',
  verifyToken,
  attachTenantContext,
  requireWorkplaceAdmin,
  workplaceController.requestAdminReplacement
);

// 3. Platform Administrator Routes
router.get(
  '/platform/all',
  verifyToken,
  requirePlatformAdmin,
  workplaceController.getPlatformAllWorkplaces
);

router.put(
  '/platform/:id/review',
  verifyToken,
  requirePlatformAdmin,
  workplaceController.reviewPlatformWorkplace
);

router.get(
  '/platform/dashboard-summary',
  verifyToken,
  requirePlatformAdmin,
  workplaceController.getPlatformDashboardSummary
);

module.exports = router;
