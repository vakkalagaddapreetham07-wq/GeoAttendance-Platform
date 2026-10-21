const dbBridge = require('../services/dbBridge');

/**
 * Employee requests to join a workplace
 * Rule: One active workplace membership per employee in v1.0.
 */
async function requestMembership(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { workplaceId, department, roleInWorkplace } = req.body;

    if (!workplaceId) {
      return res.status(400).json({ success: false, error: 'Target Workplace ID is required.' });
    }

    // 1. Verify target workplace exists and is approved
    const workplace = await dbBridge.findWorkplaceById(workplaceId);
    if (!workplace) {
      return res.status(404).json({ success: false, error: 'Target workplace does not exist.' });
    }

    if (workplace.verificationStatus !== 'approved' || !workplace.isActive) {
      return res.status(400).json({
        success: false,
        error: `Cannot join workplace '${workplace.name}'. It is currently ${workplace.verificationStatus}.`
      });
    }

    // 2. Rule: Check if employee already has an approved active membership
    const existingActive = await dbBridge.findActiveMembership(employeeId);
    if (existingActive) {
      const currentWp = await dbBridge.findWorkplaceById(existingActive.workplaceId);
      return res.status(409).json({
        success: false,
        error: `You already hold an active membership at '${currentWp?.name || existingActive.workplaceId}'. In version 1.0, an employee can only belong to one active workplace at a time. Please request a transfer or leave your current workplace first.`
      });
    }

    // 3. Check if there's already a pending request for this workplace
    const existingPending = await dbBridge.findMembership({ employeeId, workplaceId, status: 'pending' });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        error: 'You already have a pending membership request for this workplace. Please wait for the workplace administrator to review it.',
        membership: existingPending
      });
    }

    // 4. Create new membership request
    const membership = await dbBridge.createMembership({
      employeeId,
      workplaceId,
      status: 'pending',
      department: department || req.user.department || 'General',
      roleInWorkplace: roleInWorkplace || 'Staff Member',
      joinRequestedAt: new Date()
    });

    await dbBridge.logAudit({
      action: 'MEMBERSHIP_REQUESTED',
      performedBy: employeeId,
      targetEmployeeId: employeeId,
      workplaceId,
      entityType: 'membership',
      entityId: String(membership._id),
      details: { workplaceName: workplace.name }
    });

    return res.status(201).json({
      success: true,
      message: `Membership request submitted to '${workplace.name}'. Awaiting administrator approval.`,
      membership: {
        ...membership,
        workplaceName: workplace.name,
        organizationName: workplace.organizationName
      }
    });
  } catch (err) {
    console.error('Request membership error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit membership request.' });
  }
}

/**
 * Get current employee's membership status and workplace details
 */
async function getMyMembershipStatus(req, res) {
  try {
    const employeeId = req.user.employeeId;

    // Look for active membership first, or pending request
    let membership = await dbBridge.findActiveMembership(employeeId);
    if (!membership) {
      membership = await dbBridge.findMembership({ employeeId, status: 'pending' });
    }
    if (!membership) {
      membership = await dbBridge.findMembership({ employeeId });
    }

    if (!membership) {
      return res.status(200).json({
        success: true,
        hasMembership: false,
        hasActiveWorkplace: false,
        status: 'unassigned',
        message: 'No workplace membership found. Please select and join a workplace.'
      });
    }

    const workplace = await dbBridge.findWorkplaceById(membership.workplaceId);
    const hasActiveWorkplace = membership.status === 'approved';

    return res.status(200).json({
      success: true,
      hasMembership: true,
      hasActiveWorkplace,
      status: membership.status,
      membership,
      workplace: workplace
        ? {
            workplaceId: workplace.workplaceId,
            name: workplace.name,
            organizationName: workplace.organizationName,
            category: workplace.category,
            address: workplace.address,
            geofence: workplace.geofence,
            shiftSchedule: workplace.shiftSchedule,
            adminName: workplace.adminName
          }
        : null
    });
  } catch (err) {
    console.error('Get my membership status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve membership status.' });
  }
}

