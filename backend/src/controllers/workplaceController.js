const bcrypt = require('bcryptjs');
const dbBridge = require('../services/dbBridge');
const { isValidCoordinates } = require('../utils/geofence');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * Register a new Workplace (Public Endpoint)
 * Enforces: One active administrator per workplace.
 */
async function registerWorkplace(req, res) {
  try {
    const wpName = req.body.name || req.body.workplaceName;
    const orgName = req.body.organizationName;
    const category = req.body.category || 'corporate';
    const street = req.body.address?.street || req.body.street || '';
    const city = req.body.address?.city || req.body.city || '';
    const state = req.body.address?.state || req.body.state || '';
    const region = req.body.address?.region || req.body.region || '';
    const country = req.body.address?.country || req.body.country || 'India';
    const postalCode = req.body.address?.postalCode || req.body.postalCode || '';
    const contactEmail = req.body.contactEmail || req.body.admin?.email;
    const contactPhone = req.body.contactPhone || req.body.admin?.mobileNumber;

    const adminName = req.body.admin?.name || req.body.adminName;
    const adminEmail = req.body.admin?.email || req.body.adminEmail;
    const adminPassword = req.body.admin?.password || req.body.adminPassword;
    const adminPhone = req.body.admin?.mobileNumber || req.body.adminPhone;
    const customAdminEmployeeId = req.body.admin?.employeeId || req.body.adminEmployeeId;

    const lat = Number(req.body.geofence?.center?.latitude ?? req.body.latitude);
    const lon = Number(req.body.geofence?.center?.longitude ?? req.body.longitude);
    const rad = Number(req.body.geofence?.radius ?? req.body.radius ?? 50) || 50;
    const locationName = req.body.geofence?.locationName || req.body.locationName || wpName;

    const shiftStart = req.body.shiftSchedule?.shiftStart || req.body.shiftStart || '09:00';
    const shiftEnd = req.body.shiftSchedule?.shiftEnd || req.body.shiftEnd || '18:00';
    const gracePeriodMinutes = Number(req.body.shiftSchedule?.gracePeriodMinutes ?? req.body.gracePeriodMinutes ?? 15);
    const timezone = req.body.shiftSchedule?.timezone || req.body.timezone || 'Asia/Kolkata';

    // 1. Validate required fields
    if (
      !wpName?.trim() ||
      !orgName?.trim() ||
      !city?.trim() ||
      !contactEmail?.trim() ||
      !adminName?.trim() ||
      !adminEmail?.trim() ||
      !adminPassword
    ) {
      return res.status(400).json({
        success: false,
        error: 'Workplace name, organization, city, contact email, and admin details are required.'
      });
    }

    if (!isValidCoordinates(lat, lon)) {
      return res.status(400).json({
        success: false,
        error: 'Valid workplace geofence latitude and longitude coordinates are required.'
      });
    }

    // 2. Check if admin email or employee already exists
    const cleanAdminEmail = adminEmail.trim().toLowerCase();
    const existingUser = await dbBridge.findUser({ email: cleanAdminEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this administrator email already exists. Please log in or use a different email.'
      });
    }

    // Generate unique Workplace ID and Admin Employee ID
    const wpSlug = wpName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    const workplaceId = `WP_${wpSlug}_${Date.now().toString().slice(-4)}`;
    const adminEmployeeId = customAdminEmployeeId || `ADM_${Date.now().toString().slice(-6)}`;

    // 3. Create Administrator User Account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const newAdmin = await dbBridge.createUser({
      employeeId: adminEmployeeId,
      name: adminName.trim(),
      email: cleanAdminEmail,
      passwordHash,
      role: 'admin',
      mobileNumber: adminPhone || contactPhone || '',
      isMobileVerified: true,
      assignedWorkplaceId: workplaceId,
      department: 'Workplace Administration',
      leaveBalance: { sick: 15, casual: 15, annual: 20 },
      accountStatus: 'active'
    });

    // 4. Create Workplace record
    const verificationStatus = req.body.verificationStatus || 'pending';
    const newWorkplace = await dbBridge.createWorkplace({
      workplaceId,
      name: wpName.trim(),
      organizationName: orgName.trim(),
      category: category || 'corporate',
      address: {
        street: street || '',
        city: city.trim(),
        region: region || '',
        state: state.trim() || 'State',
        country,
        postalCode: postalCode || ''
      },
      contactEmail: contactEmail.trim().toLowerCase(),
      contactPhone: contactPhone || adminPhone || '',
      adminEmployeeId: newAdmin.employeeId,
      adminName: newAdmin.name,
      verificationStatus,
      verificationNote: 'Self-registered organization. Awaiting platform compliance review.',
      geofence: {
        center: { latitude: lat, longitude: lon },
        radius: rad,
        locationName: locationName || 'Designated Office Site'
      },
      shiftSchedule: {
        shiftStart,
        shiftEnd,
        gracePeriodMinutes,
        timezone
      },
      isActive: true
    });

    // 5. Create workplace geofence record
    await dbBridge.upsertGeofence(workplaceId, null, {
      center: { latitude: lat, longitude: lon },
      radius: rad,
      locationName: locationName || `${wpName.trim()} Main Site`,
      configuredBy: newAdmin.employeeId,
      isActive: true
    });

    // 6. Audit log
    await dbBridge.logAudit({
      action: 'WORKPLACE_REGISTERED',
      performedBy: newAdmin.employeeId,
      targetEmployeeId: newAdmin.employeeId,
      workplaceId,
      entityType: 'workplace',
      entityId: workplaceId,
      details: { workplaceName: wpName, city, radius: rad }
    });

    // 7. Generate JWT Token
    const token = jwt.sign(
      {
        employeeId: newAdmin.employeeId,
        role: newAdmin.role,
        workplaceId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: `Workplace '${newWorkplace.name}' registered successfully! You are now the workplace administrator.`,
      token,
      workplace: newWorkplace,
      user: {
        employeeId: newAdmin.employeeId,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        assignedWorkplaceId: workplaceId
      }
    });
  } catch (err) {
    console.error('Workplace registration error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error registering workplace.' });
  }
}

