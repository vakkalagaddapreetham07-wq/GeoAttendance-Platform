const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { verifyToken, requireRole, attachTenantContext } = require('../middleware/auth');

router.use(verifyToken);
router.use(attachTenantContext);

// Employee leave endpoints
router.post('/apply', leaveController.submitLeave);
router.get('/my-leaves', leaveController.getMyLeaves);

// Administrator leave review endpoints
router.get('/pending', requireRole('admin', 'superadmin'), leaveController.getPendingLeaves);
router.get('/all', requireRole('admin', 'superadmin'), leaveController.getAllLeaves);
router.put('/approve/:id', requireRole('admin', 'superadmin'), leaveController.approveLeave);
router.put('/reject/:id', requireRole('admin', 'superadmin'), leaveController.rejectLeave);

module.exports = router;