/**
 * List pending membership requests for the authenticated workplace administrator
 */
async function getPendingMemberships(req, res) {
  try {
    const workplaceId = req.workplaceId;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { memberships, total } = await dbBridge.queryMemberships(
      { workplaceId, status: 'pending' },
      skip,
      parseInt(limit, 10)
    );

    // Enrich with user profile details
    const enriched = await Promise.all(
      memberships.map(async (m) => {
        const user = await dbBridge.findUser({ employeeId: m.employeeId });
        return {
          id: m._id,
          employeeId: m.employeeId,
          name: user?.name || m.employeeId,
          email: user?.email || '',
          mobileNumber: user?.mobileNumber || '',
          department: m.department || user?.department || 'General',
          roleInWorkplace: m.roleInWorkplace || 'Staff',
          joinRequestedAt: m.joinRequestedAt,
          status: m.status
        };
      })
    );

    return res.status(200).json({
      success: true,
      total,
      requests: enriched,
      pending: enriched,
      memberships: enriched
    });
  } catch (err) {
    console.error('Get pending memberships error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve pending memberships.' });
  }
}

/**
 * List all active/approved members of the workplace (Workplace Admin only)
 */
async function getWorkplaceMembers(req, res) {
  try {
    const workplaceId = req.workplaceId;
    const { status = 'approved', page = 1, limit = 100 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = { workplaceId };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const { memberships, total } = await dbBridge.queryMemberships(
      filter,
      skip,
      parseInt(limit, 10)
    );

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await dbBridge.findUser({ employeeId: m.employeeId });
        const device = await dbBridge.findDevice({ employeeId: m.employeeId, isBound: true });
        return {
          id: m._id,
          employeeId: m.employeeId,
          name: user?.name || m.employeeName || m.employeeId,
          email: user?.email || '',
          mobileNumber: user?.mobileNumber || '',
          department: m.department || user?.department || 'General',
          roleInWorkplace: m.roleInWorkplace || 'Employee',
          status: m.status,
          startDate: m.startDate || m.joinRequestedAt,
          boundDevice: device ? { model: device.deviceModel, id: device.deviceId } : null
        };
      })
    );

    // Also include any users directly assigned to this workplace who may not have a separate membership record
    const assignedUsers = await dbBridge.findUsers({ assignedWorkplaceId: workplaceId, role: 'employee' });
    for (const u of assignedUsers) {
      if (!members.some((m) => m.employeeId === u.employeeId)) {
        const device = await dbBridge.findDevice({ employeeId: u.employeeId, isBound: true });
        members.push({
          id: String(u._id),
          employeeId: u.employeeId,
          name: u.name,
          email: u.email,
          mobileNumber: u.mobileNumber || '',
          department: u.department || 'Operations',
          roleInWorkplace: 'Employee',
          status: 'approved',
          startDate: u.createdAt || new Date(),
          boundDevice: device ? { model: device.deviceModel, id: device.deviceId } : null
        });
      }
    }

    return res.status(200).json({
      success: true,
      total: members.length,
      members
    });
  } catch (err) {
    console.error('Get workplace members error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve workplace members.' });
  }
}

/**
 * Approve a pending membership request (Workplace Admin only)
 */