/**
 * List Public Approved Workplaces for Employee Selection (Public Endpoint)
 * Never exposes private employee lists, attendance records, or private admin details.
 */
async function getPublicWorkplaces(req, res) {
  try {
    const { search, city, category, page = 1, limit = 50 } = req.query;

    const filter = {
      verificationStatus: 'approved',
      isActive: true
    };

    if (city) filter['address.city'] = city;
    if (category) filter.category = category;
    if (search) filter.search = search;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { workplaces, total } = await dbBridge.queryWorkplaces(filter, skip, parseInt(limit, 10));

    // Sanitize to only public information
    const sanitized = workplaces.map((w) => ({
      workplaceId: w.workplaceId,
      name: w.name,
      organizationName: w.organizationName,
      category: w.category,
      city: w.address?.city,
      state: w.address?.state,
      country: w.address?.country,
      contactEmail: w.contactEmail,
      contactPhone: w.contactPhone,
      geofence: {
        radius: w.geofence?.radius || 50,
        locationName: w.geofence?.locationName || w.name
      },
      shiftSchedule: {
        shiftStart: w.shiftSchedule?.shiftStart || '09:00',
        shiftEnd: w.shiftSchedule?.shiftEnd || '18:00',
        timezone: w.shiftSchedule?.timezone || 'Asia/Kolkata'
      }
    }));

    return res.status(200).json({
      success: true,
      total,
      workplaces: sanitized
    });
  } catch (err) {
    console.error('Get public workplaces error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve workplaces.' });
  }
}

/**
 * Get details of current authenticated administrator's workplace
 */
