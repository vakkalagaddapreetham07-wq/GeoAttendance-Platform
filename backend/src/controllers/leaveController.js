const dbBridge = require('../services/dbBridge');

function calculateDays(start, end) {
  const d1 = new Date(start);
  const d2 = new Date(end);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Employee submits a leave request
 */
async function submitLeave(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Leave type, start date, end date, and reason are required.'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid start or end date.' });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'Start date cannot be after end date.'
      });
    }

    const daysCount = calculateDays(start, end);

    let workplaceId = req.workplaceId;
    if (!workplaceId) {
      const activeMem = await dbBridge.findActiveMembership(employeeId);
      if (activeMem) workplaceId = activeMem.workplaceId;
    }

    if (!workplaceId) {
      return res.status(403).json({
        success: false,
        error: 'Leave submission rejected. You must belong to an approved workplace to submit leave requests.'
      });
    }

    const user = await dbBridge.findUser({ employeeId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Employee account not found.' });
    }

    if (leaveType !== 'unpaid') {
      const currentBalance = user.leaveBalance[leaveType] || 0;
      if (currentBalance < daysCount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient leave balance for ${leaveType} leave. Requested: ${daysCount} days, Available: ${currentBalance} days.`,
          availableBalance: currentBalance,
          requestedDays: daysCount
        });
      }
    }

    const leaveRequest = await dbBridge.createLeave({
      workplaceId,
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      daysCount,
      reason: reason.trim(),
      status: 'pending'
    });

    await dbBridge.logAudit({
      action: 'LEAVE_SUBMITTED',
      performedBy: employeeId,
      targetEmployeeId: employeeId,
      entityType: 'leave',
      entityId: String(leaveRequest._id),
      details: { leaveType, daysCount, startDate, endDate }
    });

    return res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully. Awaiting administrator approval.',
      leaveRequest
    });
  } catch (err) {
    console.error('Submit leave error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error submitting leave.' });
  }
}

/**
 * Get leave requests for logged-in employee
 */
async function getMyLeaves(req, res) {
  try {
    const employeeId = req.user.employeeId;
    const user = await dbBridge.findUser({ employeeId });
    const { requests } = await dbBridge.queryLeaves({ employeeId });

    return res.status(200).json({
      success: true,
      leaveBalance: user ? user.leaveBalance : {},
      requests
    });
  } catch (err) {
    console.error('Get my leaves error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve leave requests.' });
  }
}

/**
 * Get pending leave requests (Admin only)
 */
async function getPendingLeaves(req, res) {
  try {
    const filter = { status: 'pending' };
    const workplaceId = req.workplaceId || req.query.workplaceId;
    if (workplaceId) filter.workplaceId = workplaceId;

    const { requests: pending } = await dbBridge.queryLeaves(filter);

    // Populate employee metadata
    const populated = await Promise.all(
      pending.map(async (p) => {
        const emp = await dbBridge.findUser({ employeeId: p.employeeId });
        return {
          ...p,
          employee: emp || { name: 'Unknown', department: 'General', leaveBalance: {} }
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: populated.length,
      requests: populated
    });
  } catch (err) {
    console.error('Get pending leaves error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve pending leave requests.' });
  }
}

/**
 * Get all leave requests with filters (Admin only)
 */
async function getAllLeaves(req, res) {
  try {
    const { status, employeeId, page = 1, limit = 20 } = req.query;

    const filter = {};
    const workplaceId = req.workplaceId || req.query.workplaceId;
    if (workplaceId) filter.workplaceId = workplaceId;

    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId.toUpperCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { requests, total } = await dbBridge.queryLeaves(filter, skip, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      requests
    });
  } catch (err) {
    console.error('Get all leaves error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve leave records.' });
  }
}

/**
 * Approve leave request (Admin only)
 */
async function approveLeave(req, res) {
  try {
    const { id } = req.params;
    const { decisionNote = '' } = req.body;

    const leave = await dbBridge.findLeaveById(id);
    if (!leave) {
      return res.status(404).json({ success: false, error: 'Leave request not found.' });
    }

    if (req.workplaceId && leave.workplaceId && leave.workplaceId !== req.workplaceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You cannot approve leaves for another workplace.'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Leave request has already been ${leave.status}. Cannot modify decision.`
      });
    }

    const employee = await dbBridge.findUser({ employeeId: leave.employeeId });
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Associated employee not found.' });
    }

    if (leave.leaveType !== 'unpaid') {
      const current = employee.leaveBalance[leave.leaveType] || 0;
      if (current < leave.daysCount) {
        return res.status(400).json({
          success: false,
          error: `Cannot approve. Insufficient balance: Employee only has ${current} days of ${leave.leaveType} leave remaining.`
        });
      }
      employee.leaveBalance[leave.leaveType] -= leave.daysCount;
      if (employee.save) await employee.save();
    }

    leave.status = 'approved';
    leave.reviewedBy = req.user.employeeId;
    leave.decisionTimestamp = new Date();
    leave.decisionNote = decisionNote;
    if (leave.save) await leave.save();

    await dbBridge.logAudit({
      action: 'LEAVE_APPROVED',
      performedBy: req.user.employeeId,
      targetEmployeeId: leave.employeeId,
      workplaceId: leave.workplaceId,
      entityType: 'leave',
      entityId: String(leave._id),
      details: { daysDeducted: leave.daysCount, leaveType: leave.leaveType }
    });

    return res.status(200).json({
      success: true,
      message: `Leave request approved. ${leave.daysCount} days deducted from ${leave.leaveType} balance.`,
      leave,
      updatedBalance: employee.leaveBalance
    });
  } catch (err) {
    console.error('Approve leave error:', err);
    return res.status(500).json({ success: false, error: 'Internal error approving leave.' });
  }
}

/**
 * Reject leave request (Admin only)
 */
async function rejectLeave(req, res) {
  try {
    const { id } = req.params;
    const { decisionNote = 'Declined due to operational requirements.' } = req.body;

    const leave = await dbBridge.findLeaveById(id);
    if (!leave) {
      return res.status(404).json({ success: false, error: 'Leave request not found.' });
    }

    if (req.workplaceId && leave.workplaceId && leave.workplaceId !== req.workplaceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You cannot reject leaves for another workplace.'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Leave request has already been ${leave.status}. Cannot modify decision.`
      });
    }

    leave.status = 'rejected';
    leave.reviewedBy = req.user.employeeId;
    leave.decisionTimestamp = new Date();
    leave.decisionNote = decisionNote;
    if (leave.save) await leave.save();

    await dbBridge.logAudit({
      action: 'LEAVE_REJECTED',
      performedBy: req.user.employeeId,
      targetEmployeeId: leave.employeeId,
      entityType: 'leave',
      entityId: String(leave._id),
      details: { reason: decisionNote }
    });

    return res.status(200).json({
      success: true,
      message: 'Leave request rejected.',
      leave
    });
  } catch (err) {
    console.error('Reject leave error:', err);
    return res.status(500).json({ success: false, error: 'Internal error rejecting leave.' });
  }
}

module.exports = {
  submitLeave,
  getMyLeaves,
  getPendingLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave
};