async function approveMembership(req, res) {
  try {
    const { id } = req.params;
    const workplaceId = req.workplaceId;

    const membership = await dbBridge.findMembership({ _id: id });
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership request not found.' });
    }

    // Tenant isolation verification: Admin can only approve requests for their OWN workplace
    if (membership.workplaceId !== workplaceId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. You cannot approve requests for another workplace.'
      });
    }

    if (membership.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Membership request is already ${membership.status}.`
      });
    }

    // Rule: Ensure employee doesn't already have another active membership elsewhere
    const otherActive = await dbBridge.findActiveMembership(membership.employeeId);
    if (otherActive && String(otherActive._id) !== String(membership._id)) {
      return res.status(409).json({
        success: false,
        error: 'Employee already has an active membership at another workplace.'
      });
    }

    const updated = await dbBridge.updateMembership(membership._id, {
      status: 'approved',
      reviewedBy: req.user.employeeId,
      reviewedAt: new Date(),
      startDate: new Date()
    });

    // Update user's assignedWorkplaceId
    await dbBridge.updateUser(membership.employeeId, {
      assignedWorkplaceId: workplaceId
    });

    await dbBridge.logAudit({
      action: 'MEMBERSHIP_APPROVED',
      performedBy: req.user.employeeId,
      targetEmployeeId: membership.employeeId,
      workplaceId,
      entityType: 'membership',
      entityId: String(membership._id),
      details: { approvedBy: req.user.name }
    });

    return res.status(200).json({
      success: true,
      message: `Employee ${membership.employeeId} has been approved as an active workplace member.`,
      membership: updated
    });
  } catch (err) {
    console.error('Approve membership error:', err);
    return res.status(500).json({ success: false, error: 'Failed to approve membership.' });
  }
}

/**
 * Reject a pending membership request (Workplace Admin only)
 */
async function rejectMembership(req, res) {
  try {
    const { id } = req.params;
    const workplaceId = req.workplaceId;
    const { reason } = req.body;

    const membership = await dbBridge.findMembership({ _id: id });
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership request not found.' });
    }

    // Tenant isolation verification
    if (membership.workplaceId !== workplaceId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. You cannot reject requests for another workplace.'
      });
    }

    const updated = await dbBridge.updateMembership(membership._id, {
      status: 'rejected',
      rejectionReason: reason || 'Not approved by workplace administrator',
      reviewedBy: req.user.employeeId,
      reviewedAt: new Date()
    });

    await dbBridge.logAudit({
      action: 'MEMBERSHIP_REJECTED',
      performedBy: req.user.employeeId,
      targetEmployeeId: membership.employeeId,
      workplaceId,
      entityType: 'membership',
      entityId: String(membership._id),
      details: { reason }
    });

    return res.status(200).json({
      success: true,
      message: `Membership request for ${membership.employeeId} has been rejected.`,
      membership: updated
    });
  } catch (err) {
    console.error('Reject membership error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reject membership.' });
  }
}

/**
 * Suspend or End an existing membership (Workplace Admin only)
 */
async function updateMemberStatus(req, res) {
  try {
    const { id } = req.params;
    const workplaceId = req.workplaceId;
    const { status, reason } = req.body; // 'suspended', 'ended', 'approved'

    const membership = await dbBridge.findMembership({ _id: id });
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership record not found.' });
    }

    if (membership.workplaceId !== workplaceId) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }

    const updates = { status };
    if (status === 'ended') updates.endDate = new Date();

    const updated = await dbBridge.updateMembership(membership._id, updates);

    // If ended, remove assignedWorkplaceId from user
    if (status === 'ended') {
      await dbBridge.updateUser(membership.employeeId, { assignedWorkplaceId: null });
    }

    await dbBridge.logAudit({
      action: `MEMBERSHIP_${status.toUpperCase()}`,
      performedBy: req.user.employeeId,
      targetEmployeeId: membership.employeeId,
      workplaceId,
      entityType: 'membership',
      entityId: String(membership._id),
      details: { status, reason }
    });

    return res.status(200).json({
      success: true,
      message: `Membership for ${membership.employeeId} updated to ${status}.`,
      membership: updated
    });
  } catch (err) {
    console.error('Update member status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update member status.' });
  }
}

module.exports = {
  requestMembership,
  getMyMembershipStatus,
  getPendingMemberships,
  getWorkplaceMembers,
  approveMembership,
  rejectMembership,
  updateMemberStatus
};
