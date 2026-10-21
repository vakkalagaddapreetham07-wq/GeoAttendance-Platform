const jwt = require('jsonwebtoken');
const dbBridge = require('../services/dbBridge');

const JWT_SECRET = process.env.JWT_SECRET || 'geofence_secret_key_development_2026';

/**
 * Middleware to verify JWT token and attach user to req
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing or malformed token.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await dbBridge.findUser({ employeeId: decoded.employeeId });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or session invalid.'
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended or inactive.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
}

/**
 * Role-based authorization middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of [${roles.join(', ')}] role.`
      });
    }

    next();
  };
}

/**
 * Platform Administrator Guard
 */
function requirePlatformAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Platform Administrator privileges required.'
    });
  }
  next();
}

/**
 * Attach Tenant / Workplace Context to Request
 * Server-side derived identity - client cannot spoof or override.
 */
async function attachTenantContext(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    // 1. Platform SuperAdmin
    if (req.user.role === 'superadmin') {
      req.isPlatformAdmin = true;
      req.workplaceId = req.query.workplaceId || req.body.workplaceId || null;
      return next();
    }

    // 2. Workplace Administrator
    if (req.user.role === 'admin') {
      let workplace = null;
      if (req.user.assignedWorkplaceId) {
        workplace = await dbBridge.findWorkplaceById(req.user.assignedWorkplaceId);
      }
      if (!workplace) {
        workplace = await dbBridge.findWorkplace({ adminEmployeeId: req.user.employeeId });
      }

      if (!workplace) {
        return res.status(403).json({
          success: false,
          error: 'No active workplace associated with your administrator account.'
        });
      }

      if (workplace.verificationStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'This workplace has been suspended by the platform administrator.'
        });
      }

      req.workplace = workplace;
      req.workplaceId = workplace.workplaceId;
      return next();
    }

    // 3. Employee
    if (req.user.role === 'employee') {
      const activeMembership = await dbBridge.findActiveMembership(req.user.employeeId);
      if (activeMembership) {
        const workplace = await dbBridge.findWorkplaceById(activeMembership.workplaceId);
        if (workplace?.verificationStatus === 'suspended') {
          return res.status(403).json({
            success: false,
            error: 'Your workplace is currently suspended by platform administration.'
          });
        }
        req.membership = activeMembership;
        req.workplaceId = activeMembership.workplaceId;
        req.workplace = workplace;
      } else {
        req.membership = null;
        req.workplaceId = null;
        req.workplace = null;
      }
      return next();
    }

    next();
  } catch (err) {
    console.error('attachTenantContext error:', err);
    return res.status(500).json({ success: false, error: 'Internal error resolving tenant context.' });
  }
}

/**
 * Enforce that the user is an active Workplace Administrator with an approved workplace
 */
function requireWorkplaceAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin' || !req.workplaceId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You must be an authorized Workplace Administrator.'
    });
  }
  next();
}

/**
 * Enforce that employee has an approved, active workplace membership
 */
function requireApprovedMembership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  // Admins and superadmins bypass employee membership check
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }

  if (!req.membership || req.membership.status !== 'approved') {
    return res.status(403).json({
      success: false,
      error: 'Active workplace membership required. Your membership request is either pending or not approved.',
      requiresWorkplaceSelection: !req.membership
    });
  }

  next();
}

module.exports = {
  verifyToken,
  requireRole,
  requirePlatformAdmin,
  attachTenantContext,
  requireWorkplaceAdmin,
  requireApprovedMembership,
  JWT_SECRET
};
