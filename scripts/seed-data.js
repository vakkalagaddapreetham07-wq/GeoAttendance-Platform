/**
 * Database Seeding Script for Geofence Attendance Management System
 * Supports multi-tenant schema with safe baseline seeding:
 * - Workplaces
 * - Users (SuperAdmin, Admins, Core Demo Employees)
 * - Workplace Memberships
 * - Devices (Single-device binding)
 * - Geofences (Primary workplace boundaries)
 * - Attendance Records
 * - Leave Requests
 * - Face Enrollments
 * - Audit Logs
 */
const path = require('path');
const fs = require('fs');

const backendNodeModules = path.resolve(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('../backend/src/models/User');
const Workplace = require('../backend/src/models/Workplace');
const WorkplaceMembership = require('../backend/src/models/WorkplaceMembership');
const Device = require('../backend/src/models/Device');
const Geofence = require('../backend/src/models/Geofence');
const ShiftSchedule = require('../backend/src/models/ShiftSchedule');
const AttendanceRecord = require('../backend/src/models/AttendanceRecord');
const LeaveRequest = require('../backend/src/models/LeaveRequest');
const AuditLog = require('../backend/src/models/AuditLog');
const FaceEnrollment = require('../backend/src/models/FaceEnrollment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/geofence_attendance';
const LOCAL_STORE_PATH = path.resolve(__dirname, '../backend/data/local_store.json');

async function seed() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, dbName: 'geofence_attendance' });
    console.log('Connected to MongoDB successfully.');
  } catch (err) {
    console.error(`[ERROR] MongoDB connection failed: ${err.message}`);
    console.error('Seeding aborted. Ensure MONGODB_URI in backend/.env is reachable.');
    process.exit(1);
  }

  // Safety Guard: Check if target database already contains existing records
  const isForce = process.argv.includes('--force');
  const existingCounts = await Promise.all([
    Workplace.countDocuments(),
    User.countDocuments(),
    WorkplaceMembership.countDocuments(),
    Device.countDocuments(),
    Geofence.countDocuments(),
    ShiftSchedule.countDocuments(),
    AttendanceRecord.countDocuments(),
    LeaveRequest.countDocuments(),
    AuditLog.countDocuments(),
    FaceEnrollment.countDocuments()
  ]);

  const totalExisting = existingCounts.reduce((sum, count) => sum + count, 0);

  if (totalExisting > 0) {
    if (!isForce) {
      console.warn(`\n[ABORTED] Target database already contains ${totalExisting} records across collections.`);
      console.warn('Destructive operation blocked by safety guard to prevent accidental data loss.');
      console.warn('To override this safeguard and re-seed from scratch, supply the --force flag:');
      console.warn('  node scripts/seed-data.js --force\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`[SAFEGUARD] --force flag detected. Clearing ${totalExisting} existing records...`);
    await Promise.all([
      Workplace.deleteMany({}),
      User.deleteMany({}),
      WorkplaceMembership.deleteMany({}),
      Device.deleteMany({}),
      Geofence.deleteMany({}),
      ShiftSchedule.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      LeaveRequest.deleteMany({}),
      AuditLog.deleteMany({}),
      FaceEnrollment.deleteMany({})
    ]);
  } else {
    console.log('Target database is empty (0 existing records). Proceeding with initial seed...');
  }

  if (fs.existsSync(LOCAL_STORE_PATH)) {
    console.log(`Found persisted store dataset at ${LOCAL_STORE_PATH}. Preparing clean seed dataset...`);
    const store = JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf-8'));

    const clean = (arr) => (arr || []).map(item => {
      const copy = { ...item };
      delete copy._id;
      return copy;
    });

    // 1. Retain the four workplace profiles
    const retainedWorkplaces = clean(store.workplaces || []);
    const retainedWorkplaceIds = new Set(retainedWorkplaces.map(w => w.workplaceId));

    // 2. Identify required users:
    // Retain SuperAdmin, core Admins, core demo employees (EMP001-EMP005),
    // and any admin assigned to a retained workplace to preserve referential integrity (avoiding orphaned adminEmployeeId)
    const CORE_EMPLOYEE_IDS = new Set([
      'SUPERADMIN001',
      'ADMIN001',
      'ADMIN002',
      'ADMIN003',
      'EMP001',
      'EMP002',
      'EMP003',
      'EMP004',
      'EMP005'
    ]);

    for (const wp of retainedWorkplaces) {
      if (wp.adminEmployeeId) {
        CORE_EMPLOYEE_IDS.add(wp.adminEmployeeId);
      }
    }

    const retainedUsers = clean((store.users || []).filter(u => CORE_EMPLOYEE_IDS.has(u.employeeId)));
    const retainedUserIds = new Set(retainedUsers.map(u => u.employeeId));

    // 3. Workplace Memberships: retain only pairings between retained users and retained workplaces
    const retainedMemberships = clean(
      (store.workplaceMemberships || []).filter(m =>
        retainedUserIds.has(m.employeeId) && retainedWorkplaceIds.has(m.workplaceId)
      )
    );

    // 4. Devices: retain only devices registered to retained users
    const retainedDevices = clean(
      (store.devices || []).filter(d => retainedUserIds.has(d.employeeId))
    );

    // 5. Geofences: retain primary workplace geofences, avoiding duplicate test entries
    const seenGeofenceKeys = new Set();
    const retainedGeofences = clean(
      (store.geofences || []).filter(g => {
        if (!retainedWorkplaceIds.has(g.workplaceId)) return false;
        if (g.employeeId && !retainedUserIds.has(g.employeeId)) return false;
        if ((g.locationName || '').toLowerCase().includes('priya')) return false;
        const dedupKey = `${g.workplaceId}|${g.locationName || ''}`;
        if (seenGeofenceKeys.has(dedupKey)) return false;
        seenGeofenceKeys.add(dedupKey);
        return true;
      })
    );

    // 6. Attendance Records: retain records belonging to retained users and workplaces
    const retainedAttendance = clean(
      (store.attendanceRecords || []).filter(a =>
        retainedUserIds.has(a.employeeId) && (!a.workplaceId || retainedWorkplaceIds.has(a.workplaceId))
      )
    );

    // 7. Leave Requests: retain requests belonging to retained users and workplaces
    const retainedLeave = clean(
      (store.leaveRequests || []).filter(l =>
        retainedUserIds.has(l.employeeId) && (!l.workplaceId || retainedWorkplaceIds.has(l.workplaceId))
      )
    );

    // 8. Audit Logs: retain events concerning retained users, workplaces, or system actors
    const SYSTEM_ACTORS = new Set(['SYSTEM', 'SYSTEM_ADMIN', 'ANONYMOUS']);
    const retainedAudit = clean(
      (store.auditLogs || []).filter(l =>
        (!l.performedBy || retainedUserIds.has(l.performedBy) || SYSTEM_ACTORS.has(l.performedBy)) &&
        (!l.targetEmployeeId || retainedUserIds.has(l.targetEmployeeId)) &&
        (!l.workplaceId || retainedWorkplaceIds.has(l.workplaceId))
      )
    );

    // 9. Face Enrollments: retain enrollments belonging to retained users
    const retainedFaces = clean(
      (store.faceEnrollments || []).filter(f =>
        retainedUserIds.has(f.employeeId) && (!f.workplaceId || retainedWorkplaceIds.has(f.workplaceId))
      )
    );

    // Insert clean collections into MongoDB
    const resWp = retainedWorkplaces.length > 0 ? await Workplace.insertMany(retainedWorkplaces) : [];
    const resUsr = retainedUsers.length > 0 ? await User.insertMany(retainedUsers) : [];
    const resMb = retainedMemberships.length > 0 ? await WorkplaceMembership.insertMany(retainedMemberships) : [];
    const resDev = retainedDevices.length > 0 ? await Device.insertMany(retainedDevices) : [];
    const resGeo = retainedGeofences.length > 0 ? await Geofence.insertMany(retainedGeofences) : [];
    const resAtt = retainedAttendance.length > 0 ? await AttendanceRecord.insertMany(retainedAttendance) : [];
    const resLev = retainedLeave.length > 0 ? await LeaveRequest.insertMany(retainedLeave) : [];
    const resAud = retainedAudit.length > 0 ? await AuditLog.insertMany(retainedAudit) : [];
    const resFace = retainedFaces.length > 0 ? await FaceEnrollment.insertMany(retainedFaces) : [];

    console.log('\n================ SEEDING COMPLETED SUCCESSFULLY ================');
    console.log(`- Workplaces:          ${resWp.length}`);
    console.log(`- Users:                ${resUsr.length}`);
    console.log(`- Memberships:          ${resMb.length}`);
    console.log(`- Devices:              ${resDev.length}`);
    console.log(`- Geofences:            ${resGeo.length}`);
    console.log(`- Attendance Records:   ${resAtt.length}`);
    console.log(`- Leave Requests:       ${resLev.length}`);
    console.log(`- Audit Logs:           ${resAud.length}`);
    console.log(`- Face Enrollments:     ${resFace.length}`);
    console.log('=================================================================');
  } else {
    console.log('Generating minimal baseline seed records...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@12345', salt);
    const empPasswordHash = await bcrypt.hash('Emp@12345', salt);
    const superPasswordHash = await bcrypt.hash('SuperAdmin@12345', salt);

    await User.create({
      employeeId: 'SUPERADMIN001',
      name: 'Platform Super Administrator',
      email: 'superadmin@platform.local',
      passwordHash: superPasswordHash,
      role: 'superadmin',
      accountStatus: 'active'
    });

    const defaultWp = await Workplace.create({
      workplaceId: 'WP_ACME_001',
      name: 'Acme Tech Bangalore HQ',
      organizationName: 'Acme Technologies Pvt Ltd',
      category: 'IT & Software',
      address: { street: '100 Feet Road', city: 'Bangalore', state: 'Karnataka', country: 'India', postalCode: '560038' },
      contactEmail: 'contact@acmetech.local',
      contactPhone: '+91 98765 43210',
      adminEmployeeId: 'ADMIN001',
      adminName: 'Sarah Connor',
      verificationStatus: 'approved',
      geofence: { center: { latitude: 12.9715987, longitude: 77.5945627 }, radius: 50, locationName: 'Acme Tech Bangalore HQ' },
      shiftSchedule: { shiftStart: '09:00', shiftEnd: '18:00', gracePeriodMinutes: 15, timezone: 'Asia/Kolkata' },
      isActive: true
    });

    await User.create({
      employeeId: 'ADMIN001',
      name: 'Sarah Connor (HR Admin)',
      email: 'admin@attendance.local',
      passwordHash: adminPasswordHash,
      role: 'admin',
      department: 'Human Resources',
      assignedWorkplaceId: defaultWp.workplaceId,
      leaveBalance: { sick: 15, casual: 15, annual: 20 },
      accountStatus: 'active'
    });

    const employeesData = [
      { id: 'EMP001', name: 'Alice Smith', email: 'alice@company.local', dept: 'Engineering' },
      { id: 'EMP002', name: 'Bob Jones', email: 'bob@company.local', dept: 'Product' }
    ];

    for (const emp of employeesData) {
      await User.create({
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        passwordHash: empPasswordHash,
        role: 'employee',
        department: emp.dept,
        assignedWorkplaceId: defaultWp.workplaceId,
        accountStatus: 'active'
      });

      await WorkplaceMembership.create({
        employeeId: emp.id,
        workplaceId: defaultWp.workplaceId,
        status: 'approved',
        department: emp.dept,
        roleInWorkplace: 'employee'
      });
    }

    console.log('Minimal baseline seed complete.');
  }

  console.log('\nRetained Core Demo Accounts:');
  console.log('  🛡️ SuperAdmin:  SUPERADMIN001');
  console.log('  🏢 Admin:       ADMIN001 (Acme Tech Bangalore HQ)');
  console.log('  🏬 Admin:       ADMIN002 (Metro Retail Chennai Branch)');
  console.log('  🏥 Admin:       ADMIN003 (Apex Diagnostics Hyderabad)');
  console.log('  👤 Employee:    EMP001 (Alice Smith)');
  console.log('  👤 Employee:    EMP002 (Bob Jones)');
  console.log('  👤 Employee:    EMP003 (Charlie Brown)');
  console.log('  👤 Employee:    EMP004 (Diana Prince)');
  console.log('  👤 Employee:    EMP005 (Evan Wright)');
  console.log('=================================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = seed;
