const dbBridge = require('../services/dbBridge');

function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get comprehensive HR analytics dashboard metrics
 */
async function getDashboardSummary(req, res) {
  try {
    const todayStr = getLocalDateString();
    const workplaceId = req.workplaceId || req.query.workplaceId || null;

    const attFilter = { status: 'completed' };
    const todayFilter = { attendanceDate: todayStr };
    const anomalyFilter = { 'anomaly.isAnomaly': true };
    const pendingAnomalyFilter = { 'anomaly.isAnomaly': true, 'anomaly.reviewStatus': 'pending' };
    const leaveFilter = { status: 'pending' };

    let totalEmployees = 0;
    if (workplaceId) {
      attFilter.workplaceId = workplaceId;
      todayFilter.workplaceId = workplaceId;
      anomalyFilter.workplaceId = workplaceId;
      pendingAnomalyFilter.workplaceId = workplaceId;
      leaveFilter.workplaceId = workplaceId;
      totalEmployees = await dbBridge.countMemberships({ workplaceId, status: 'approved' });
    } else {
      totalEmployees = await dbBridge.countUsers({ role: 'employee', accountStatus: 'active' });
    }

    const { total: totalCompletedRecords, records: completedRecords } = await dbBridge.queryAttendance(attFilter, 0, 1000);
    const { total: todayPresent } = await dbBridge.queryAttendance(todayFilter, 0, 1000);
    const { total: totalAnomalies, records: anomalyRecords } = await dbBridge.queryAttendance(anomalyFilter, 0, 1000);
    const { total: pendingAnomalies } = await dbBridge.queryAttendance(pendingAnomalyFilter, 0, 1000);
    const { total: pendingLeaves } = await dbBridge.queryLeaves(leaveFilter);

    // Duration calculation
    let totalDur = 0;
    let punctualCount = 0;
    completedRecords.forEach((r) => {
      totalDur += r.durationMinutes || 0;
      if (r.anomaly?.features?.checkInDeviation <= 15) {
        punctualCount++;
      }
    });

    const avgDuration = totalCompletedRecords > 0 ? Math.round(totalDur / totalCompletedRecords) : 0;
    const punctualityRate = totalCompletedRecords > 0 ? Math.round((punctualCount / totalCompletedRecords) * 100) : 100;

    let mlOnlyCount = 0;
    let hardRuleOnlyCount = 0;
    let bothCount = 0;

    anomalyRecords.forEach((r) => {
      if (r.anomaly?.detectionSource === 'ml_only') mlOnlyCount++;
      else if (r.anomaly?.detectionSource === 'hard_rule_only') hardRuleOnlyCount++;
      else if (r.anomaly?.detectionSource === 'both') bothCount++;
    });

    return res.status(200).json({
      success: true,
      workplaceId,
      summary: {
        totalEmployees,
        todayPresent,
        attendanceRateToday: totalEmployees > 0 ? Math.round((todayPresent / totalEmployees) * 100) : 0,
        punctualityRate,
        averageDurationMinutes: avgDuration,
        averageDurationHours: (avgDuration / 60).toFixed(1),
        totalAnomalies,
        pendingAnomalies,
        pendingLeaves,
        detectionSourceBreakdown: {
          mlOnly: mlOnlyCount,
          hardRuleOnly: hardRuleOnlyCount,
          both: bothCount
        },
        recentAnomalies: anomalyRecords.slice(0, 5)
      }
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate analytics dashboard summary.' });
  }
}

/**
 * Query all attendance records with employee filtering, date range, pagination
 */
async function getAttendanceRecords(req, res) {
  try {
    const { employeeId, startDate, endDate, status, isAnomaly, page = 1, limit = 20 } = req.query;

    const filter = {};
    const workplaceId = req.workplaceId || req.query.workplaceId;
    if (workplaceId) filter.workplaceId = workplaceId;

    if (employeeId) filter.employeeId = employeeId.trim().toUpperCase();
    if (status) filter.status = status;
    if (isAnomaly !== undefined) filter['anomaly.isAnomaly'] = isAnomaly === 'true';

    if (startDate && endDate) {
      filter.attendanceDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.attendanceDate = { $gte: startDate };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { records, total } = await dbBridge.queryAttendance(filter, skip, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      records
    });
  } catch (err) {
    console.error('Get attendance records error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve attendance records.' });
  }
}

/**
 * Dedicated endpoint for attendance anomalies
 */
async function getAnomalyRecords(req, res) {
  try {
    const { detectionSource, reviewStatus, employeeId, page = 1, limit = 20 } = req.query;

    const filter = { 'anomaly.isAnomaly': true };
    const workplaceId = req.workplaceId || req.query.workplaceId;
    if (workplaceId) filter.workplaceId = workplaceId;

    if (detectionSource) filter['anomaly.detectionSource'] = detectionSource;
    if (reviewStatus) filter['anomaly.reviewStatus'] = reviewStatus;
    if (employeeId) filter.employeeId = employeeId.trim().toUpperCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { records: anomalies, total } = await dbBridge.queryAttendance(filter, skip, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      anomalies
    });
  } catch (err) {
    console.error('Get anomaly records error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve anomaly records.' });
  }
}