async function getMyWorkplace(req, res) {
  try {
    const workplace = req.workplace;
    if (!workplace) {
      return res.status(404).json({ success: false, error: 'No workplace found for current user.' });
    }

    const [activeMembersCount, pendingMembersCount] = await Promise.all([
      dbBridge.countMemberships({ workplaceId: workplace.workplaceId, status: 'approved' }),
      dbBridge.countMemberships({ workplaceId: workplace.workplaceId, status: 'pending' })
    ]);

    return res.status(200).json({
      success: true,
      workplace,
      stats: {
        activeMembersCount,
        pendingMembersCount
      }
    });
  } catch (err) {
    console.error('Get my workplace error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve workplace details.' });
  }
}

/**
 * Update authenticated administrator's workplace settings
 */
async function updateMyWorkplace(req, res) {
  try {
    const workplaceId = req.workplaceId;
    const { name, organizationName, category, street, city, state, postalCode, contactEmail, contactPhone } = req.body;

    const updates = {};
    if (name) updates.name = name.trim();
    if (organizationName) updates.organizationName = organizationName.trim();
    if (category) updates.category = category;
    if (contactEmail) updates.contactEmail = contactEmail.trim().toLowerCase();
    if (contactPhone) updates.contactPhone = contactPhone.trim();

    if (street !== undefined || city || state) {
      updates.address = {
        ...(req.workplace.address || {}),
        street: street !== undefined ? street : req.workplace.address?.street,
        city: city ? city.trim() : req.workplace.address?.city,
        state: state ? state.trim() : req.workplace.address?.state,
        postalCode: postalCode !== undefined ? postalCode : req.workplace.address?.postalCode
      };
    }

    const updated = await dbBridge.updateWorkplace(workplaceId, updates);

    await dbBridge.logAudit({
      action: 'WORKPLACE_SETTINGS_UPDATED',
      performedBy: req.user.employeeId,
      workplaceId,
      entityType: 'workplace',
      entityId: workplaceId,
      details: updates
    });

    return res.status(200).json({
      success: true,
      message: 'Workplace settings successfully updated.',
      workplace: updated
    });
  } catch (err) {
    console.error('Update workplace error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update workplace settings.' });
  }
}

/**
 * Request Administrator Replacement (Workplace Admin initiated)
 */
async function requestAdminReplacement(req, res) {
  try {
    const workplaceId = req.workplaceId;
    const { newAdminEmployeeId, newAdminName, newAdminEmail, reason } = req.body;

    if (!newAdminName || !newAdminEmail) {
      return res.status(400).json({ success: false, error: 'New administrator name and email are required.' });
    }

    const replacement = {
      hasPendingRequest: true,
      newAdminEmployeeId: newAdminEmployeeId || null,
      newAdminName: newAdminName.trim(),
      newAdminEmail: newAdminEmail.trim().toLowerCase(),
      reason: reason || 'Routine leadership transition',
      requestedAt: new Date(),
      reviewedAt: null,
      status: 'pending'
    };

    const updated = await dbBridge.updateWorkplace(workplaceId, {
      adminReplacementRequest: replacement
    });

    await dbBridge.logAudit({
      action: 'ADMIN_REPLACEMENT_REQUESTED',
      performedBy: req.user.employeeId,
      workplaceId,
      entityType: 'workplace',
      entityId: workplaceId,
      details: replacement
    });

    return res.status(200).json({
      success: true,
      message: 'Administrator replacement request submitted. Platform administration will review the transition.',
      workplace: updated
    });
  } catch (err) {
    console.error('Admin replacement error:', err);
    return res.status(500).json({ success: false, error: 'Failed to request administrator replacement.' });
  }
}

// ================= PLATFORM ADMINISTRATOR CONTROLS =================

/**
 * List all registered workplaces across the platform (Platform Admin only)
 */
