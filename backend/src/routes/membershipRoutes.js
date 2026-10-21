const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const {
  verifyToken,
  attachTenantContext,
  requireWorkplaceAdmin
} = require('../middleware/auth');

// All membership routes require valid authentication
router.use(verifyToken);

// Employee routes
router.post('/request', membershipController.requestMembership);
router.get('/my-status', membershipController.getMyMembershipStatus);

// Workplace Administrator routes (protected by attachTenantContext & requireWorkplaceAdmin)
router.get(
  '/pending',
  attachTenantContext,
  requireWorkplaceAdmin,
  membershipController.getPendingMemberships
);

router.get(
  '/members',
  attachTenantContext,
  requireWorkplaceAdmin,
  membershipController.getWorkplaceMembers
);

router.put(
  '/:id/approve',
  attachTenantContext,
  requireWorkplaceAdmin,
  membershipController.approveMembership
);

router.put(
  '/:id/reject',
  attachTenantContext,
  requireWorkplaceAdmin,
  membershipController.rejectMembership
);

router.put(
  '/:id/status',
  attachTenantContext,
  requireWorkplaceAdmin,
  membershipController.updateMemberStatus
);

module.exports = router;