/**
 * Review or resolve an anomaly record (Admin action)
 */
async function reviewAnomaly(req, res) {
  try {
    const { id } = req.params;
    const { reviewStatus, reviewNotes = '' } = req.body;

    const normalizedStatus = String(reviewStatus || '').trim().toLowerCase();
    const validStatuses = ['reviewed', 'resolved', 'approved', 'rejected', 'pending'];

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        error: `Review status must be one of: ${validStatuses.join(', ')}.`
      });
    }

    if (req.workplaceId) {
      const { records } = await dbBridge.queryAttendance({ _id: id });
      if (records.length && records[0].workplaceId && records[0].workplaceId !== req.workplaceId) {
        return res.status(403).json({ success: false, error: 'Access denied. You cannot review records from another workplace.' });
      }
    }

    const record = await dbBridge.updateAttendanceRecord(id, {
      'anomaly.reviewStatus': normalizedStatus,
      'anomaly.reviewedBy': req.user.employeeId,
      'anomaly.reviewNotes': reviewNotes
    });

    if (!record) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }

    await dbBridge.logAudit({
      action: 'ANOMALY_REVIEWED',
      performedBy: req.user.employeeId,
      targetEmployeeId: record.employeeId,
      entityType: 'attendance',
      entityId: String(record._id),
      details: { reviewStatus: normalizedStatus, reviewNotes }
    });

    return res.status(200).json({
      success: true,
      message: `Anomaly status marked as ${normalizedStatus}.`,
      record
    });
  } catch (err) {
    console.error('Review anomaly error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update anomaly review status.' });
  }
}

/**
 * Get company shift schedule
 */
async function getShiftSchedule(req, res) {
  try {
    const workplaceId = req.workplaceId || req.query.workplaceId || null;
    const schedule = await dbBridge.getCompanyShift(workplaceId);
    return res.status(200).json({
      success: true,
      schedule
    });
  } catch (err) {
    console.error('Get shift schedule error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve shift schedule.' });
  }
}

/**
 * Update company shift schedule (Admin only)
 */
async function updateShiftSchedule(req, res) {
  try {
    const workplaceId = req.workplaceId || req.body.workplaceId || null;
    const { shiftStart, shiftEnd, timezone, gracePeriodMinutes } = req.body;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (shiftStart && !timeRegex.test(shiftStart)) {
      return res.status(400).json({ success: false, error: 'Shift start must be in 24h HH:mm format (e.g. 09:00).' });
    }
    if (shiftEnd && !timeRegex.test(shiftEnd)) {
      return res.status(400).json({ success: false, error: 'Shift end must be in 24h HH:mm format (e.g. 18:00).' });
    }

    const updates = {};
    if (shiftStart) updates.shiftStart = shiftStart;
    if (shiftEnd) updates.shiftEnd = shiftEnd;
    if (timezone) updates.timezone = timezone;
    if (gracePeriodMinutes !== undefined) updates.gracePeriodMinutes = Number(gracePeriodMinutes);
    updates.updatedBy = req.user.employeeId;

    const schedule = await dbBridge.updateCompanyShift(workplaceId, updates);

    await dbBridge.logAudit({
      action: 'SHIFT_SCHEDULE_UPDATED',
      performedBy: req.user.employeeId,
      workplaceId,
      entityType: 'shift_schedule',
      entityId: String(schedule?._id || 'schedule'),
      details: { shiftStart: schedule?.shiftStart, shiftEnd: schedule?.shiftEnd }
    });

    return res.status(200).json({
      success: true,
      message: 'Company shift schedule successfully updated.',
      schedule
    });
  } catch (err) {
    console.error('Update shift schedule error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update shift schedule.' });
  }
}

module.exports = {
  getDashboardSummary,
  getAttendanceRecords,
  getAnomalyRecords,
  reviewAnomaly,
  getShiftSchedule,
  updateShiftSchedule
};
