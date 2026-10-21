const mongoose = require('mongoose');
const memoryStore = require('../config/memoryStore');
const User = require('../models/User');
const Workplace = require('../models/Workplace');
const WorkplaceMembership = require('../models/WorkplaceMembership');
const Device = require('../models/Device');
const Geofence = require('../models/Geofence');
const ShiftSchedule = require('../models/ShiftSchedule');
const AttendanceRecord = require('../models/AttendanceRecord');
const LeaveRequest = require('../models/LeaveRequest');
const OtpRecord = require('../models/OtpRecord');
const AuditLog = require('../models/AuditLog');
const FaceEnrollment = require('../models/FaceEnrollment');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// ----------------- WORKPLACES -----------------
async function findWorkplace(filter) {
  if (isMongoConnected()) {
    return await Workplace.findOne(filter);
  }
  return (
    memoryStore.workplaces.find((w) => {
      if (filter.workplaceId && w.workplaceId !== filter.workplaceId) return false;
      if (filter.adminEmployeeId && w.adminEmployeeId !== filter.adminEmployeeId) return false;
      if (filter.verificationStatus && w.verificationStatus !== filter.verificationStatus) return false;
      if (filter._id && String(w._id) !== String(filter._id)) return false;
      return true;
    }) || null
  );
}

async function findWorkplaceById(workplaceId) {
  return await findWorkplace({ workplaceId });
}