async function getPlatformAllWorkplaces(req, res) {
  try {
    const { status, category, search, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.verificationStatus = status;
    if (category) filter.category = category;
    if (search) filter.search = search;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { workplaces, total } = await dbBridge.queryWorkplaces(filter, skip, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      workplaces
    });
  } catch (err) {
    console.error('Platform get all workplaces error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list platform workplaces.' });
  }
}

/**
 * Review Workplace Registration: Approve, Reject, Suspend, Reactivate (Platform Admin only)
 */
async function reviewPlatformWorkplace(req, res) {
  try {
    const { id } = req.params; // workplaceId or _id
    const decision = req.body.decision || req.body.status; // 'approved', 'rejected', 'suspended', 'reactivated'
    const note = req.body.note || req.body.notes || '';

    const workplace = await dbBridge.findWorkplace({
      $or: [{ workplaceId: id }, { _id: id }]
    });

    if (!workplace) {
      return res.status(404).json({ success: false, error: 'Workplace not found.' });
    }

    let newStatus = workplace.verificationStatus;
    let isActive = workplace.isActive;

    if (decision === 'approved') {
      newStatus = 'approved';
      isActive = true;
    } else if (decision === 'rejected') {
      newStatus = 'rejected';
      isActive = false;
    } else if (decision === 'suspended') {
      newStatus = 'suspended';
      isActive = false;
    } else if (decision === 'reactivated') {
      newStatus = 'approved';
      isActive = true;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid decision action.' });
    }

    const updated = await dbBridge.updateWorkplace(workplace.workplaceId, {
      verificationStatus: newStatus,
      verificationNote: note || `Platform decision: ${decision}`,
      reviewedBy: req.user.employeeId,
      reviewedAt: new Date(),
      isActive
    });

    await dbBridge.logAudit({
      action: `WORKPLACE_${decision.toUpperCase()}`,
      performedBy: req.user.employeeId,
      workplaceId: workplace.workplaceId,
      entityType: 'workplace',
      entityId: workplace.workplaceId,
      details: { decision, note, newStatus }
    });

    return res.status(200).json({
      success: true,
      message: `Workplace '${workplace.name}' has been ${decision}.`,
      workplace: updated
    });
  } catch (err) {
    console.error('Review platform workplace error:', err);
    return res.status(500).json({ success: false, error: 'Failed to review workplace.' });
  }
}

/**
 * Get Platform Dashboard Summary (Platform Admin only)
 */
async function getPlatformDashboardSummary(req, res) {
  try {
    const [
      totalWorkplaces,
      approvedWorkplaces,
      pendingWorkplaces,
      suspendedWorkplaces,
      totalUsers,
      totalEmployees,
      totalAdmins
    ] = await Promise.all([
      dbBridge.countWorkplaces({}),
      dbBridge.countWorkplaces({ verificationStatus: 'approved' }),
      dbBridge.countWorkplaces({ verificationStatus: 'pending' }),
      dbBridge.countWorkplaces({ verificationStatus: 'suspended' }),
      dbBridge.countUsers({}),
      dbBridge.countUsers({ role: 'employee' }),
      dbBridge.countUsers({ role: 'admin' })
    ]);

    const { workplaces } = await dbBridge.queryWorkplaces({}, 0, 10);

    const stats = {
      totalWorkplaces,
      approvedWorkplaces,
      pendingWorkplaces,
      suspendedWorkplaces,
      totalUsers,
      totalEmployees,
      totalAdmins
    };

    return res.status(200).json({
      success: true,
      stats,
      summary: stats,
      recentWorkplaces: workplaces
    });
  } catch (err) {
    console.error('Platform dashboard summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve platform dashboard.' });
  }
}

module.exports = {
  registerWorkplace,
  getPublicWorkplaces,
  getMyWorkplace,
  updateMyWorkplace,
  requestAdminReplacement,
  getPlatformAllWorkplaces,
  reviewPlatformWorkplace,
  getPlatformDashboardSummary
};