async function createWorkplace(data) {
  if (isMongoConnected()) {
    return await Workplace.create(data);
  }
  const newWp = {
    _id: `wp_${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    ...data
  };
  memoryStore.workplaces.push(newWp);
  memoryStore.persist();
  return newWp;
}

async function updateWorkplace(workplaceId, updates) {
  if (isMongoConnected()) {
    const wp = await Workplace.findOne({ workplaceId });
    if (wp) {
      Object.assign(wp, updates);
      await wp.save();
    }
    return wp;
  }
  const wp = memoryStore.workplaces.find((w) => w.workplaceId === workplaceId);
  if (wp) {
    Object.assign(wp, updates, { updatedAt: new Date() });
    memoryStore.persist();
  }
  return wp;
}

async function queryWorkplaces(filter = {}, skip = 0, limit = 50) {
  if (isMongoConnected()) {
    const [workplaces, total] = await Promise.all([
      Workplace.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Workplace.countDocuments(filter)
    ]);
    return { workplaces, total };
  }

  let list = memoryStore.workplaces.filter((w) => {
    if (filter.verificationStatus && w.verificationStatus !== filter.verificationStatus) return false;
    if (filter.category && w.category !== filter.category) return false;
    if (filter.isActive !== undefined && w.isActive !== filter.isActive) return false;
    if (filter['address.city'] && w.address?.city?.toLowerCase() !== filter['address.city'].toLowerCase()) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const matchName = w.name?.toLowerCase().includes(q);
      const matchOrg = w.organizationName?.toLowerCase().includes(q);
      const matchCity = w.address?.city?.toLowerCase().includes(q);
      if (!matchName && !matchOrg && !matchCity) return false;
    }
    return true;
  });

  const total = list.length;
  const workplaces = list.slice(skip, skip + limit);
  return { workplaces, total };
}

async function countWorkplaces(filter = {}) {
  if (isMongoConnected()) {
    return await Workplace.countDocuments(filter);
  }
  return memoryStore.workplaces.filter((w) => {
    if (filter.verificationStatus && w.verificationStatus !== filter.verificationStatus) return false;
    if (filter.isActive !== undefined && w.isActive !== filter.isActive) return false;
    return true;
  }).length;
}

// ----------------- MEMBERSHIPS -----------------
async function findMembership(filter) {
  if (isMongoConnected()) {
    return await WorkplaceMembership.findOne(filter);
  }
  return (
    memoryStore.workplaceMemberships.find((m) => {
      if (filter.employeeId && m.employeeId !== filter.employeeId) return false;
      if (filter.workplaceId && m.workplaceId !== filter.workplaceId) return false;
      if (filter.status && m.status !== filter.status) return false;
      if (filter._id && String(m._id) !== String(filter._id)) return false;
      return true;
    }) || null
  );
}

async function findActiveMembership(employeeId) {
  return await findMembership({ employeeId, status: 'approved' });
}

async function createMembership(data) {
  if (isMongoConnected()) {
    return await WorkplaceMembership.create(data);
  }
  const newMem = {
    _id: `mem_${Date.now()}`,
    joinRequestedAt: new Date(),
    status: 'pending',
    ...data
  };
  memoryStore.workplaceMemberships.push(newMem);
  memoryStore.persist();
  return newMem;
}

async function updateMembership(id, updates) {
  if (isMongoConnected()) {
    const mem = await WorkplaceMembership.findById(id);
    if (mem) {
      Object.assign(mem, updates);
      await mem.save();
    }
    return mem;
  }
  const mem = memoryStore.workplaceMemberships.find((m) => String(m._id) === String(id));
  if (mem) {
    Object.assign(mem, updates);
    memoryStore.persist();
  }
  return mem;
}

async function queryMemberships(filter = {}, skip = 0, limit = 50) {
  if (isMongoConnected()) {
    const [memberships, total] = await Promise.all([
      WorkplaceMembership.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WorkplaceMembership.countDocuments(filter)
    ]);
    return { memberships, total };
  }

  let list = memoryStore.workplaceMemberships.filter((m) => {
    if (filter.workplaceId && m.workplaceId !== filter.workplaceId) return false;
    if (filter.employeeId && m.employeeId !== filter.employeeId) return false;
    if (filter.status && m.status !== filter.status) return false;
    return true;
  });

  const total = list.length;
  const memberships = list.slice(skip, skip + limit);
  return { memberships, total };
}

async function countMemberships(filter = {}) {
  if (isMongoConnected()) {
    return await WorkplaceMembership.countDocuments(filter);
  }
  return memoryStore.workplaceMemberships.filter((m) => {
    if (filter.workplaceId && m.workplaceId !== filter.workplaceId) return false;
    if (filter.status && m.status !== filter.status) return false;
    return true;
  }).length;
}

// ----------------- USERS -----------------
async function findUser(filter) {
  if (isMongoConnected()) {
    return await User.findOne(filter);
  }
  return (
    memoryStore.users.find((u) => {
      if (filter.employeeId && u.employeeId === filter.employeeId) return true;
      if (filter.email && u.email?.toLowerCase() === filter.email?.toLowerCase()) return true;
      if (filter.mobileNumber && u.mobileNumber === filter.mobileNumber) return true;
      if (filter.$or) {
        return filter.$or.some(
          (f) =>
            (f.employeeId && u.employeeId === f.employeeId) ||
            (f.email && u.email?.toLowerCase() === f.email?.toLowerCase()) ||
            (f.mobileNumber && u.mobileNumber === f.mobileNumber)
        );
      }
      return false;
    }) || null
  );
}

async function createUser(data) {
  if (isMongoConnected()) {
    return await User.create(data);
  }
  const newUser = { _id: `user_${Date.now()}`, ...data };
  memoryStore.users.push(newUser);
  memoryStore.persist();
  return newUser;
}

async function updateUser(employeeId, updates) {
  if (isMongoConnected()) {
    const u = await User.findOne({ employeeId });
    if (u) {
      Object.assign(u, updates);
      await u.save();
    }
    return u;
  }
  const u = memoryStore.users.find((user) => user.employeeId === employeeId);
  if (u) {
    Object.assign(u, updates);
    memoryStore.persist();
  }
  return u;
}

async function countUsers(filter = {}) {
  if (isMongoConnected()) {
    return await User.countDocuments(filter);
  }
  return memoryStore.users.filter((u) => {
    if (filter.role && u.role !== filter.role) return false;
    if (filter.accountStatus && u.accountStatus !== filter.accountStatus) return false;
    if (filter.assignedWorkplaceId && u.assignedWorkplaceId !== filter.assignedWorkplaceId) return false;
    return true;
  }).length;
}

async function findUsers(filter = {}) {
  if (isMongoConnected()) {
    return await User.find(filter);
  }
  return memoryStore.users.filter((u) => {
    if (filter.role && u.role !== filter.role) return false;
    if (filter.assignedWorkplaceId && u.assignedWorkplaceId !== filter.assignedWorkplaceId) return false;
    if (filter.accountStatus && u.accountStatus !== filter.accountStatus) return false;
    return true;
  });
}

// ----------------- DEVICES -----------------
async function findDevice(filter) {
  if (isMongoConnected()) {
    return await Device.findOne(filter);
  }
  return (
    memoryStore.devices.find((d) => {
      if (filter.deviceId && d.deviceId !== filter.deviceId) return false;
      if (filter.employeeId && d.employeeId !== filter.employeeId) return false;
      if (filter.workplaceId && d.workplaceId !== filter.workplaceId) return false;
      if (filter.isBound !== undefined && d.isBound !== filter.isBound) return false;
      return true;
    }) || null
  );
}

async function saveDevice(data) {
  if (isMongoConnected()) {
    let existing = await Device.findOne({ deviceId: data.deviceId });
    if (existing) {
      Object.assign(existing, data);
      return await existing.save();
    }
    return await Device.create(data);
  }
  let existing = memoryStore.devices.find((d) => d.deviceId === data.deviceId);
  if (existing) {
    Object.assign(existing, data);
    memoryStore.persist();
    return existing;
  }
  const newDevice = { _id: `dev_${Date.now()}`, ...data };
  memoryStore.devices.push(newDevice);
  memoryStore.persist();
  return newDevice;
}

async function invalidateEmployeeDevices(employeeId, exceptDeviceId = '') {
  if (isMongoConnected()) {
    const query = { employeeId, isBound: true };
    if (exceptDeviceId) query.deviceId = { $ne: exceptDeviceId };
    return await Device.updateMany(query, { isBound: false, revokedAt: new Date() });
  }
  memoryStore.devices.forEach((d) => {
    if (d.employeeId === employeeId && d.deviceId !== exceptDeviceId && d.isBound) {
      d.isBound = false;
      d.revokedAt = new Date();
    }
  });
  memoryStore.persist();
}

// ----------------- OTP RECORDS -----------------
async function createOtp(data) {
  if (isMongoConnected()) {
    return await OtpRecord.create(data);
  }
  const rec = { _id: `otp_${Date.now()}`, ...data };
  memoryStore.otpRecords.push(rec);
  return rec;
}

async function findLatestOtp(employeeId, deviceId) {
  if (isMongoConnected()) {
    return await OtpRecord.findOne({ employeeId, deviceId, isConsumed: false }).sort({ createdAt: -1 });
  }
  const records = memoryStore.otpRecords
    .filter((r) => r.employeeId === employeeId && r.deviceId === deviceId && !r.isConsumed)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return records[0] || null;
}

async function invalidateActiveOtps(employeeId) {
  if (isMongoConnected()) {
    return await OtpRecord.updateMany({ employeeId, isConsumed: false }, { isConsumed: true, consumedAt: new Date() });
  }
  memoryStore.otpRecords.forEach((r) => {
    if (r.employeeId === employeeId && !r.isConsumed) {
      r.isConsumed = true;
      r.consumedAt = new Date();
    }
  });
}

async function createRegistrationOtp(data) {
  const payload = { purpose: 'registration', createdAt: new Date(), ...data };
  if (isMongoConnected()) {
    return await OtpRecord.create(payload);
  }
  const rec = { _id: `reg_otp_${Date.now()}`, ...payload };
  memoryStore.otpRecords.push(rec);
  return rec;
}

async function findLatestRegistrationOtp(phone) {
  if (isMongoConnected()) {
    return await OtpRecord.findOne({ phone, purpose: 'registration', isConsumed: false }).sort({ createdAt: -1 });
  }
  const records = memoryStore.otpRecords
    .filter((r) => r.phone === phone && (!r.purpose || r.purpose === 'registration') && !r.isConsumed)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return records[0] || null;
}

async function invalidateRegistrationOtps(phone) {
  if (isMongoConnected()) {
    return await OtpRecord.updateMany({ phone, isConsumed: false }, { isConsumed: true, consumedAt: new Date() });
  }
  memoryStore.otpRecords.forEach((r) => {
    if (r.phone === phone && !r.isConsumed) {
      r.isConsumed = true;
      r.consumedAt = new Date();
    }
  });
}

// ----------------- GEOFENCES -----------------
async function findGeofence(workplaceId, employeeId = null) {
  if (isMongoConnected()) {
    // 1. Employee-specific override if provided
    if (employeeId) {
      const empGeo = await Geofence.findOne({ employeeId, isActive: true });
      if (empGeo) return empGeo;
    }
    // 2. Workplace geofence
    if (workplaceId) {
      const wpGeo = await Geofence.findOne({ workplaceId, isActive: true });
      if (wpGeo) return wpGeo;
      const wp = await Workplace.findOne({ workplaceId });
      if (wp?.geofence) {
        return {
          workplaceId,
          center: wp.geofence.center,
          radius: wp.geofence.radius || 50,
          locationName: wp.geofence.locationName || wp.name
        };
      }
    }
    return null;
  }

  // Memory store
  if (employeeId) {
    const empGeo = memoryStore.geofences.find((g) => g.employeeId === employeeId && g.isActive);
    if (empGeo) return empGeo;
  }
  if (workplaceId) {
    const wpGeo = memoryStore.geofences.find((g) => g.workplaceId === workplaceId && g.isActive);
    if (wpGeo) return wpGeo;
    const wp = memoryStore.workplaces.find((w) => w.workplaceId === workplaceId);
    if (wp?.geofence) {
      return {
        workplaceId,
        center: wp.geofence.center,
        radius: wp.geofence.radius || 50,
        locationName: wp.geofence.locationName || wp.name
      };
    }
  }
  return null;
}

async function upsertGeofence(workplaceId, employeeId, data) {
  if (isMongoConnected()) {
    const filter = employeeId ? { employeeId } : { workplaceId };
    return await Geofence.findOneAndUpdate(
      filter,
      { workplaceId, employeeId, ...data },
      { upsert: true, new: true }
    );
  }

  const existing = memoryStore.geofences.find((g) =>
    employeeId ? g.employeeId === employeeId : g.workplaceId === workplaceId
  );
  if (existing) {
    Object.assign(existing, { workplaceId, employeeId, ...data });
    memoryStore.persist();
    return existing;
  }
  const newG = { _id: `geo_${Date.now()}`, workplaceId, employeeId, ...data };
  memoryStore.geofences.push(newG);
  memoryStore.persist();
  return newG;
}

// ----------------- SHIFT SCHEDULE -----------------
async function getCompanyShift(workplaceId = null) {
  if (isMongoConnected()) {
    if (workplaceId) {
      let s = await ShiftSchedule.findOne({ workplaceId });
      if (s) return s;
      const wp = await Workplace.findOne({ workplaceId });
      if (wp?.shiftSchedule) {
        return {
          workplaceId,
          shiftStart: wp.shiftSchedule.shiftStart,
          shiftEnd: wp.shiftSchedule.shiftEnd,
          gracePeriodMinutes: wp.shiftSchedule.gracePeriodMinutes || 15,
          timezone: wp.shiftSchedule.timezone || 'Asia/Kolkata'
        };
      }
    }
    let s = await ShiftSchedule.findOne({ isCompanyWide: true });
    if (!s) s = await ShiftSchedule.create(memoryStore.workplaces[0]?.shiftSchedule || {});
    return s;
  }

  // Memory store
  if (workplaceId) {
    const wp = memoryStore.workplaces.find((w) => w.workplaceId === workplaceId);
    if (wp?.shiftSchedule) {
      return {
        workplaceId,
        ...wp.shiftSchedule
      };
    }
  }
  return memoryStore.workplaces[0]?.shiftSchedule || { shiftStart: '09:00', shiftEnd: '18:00', gracePeriodMinutes: 15, timezone: 'Asia/Kolkata' };
}

async function updateCompanyShift(workplaceId, data) {
  if (isMongoConnected()) {
    if (workplaceId) {
      await Workplace.findOneAndUpdate({ workplaceId }, { shiftSchedule: data });
      let s = await ShiftSchedule.findOne({ workplaceId });
      if (!s) s = new ShiftSchedule({ workplaceId });
      Object.assign(s, data);
      return await s.save();
    }
    let s = await ShiftSchedule.findOne({ isCompanyWide: true });
    if (!s) s = new ShiftSchedule({ isCompanyWide: true });
    Object.assign(s, data);
    return await s.save();
  }

  if (workplaceId) {
    const wp = memoryStore.workplaces.find((w) => w.workplaceId === workplaceId);
    if (wp) {
      wp.shiftSchedule = { ...wp.shiftSchedule, ...data };
      memoryStore.persist();
      return wp.shiftSchedule;
    }
  }
  return data;
}

// ----------------- ATTENDANCE RECORDS -----------------
async function findActiveAttendance(employeeId) {
  if (isMongoConnected()) {
    return await AttendanceRecord.findOne({ employeeId, status: 'checked_in' });
  }
  return (
    memoryStore.attendanceRecords.find((r) => r.employeeId === employeeId && r.status === 'checked_in') || null
  );
}

async function createAttendance(data) {
  if (isMongoConnected()) {
    return await AttendanceRecord.create(data);
  }
  const newRec = { _id: `att_${Date.now()}`, ...data, createdAt: new Date() };
  memoryStore.attendanceRecords.unshift(newRec);
  memoryStore.persist();
  return newRec;
}

async function queryAttendance(filter = {}, skip = 0, limit = 20) {
  if (isMongoConnected()) {
    const [records, total] = await Promise.all([
      AttendanceRecord.find(filter)
        .sort({ attendanceDate: -1, 'checkIn.timestamp': -1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecord.countDocuments(filter)
    ]);
    return { records, total };
  }

  let list = memoryStore.attendanceRecords.filter((r) => {
    // Tenant Isolation
    if (filter.workplaceId && r.workplaceId !== filter.workplaceId) return false;
    if (filter.employeeId && r.employeeId !== filter.employeeId) return false;
    if (filter.status && r.status !== filter.status) return false;
    if (
      filter['anomaly.isAnomaly'] !== undefined &&
      r.anomaly?.isAnomaly !== filter['anomaly.isAnomaly']
    )
      return false;
    if (
      filter['anomaly.detectionSource'] &&
      r.anomaly?.detectionSource !== filter['anomaly.detectionSource']
    )
      return false;
    if (
      filter['anomaly.reviewStatus'] &&
      r.anomaly?.reviewStatus !== filter['anomaly.reviewStatus']
    )
      return false;
    if (filter.attendanceDate) {
      if (typeof filter.attendanceDate === 'string' && r.attendanceDate !== filter.attendanceDate)
        return false;
      if (filter.attendanceDate.$gte && r.attendanceDate < filter.attendanceDate.$gte) return false;
      if (filter.attendanceDate.$lte && r.attendanceDate > filter.attendanceDate.$lte) return false;
    }
    return true;
  });

  const total = list.length;
  const records = list.slice(skip, skip + limit);
  return { records, total };
}

async function updateAttendanceRecord(id, updates) {
  let rec = null;
  if (isMongoConnected()) {
    try {
      rec = await AttendanceRecord.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: false }
      );
    } catch (mErr) {
      console.warn('[dbBridge] MongoDB findByIdAndUpdate error:', mErr.message);
    }
  }

  // Also update in memoryStore to ensure offline/sync consistency
  const memRec = memoryStore?.attendanceRecords?.find((r) => String(r._id) === String(id));
  if (memRec) {
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = memRec;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
      } else {
        memRec[key] = value;
      }
    }
    if (typeof memoryStore.persist === 'function') {
      memoryStore.persist();
    }
    if (!rec) rec = memRec;
  }

  return rec;
}

// ----------------- LEAVE REQUESTS -----------------
async function queryLeaves(filter = {}, skip = 0, limit = 50) {
  if (isMongoConnected()) {
    const [requests, total] = await Promise.all([
      LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LeaveRequest.countDocuments(filter)
    ]);
    return { requests, total };
  }

  let list = memoryStore.leaveRequests.filter((r) => {
    // Tenant Isolation
    if (filter.workplaceId && r.workplaceId !== filter.workplaceId) return false;
    if (filter.employeeId && r.employeeId !== filter.employeeId) return false;
    if (filter.status && r.status !== filter.status) return false;
    return true;
  });

  const total = list.length;
  const requests = list.slice(skip, skip + limit);
  return { requests, total };
}

async function createLeave(data) {
  if (isMongoConnected()) {
    return await LeaveRequest.create(data);
  }
  const newL = { _id: `leave_${Date.now()}`, ...data, createdAt: new Date() };
  memoryStore.leaveRequests.unshift(newL);
  memoryStore.persist();
  return newL;
}

async function findLeaveById(id) {
  if (isMongoConnected()) {
    return await LeaveRequest.findById(id);
  }
  return memoryStore.leaveRequests.find((r) => String(r._id) === String(id)) || null;
}

// ----------------- AUDIT LOGS -----------------
async function logAudit(data) {
  if (isMongoConnected()) {
    try {
      return await AuditLog.create(data);
    } catch (e) {
      // safe ignore audit fail
    }
  }
  memoryStore.auditLogs.unshift({ _id: `audit_${Date.now()}`, timestamp: new Date(), ...data });
  memoryStore.persist();
}

// ----------------- FACE ENROLLMENTS -----------------
async function findFaceEnrollment(filter) {
  if (isMongoConnected()) {
    return await FaceEnrollment.findOne(filter);
  }
  return (
    memoryStore.faceEnrollments.find((e) => {
      if (filter.employeeId && e.employeeId !== filter.employeeId) return false;
      if (filter.workplaceId && e.workplaceId !== filter.workplaceId) return false;
      if (filter.enrollmentStatus && e.enrollmentStatus !== filter.enrollmentStatus) return false;
      return true;
    }) || null
  );
}

async function createFaceEnrollment(data) {
  if (isMongoConnected()) {
    return await FaceEnrollment.create(data);
  }
  const enr = {
    _id: `face_enr_${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data
  };
  memoryStore.faceEnrollments.push(enr);
  memoryStore.persist();
  return enr;
}

async function updateFaceEnrollment(filter, updates) {
  if (isMongoConnected()) {
    const doc = await FaceEnrollment.findOne(filter);
    if (doc) {
      Object.assign(doc, updates);
      await doc.save();
    }
    return doc;
  }
  const doc = await findFaceEnrollment(filter);
  if (doc) {
    Object.assign(doc, updates, { updatedAt: new Date() });
    memoryStore.persist();
  }
  return doc;
}

async function deleteFaceEnrollment(filter) {
  if (isMongoConnected()) {
    return await FaceEnrollment.deleteOne(filter);
  }
  const idx = memoryStore.faceEnrollments.findIndex((e) => {
    if (filter.employeeId && e.employeeId !== filter.employeeId) return false;
    if (filter.workplaceId && e.workplaceId !== filter.workplaceId) return false;
    return true;
  });
  if (idx !== -1) {
    memoryStore.faceEnrollments.splice(idx, 1);
    memoryStore.persist();
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
}

// In-memory verification token storage with 120s TTL
const verificationTokens = new Map();

function saveVerificationToken(tokenData) {
  const { referenceId, employeeId, workplaceId, expiresAt, similarityScore } = tokenData;
  verificationTokens.set(referenceId, {
    referenceId,
    employeeId,
    workplaceId,
    expiresAt: expiresAt || Date.now() + 120 * 1000,
    similarityScore,
    used: false
  });
  return tokenData;
}

function consumeVerificationToken(referenceId, employeeId) {
  if (!referenceId) return { valid: false, reason: 'Missing verification reference.' };
  const token = verificationTokens.get(referenceId);
  if (!token) {
    return { valid: false, reason: 'Verification reference not found or expired.' };
  }
  if (token.used) {
    return { valid: false, reason: 'Verification reference has already been consumed (replay prevention).' };
  }
  if (token.expiresAt < Date.now()) {
    verificationTokens.delete(referenceId);
    return { valid: false, reason: 'Verification reference has expired (120s limit).' };
  }
  if (employeeId && token.employeeId !== employeeId) {
    return { valid: false, reason: 'Verification reference does not belong to this employee.' };
  }
  token.used = true;
  return { valid: true, token };
}

module.exports = {
  isMongoConnected,
  // Workplaces
  findWorkplace,
  findWorkplaceById,
  createWorkplace,
  updateWorkplace,
  queryWorkplaces,
  countWorkplaces,
  // Memberships
  findMembership,
  findActiveMembership,
  createMembership,
  updateMembership,
  queryMemberships,
  countMemberships,
  // Users
  findUser,
  findUsers,
  createUser,
  updateUser,
  countUsers,
  // Devices
  findDevice,
  saveDevice,
  invalidateEmployeeDevices,
  // OTP
  createOtp,
  findLatestOtp,
  invalidateActiveOtps,
  createRegistrationOtp,
  findLatestRegistrationOtp,
  invalidateRegistrationOtps,
  // Geofence & Shift
  findGeofence,
  upsertGeofence,
  getCompanyShift,
  updateCompanyShift,
  // Attendance
  findActiveAttendance,
  createAttendance,
  queryAttendance,
  updateAttendanceRecord,
  // Leaves
  queryLeaves,
  createLeave,
  findLeaveById,
  // Face Enrollment & Biometric Verification
  findFaceEnrollment,
  createFaceEnrollment,
  updateFaceEnrollment,
  deleteFaceEnrollment,
  saveVerificationToken,
  consumeVerificationToken,
  // Audit
  logAudit,
  memoryStore
};
