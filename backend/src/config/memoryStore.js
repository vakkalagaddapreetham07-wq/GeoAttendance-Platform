/**
 * In-Memory Database Fallback for Zero-Dependency Evaluation & Local Testing
 * Activates seamlessly when external MongoDB instance is not connected.
 * Pre-seeded with SRS-compliant Multi-Tenant Platform data:
 * - 1 Platform Administrator (SUPERADMIN001 / SuperAdmin@12345)
 * - 2 Approved Active Workplaces:
 *     1. Acme Tech Bangalore HQ (WP_ACME_001, Admin: Sarah Connor / ADMIN001)
 *     2. Metro Retail Chennai Branch (WP_METRO_002, Admin: Marcus Vance / ADMIN002)
 * - 1 Pending Workplace Registration (WP_APEX_003, Admin: Dr. Evelyn Reed / ADMIN003) for review
 * - 5 Synthetic Employees with active/pending memberships
 * - Independent workplace geofences & radius (50m, 75m)
 * - Workplace-scoped historical normal & anomalous attendance sessions
 * - Workplace-scoped leave requests & single-device bindings
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { encryptEmbedding } = require('../utils/biometricCrypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'local_store.json');

// Bangalore HQ Coordinates
const BANGALORE_LAT = 12.9715987;
const BANGALORE_LON = 77.5945627;

// Chennai Branch Coordinates
const CHENNAI_LAT = 13.0826802;
const CHENNAI_LON = 80.2707184;

// Hyderabad Lab Coordinates
const HYDERABAD_LAT = 17.4435;
const HYDERABAD_LON = 78.3772;

// Pre-computed bcrypt hashes
const SUPERADMIN_HASH = bcrypt.hashSync('SuperAdmin@12345', 10);
const ADMIN_HASH = bcrypt.hashSync('Admin@12345', 10);
const EMP_HASH = bcrypt.hashSync('Emp@12345', 10);

class MemoryStore {
  constructor() {
    this.reset();
    this.loadFromDisk();
  }

  reset() {
    // ------------------- WORKPLACES -------------------
    this.workplaces = [
      {
        _id: 'wp_acme_1',
        workplaceId: 'WP_ACME_001',
        name: 'Acme Tech Bangalore HQ',
        organizationName: 'Acme Technologies Pvt Ltd',
        category: 'IT & Software',
        address: {
          street: '100 Feet Road, Indiranagar',
          city: 'Bangalore',
          region: 'South',
          state: 'Karnataka',
          country: 'India',
          postalCode: '560038'
        },
        contactEmail: 'contact@acmetech.local',
        contactPhone: '+91 98765 43210',
        adminEmployeeId: 'ADMIN001',
        adminName: 'Sarah Connor',
        verificationStatus: 'approved',
        verificationNote: 'Corporate registration verified via CIN/GSTIN.',
        reviewedBy: 'SUPERADMIN001',
        reviewedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        geofence: {
          center: { latitude: BANGALORE_LAT, longitude: BANGALORE_LON },
          radius: 50,
          locationName: 'Acme Tech Bangalore HQ'
        },
        shiftSchedule: {
          shiftStart: '09:00',
          shiftEnd: '18:00',
          gracePeriodMinutes: 15,
          timezone: 'Asia/Kolkata'
        },
        isActive: true,
        adminReplacementRequest: {
          hasPendingRequest: false,
          newAdminEmployeeId: null,
          newAdminName: null,
          newAdminEmail: null,
          reason: '',
          requestedAt: null,
          reviewedAt: null,
          status: 'none'
        },
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      },
      {
        _id: 'wp_metro_2',
        workplaceId: 'WP_METRO_002',
        name: 'Metro Retail Chennai Branch',
        organizationName: 'Metro Retail & Consumer Goods',
        category: 'Retail & Commerce',
        address: {
          street: 'Anna Salai, Mount Road',
          city: 'Chennai',
          region: 'Central',
          state: 'Tamil Nadu',
          country: 'India',
          postalCode: '600002'
        },
        contactEmail: 'store@metroretail.local',
        contactPhone: '+91 91234 56789',
        adminEmployeeId: 'ADMIN002',
        adminName: 'Marcus Vance',
        verificationStatus: 'approved',
        verificationNote: 'Commercial lease and shop act registration verified.',
        reviewedBy: 'SUPERADMIN001',
        reviewedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        geofence: {
          center: { latitude: CHENNAI_LAT, longitude: CHENNAI_LON },
          radius: 75,
          locationName: 'Metro Retail Flagship Store'
        },
        shiftSchedule: {
          shiftStart: '10:00',
          shiftEnd: '19:00',
          gracePeriodMinutes: 15,
          timezone: 'Asia/Kolkata'
        },
        isActive: true,
        adminReplacementRequest: {
          hasPendingRequest: false,
          newAdminEmployeeId: null,
          newAdminName: null,
          newAdminEmail: null,
          reason: '',
          requestedAt: null,
          reviewedAt: null,
          status: 'none'
        },
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      },
      {
        _id: 'wp_apex_3',
        workplaceId: 'WP_APEX_003',
        name: 'Apex Diagnostics Hyderabad',
        organizationName: 'Apex Healthcare Ltd',
        category: 'Healthcare & Clinics',
        address: {
          street: 'HITEC City, Madhapur',
          city: 'Hyderabad',
          region: 'Cyberabad',
          state: 'Telangana',
          country: 'India',
          postalCode: '500081'
        },
        contactEmail: 'info@apexdiag.local',
        contactPhone: '+91 99887 76655',
        adminEmployeeId: 'ADMIN003',
        adminName: 'Dr. Evelyn Reed',
        verificationStatus: 'pending', // Pending approval for platform admin demo
        verificationNote: 'Pending review of clinical establishment license.',
        reviewedBy: null,
        reviewedAt: null,
        geofence: {
          center: { latitude: HYDERABAD_LAT, longitude: HYDERABAD_LON },
          radius: 60,
          locationName: 'Apex Diagnostic Lab'
        },
        shiftSchedule: {
          shiftStart: '08:30',
          shiftEnd: '17:30',
          gracePeriodMinutes: 10,
          timezone: 'Asia/Kolkata'
        },
        isActive: true,
        adminReplacementRequest: {
          hasPendingRequest: false,
          newAdminEmployeeId: null,
          newAdminName: null,
          newAdminEmail: null,
          reason: '',
          requestedAt: null,
          reviewedAt: null,
          status: 'none'
        },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    ];

    // ------------------- USERS -------------------
    this.users = [
      // Platform SuperAdmin
      {
        _id: 'user_superadmin',
        employeeId: 'SUPERADMIN001',
        name: 'Platform Super Administrator',
        email: 'superadmin@platform.local',
        passwordHash: SUPERADMIN_HASH,
        role: 'superadmin',
        mobileNumber: '+91 99999 00000',
        isMobileVerified: true,
        assignedWorkplaceId: null,
        department: 'Platform Governance',
        leaveBalance: { sick: 20, casual: 20, annual: 30 },
        accountStatus: 'active'
      },
      // Workplace 1 Administrator (Acme Tech)
      {
        _id: 'user_admin_acme',
        employeeId: 'ADMIN001',
        name: 'Sarah Connor (HR Admin)',
        email: 'admin@attendance.local',
        passwordHash: ADMIN_HASH,
        role: 'admin',
        mobileNumber: '+91 98765 00001',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_ACME_001',
        department: 'Human Resources',
        leaveBalance: { sick: 15, casual: 15, annual: 20 },
        accountStatus: 'active'
      },
      // Workplace 2 Administrator (Metro Retail)
      {
        _id: 'user_admin_metro',
        employeeId: 'ADMIN002',
        name: 'Marcus Vance (Store Manager)',
        email: 'admin@metroretail.local',
        passwordHash: ADMIN_HASH,
        role: 'admin',
        mobileNumber: '+91 91234 00002',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_METRO_002',
        department: 'Store Management',
        leaveBalance: { sick: 15, casual: 15, annual: 20 },
        accountStatus: 'active'
      },
      // Workplace 3 Administrator (Apex Diagnostics - Pending)
      {
        _id: 'user_admin_apex',
        employeeId: 'ADMIN003',
        name: 'Dr. Evelyn Reed (Medical Director)',
        email: 'evelyn@apexdiag.local',
        passwordHash: ADMIN_HASH,
        role: 'admin',
        mobileNumber: '+91 99887 00003',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_APEX_003',
        department: 'Administration',
        leaveBalance: { sick: 15, casual: 15, annual: 20 },
        accountStatus: 'active'
      },
      // Employees
      {
        _id: 'user_emp1',
        employeeId: 'EMP001',
        name: 'Alice Smith',
        email: 'alice@company.local',
        passwordHash: EMP_HASH,
        role: 'employee',
        mobileNumber: '+91 90000 00001',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_ACME_001',
        department: 'Engineering',
        leaveBalance: { sick: 10, casual: 12, annual: 15 },
        accountStatus: 'active'
      },
      {
        _id: 'user_emp2',
        employeeId: 'EMP002',
        name: 'Bob Jones',
        email: 'bob@company.local',
        passwordHash: EMP_HASH,
        role: 'employee',
        mobileNumber: '+91 90000 00002',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_ACME_001',
        department: 'Product',
        leaveBalance: { sick: 10, casual: 12, annual: 15 },
        accountStatus: 'active'
      },
      {
        _id: 'user_emp3',
        employeeId: 'EMP003',
        name: 'Charlie Brown',
        email: 'charlie@company.local',
        passwordHash: EMP_HASH,
        role: 'employee',
        mobileNumber: '+91 90000 00003',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_METRO_002',
        department: 'Inventory & Sales',
        leaveBalance: { sick: 10, casual: 12, annual: 15 },
        accountStatus: 'active'
      },
      {
        _id: 'user_emp4',
        employeeId: 'EMP004',
        name: 'Diana Prince',
        email: 'diana@company.local',
        passwordHash: EMP_HASH,
        role: 'employee',
        mobileNumber: '+91 90000 00004',
        isMobileVerified: true,
        assignedWorkplaceId: 'WP_METRO_002',
        department: 'Logistics',
        leaveBalance: { sick: 10, casual: 12, annual: 15 },
        accountStatus: 'active'
      },
      {
        _id: 'user_emp5',
        employeeId: 'EMP005',
        name: 'Evan Wright',
        email: 'evan@company.local',
        passwordHash: EMP_HASH,
        role: 'employee',
        mobileNumber: '+91 90000 00005',
        isMobileVerified: true,
        assignedWorkplaceId: null, // Pending membership request demo!
        department: 'Customer Support',
        leaveBalance: { sick: 10, casual: 12, annual: 15 },
        accountStatus: 'active'
      }
    ];

    // ------------------- WORKPLACE MEMBERSHIPS -------------------
    this.workplaceMemberships = [
      {
        _id: 'mem_emp1_acme',
        employeeId: 'EMP001',
        workplaceId: 'WP_ACME_001',
        status: 'approved',
        joinRequestedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
        reviewedBy: 'ADMIN001',
        rejectionReason: '',
        roleInWorkplace: 'Software Engineer',
        department: 'Engineering',
        startDate: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
        endDate: null
      },
      {
        _id: 'mem_emp2_acme',
        employeeId: 'EMP002',
        workplaceId: 'WP_ACME_001',
        status: 'approved',
        joinRequestedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
        reviewedBy: 'ADMIN001',
        rejectionReason: '',
        roleInWorkplace: 'Product Manager',
        department: 'Product',
        startDate: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
        endDate: null
      },
      {
        _id: 'mem_emp3_metro',
        employeeId: 'EMP003',
        workplaceId: 'WP_METRO_002',
        status: 'approved',
        joinRequestedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        reviewedBy: 'ADMIN002',
        rejectionReason: '',
        roleInWorkplace: 'Store Associate',
        department: 'Inventory & Sales',
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: null
      },
      {
        _id: 'mem_emp4_metro',
        employeeId: 'EMP004',
        workplaceId: 'WP_METRO_002',
        status: 'approved',
        joinRequestedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
        reviewedBy: 'ADMIN002',
        rejectionReason: '',
        roleInWorkplace: 'Logistics Coordinator',
        department: 'Logistics',
        startDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
        endDate: null
      },
      {
        _id: 'mem_emp5_pending',
        employeeId: 'EMP005',
        workplaceId: 'WP_ACME_001',
        status: 'pending', // Pending request awaiting Sarah Connor's approval!
        joinRequestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: '',
        roleInWorkplace: 'Support Specialist',
        department: 'Customer Support',
        startDate: null,
        endDate: null
      }
    ];

    // ------------------- GEOFENCES -------------------
    this.geofences = [
      {
        _id: 'geo_wp_acme',
        workplaceId: 'WP_ACME_001',
        employeeId: null, // Workplace-level geofence
        center: { latitude: BANGALORE_LAT, longitude: BANGALORE_LON },
        radius: 50,
        locationName: 'Acme Tech Bangalore HQ',
        configuredBy: 'ADMIN001',
        isActive: true
      },
      {
        _id: 'geo_wp_metro',
        workplaceId: 'WP_METRO_002',
        employeeId: null, // Workplace-level geofence
        center: { latitude: CHENNAI_LAT, longitude: CHENNAI_LON },
        radius: 75,
        locationName: 'Metro Retail Flagship Store',
        configuredBy: 'ADMIN002',
        isActive: true
      },
      {
        _id: 'geo_wp_apex',
        workplaceId: 'WP_APEX_003',
        employeeId: null,
        center: { latitude: HYDERABAD_LAT, longitude: HYDERABAD_LON },
        radius: 60,
        locationName: 'Apex Diagnostic Lab',
        configuredBy: 'ADMIN003',
        isActive: true
      }
    ];

    // ------------------- DEVICES -------------------
    this.devices = [
      {
        _id: 'device_emp1',
        workplaceId: 'WP_ACME_001',
        employeeId: 'EMP001',
        deviceId: 'DEVICE_UUID_EMP001_2026',
        deviceModel: 'Samsung Galaxy S23 (SM-S911B)',
        osVersion: 'Android 14 (API 34)',
        isBound: true,
        registeredAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
        revokedAt: null
      },
      {
        _id: 'device_emp2',
        workplaceId: 'WP_ACME_001',
        employeeId: 'EMP002',
        deviceId: 'DEVICE_UUID_EMP002_2026',
        deviceModel: 'Google Pixel 8 Pro',
        osVersion: 'Android 14 (API 34)',
        isBound: true,
        registeredAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
        revokedAt: null
      },
      {
        _id: 'device_emp3',
        workplaceId: 'WP_METRO_002',
        employeeId: 'EMP003',
        deviceId: 'DEVICE_UUID_EMP003_2026',
        deviceModel: 'OnePlus 11 5G',
        osVersion: 'Android 14 (API 34)',
        isBound: true,
        registeredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
        revokedAt: null
      },
      {
        _id: 'device_emp4',
        workplaceId: 'WP_METRO_002',
        employeeId: 'EMP004',
        deviceId: 'DEVICE_UUID_EMP004_2026',
        deviceModel: 'Xiaomi 13 Pro',
        osVersion: 'Android 13 (API 33)',
        isBound: true,
        registeredAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
        revokedAt: null
      }
    ];

    // ------------------- ATTENDANCE RECORDS -------------------
    this.attendanceRecords = [];
    this.seedHistoricalAttendance();

    // ------------------- LEAVE REQUESTS -------------------
    this.leaveRequests = [
      {
        _id: 'leave_alice_1',
        workplaceId: 'WP_ACME_001',
        employeeId: 'EMP001',
        leaveType: 'casual',
        startDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        daysCount: 2,
        reason: 'Attending regional technical seminar',
        status: 'pending',
        reviewedBy: null,
        decisionTimestamp: null,
        decisionNote: '',
        createdAt: new Date()
      },
      {
        _id: 'leave_charlie_1',
        workplaceId: 'WP_METRO_002',
        employeeId: 'EMP003',
        leaveType: 'sick',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        daysCount: 2,
        reason: 'Viral fever rest prescription',
        status: 'approved',
        reviewedBy: 'ADMIN002',
        decisionTimestamp: new Date(),
        decisionNote: 'Get well soon, approved.',
        createdAt: new Date()
      }
    ];

    this.otpRecords = [];
    this.auditLogs = [];

    // ------------------- FACE ENROLLMENTS & VERIFICATION -------------------
    this.faceEnrollments = [];
    this.faceVerificationTokens = new Map();
    // Do not pre-seed with synthetic mathematical vectors so real camera faces can enroll cleanly
  }

  seedFaceEnrollments() {
    const demoEmployees = [
      { employeeId: 'EMP001', workplaceId: 'WP_ACME_001', seedVal: 1.1 },
      { employeeId: 'EMP002', workplaceId: 'WP_ACME_001', seedVal: 2.2 },
      { employeeId: 'EMP003', workplaceId: 'WP_METRO_002', seedVal: 3.3 },
      { employeeId: 'EMP004', workplaceId: 'WP_METRO_002', seedVal: 4.4 }
    ];

    demoEmployees.forEach(({ employeeId, workplaceId, seedVal }) => {
      // Deterministic 128-dim normalized embedding
      const vector = [];
      let norm = 0;
      for (let i = 0; i < 128; i++) {
        const val = Math.sin(seedVal + i * 0.17) * Math.cos(seedVal * 0.3 + i * 0.05);
        vector.push(val);
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1.0;
      const normalizedVector = vector.map(v => Number((v / norm).toFixed(6)));

      const protectedEmbedding = encryptEmbedding(normalizedVector);

      this.faceEnrollments.push({
        _id: `face_enr_${employeeId.toLowerCase()}`,
        employeeId,
        workplaceId,
        enrollmentStatus: 'enrolled',
        protectedEmbedding,
        modelName: 'opencv_sface_yunet',
        modelVersion: '1.0.0',
        consentGiven: true,
        consentVersion: 'v1.0',
        consentTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        consentStatement: 'I consent to biometric face verification solely for work attendance identity validation and fraud prevention.',
        qualityMetrics: {
          sharpness: 82.5,
          brightness: 64.2,
          confidence: 0.98
        },
        auditLog: [
          {
            action: 'enrolled',
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            similarityScore: 1.0,
            ip: '127.0.0.1',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            details: 'Initial biometric enrollment during onboarding.'
          }
        ],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      });
    });
  }

  seedHistoricalAttendance() {
    const today = new Date();

    // Seed 14 days of historical attendance for Acme Tech (EMP001, EMP002)
    for (let d = 14; d >= 1; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];

      // EMP001 (Alice) - Acme Tech
      const inTime1 = new Date(date);
      inTime1.setHours(8, 55, 0, 0);
      const outTime1 = new Date(date);
      outTime1.setHours(18, 10, 0, 0);
      const dur1 = Math.round((outTime1 - inTime1) / (1000 * 60));

      this.attendanceRecords.push({
        _id: `att_emp1_${dateStr}`,
        workplaceId: 'WP_ACME_001',
        employeeId: 'EMP001',
        deviceId: 'DEVICE_UUID_EMP001_2026',
        attendanceDate: dateStr,
        checkIn: {
          timestamp: inTime1,
          latitude: BANGALORE_LAT + 0.00008,
          longitude: BANGALORE_LON + 0.00005,
          accuracy: 8.5,
          distanceToCenter: 12.4
        },
        checkOut: {
          timestamp: outTime1,
          latitude: BANGALORE_LAT + 0.00005,
          longitude: BANGALORE_LON + 0.00002,
          accuracy: 9.0,
          distanceToCenter: 8.7
        },
        durationMinutes: dur1,
        status: 'completed',
        geofenceCenter: { latitude: BANGALORE_LAT, longitude: BANGALORE_LON, radius: 50 },
        anomaly: {
          isAnomaly: false,
          score: 0.22,
          mlScore: 0.22,
          mlPrediction: 1,
          detectionSource: 'none',
          hardRuleViolations: [],
          features: { checkInDeviation: -5, checkOutDeviation: 10, geofenceDuration: dur1, distanceFromCenter: 12.4 },
          reviewStatus: 'resolved',
          explanation: 'Normal punctual attendance pattern consistent with shift schedule.',
          assessedAt: outTime1
        }
      });

      // EMP002 (Bob) - Acme Tech (Occasional Anomaly on day 4)
      const inTime2 = new Date(date);
      const isShortSession = d === 4;
      inTime2.setHours(9, 10, 0, 0);
      const outTime2 = new Date(date);
      if (isShortSession) {
        outTime2.setHours(9, 32, 0, 0);
      } else {
        outTime2.setHours(18, 5, 0, 0);
      }
      const dur2 = Math.round((outTime2 - inTime2) / (1000 * 60));

      this.attendanceRecords.push({
        _id: `att_emp2_${dateStr}`,
        workplaceId: 'WP_ACME_001',
        employeeId: 'EMP002',
        deviceId: 'DEVICE_UUID_EMP002_2026',
        attendanceDate: dateStr,
        checkIn: {
          timestamp: inTime2,
          latitude: BANGALORE_LAT + 0.00015,
          longitude: BANGALORE_LON + 0.0001,
          accuracy: 10.0,
          distanceToCenter: 21.0
        },
        checkOut: {
          timestamp: outTime2,
          latitude: BANGALORE_LAT + 0.00012,
          longitude: BANGALORE_LON + 0.00008,
          accuracy: 9.5,
          distanceToCenter: 17.5
        },
        durationMinutes: dur2,
        status: 'completed',
        geofenceCenter: { latitude: BANGALORE_LAT, longitude: BANGALORE_LON, radius: 50 },
        anomaly: {
          isAnomaly: isShortSession,
          score: isShortSession ? 0.88 : 0.25,
          mlScore: isShortSession ? 0.88 : 0.25,
          mlPrediction: isShortSession ? -1 : 1,
          detectionSource: isShortSession ? 'both' : 'none',
          hardRuleViolations: isShortSession ? ['Duration below 30 minutes threshold (SRS Hard Rule)'] : [],
          features: { checkInDeviation: 10, checkOutDeviation: isShortSession ? -515 : 5, geofenceDuration: dur2, distanceFromCenter: 21.0 },
          reviewStatus: isShortSession ? 'pending' : 'resolved',
          explanation: isShortSession ? 'Flagged by both ML Model (Score: 0.88) and Hard Rule: Duration under 30 minutes.' : 'Punctual attendance.',
          assessedAt: outTime2
        }
      });

      // Seed Metro Retail (EMP003, EMP004)
      if (d <= 10) {
        const inTime3 = new Date(date);
        inTime3.setHours(9, 58, 0, 0);
        const outTime3 = new Date(date);
        outTime3.setHours(19, 12, 0, 0);
        const dur3 = Math.round((outTime3 - inTime3) / (1000 * 60));

        this.attendanceRecords.push({
          _id: `att_emp3_${dateStr}`,
          workplaceId: 'WP_METRO_002',
          employeeId: 'EMP003',
          deviceId: 'DEVICE_UUID_EMP003_2026',
          attendanceDate: dateStr,
          checkIn: {
            timestamp: inTime3,
            latitude: CHENNAI_LAT + 0.0001,
            longitude: CHENNAI_LON + 0.0001,
            accuracy: 9.0,
            distanceToCenter: 15.0
          },
          checkOut: {
            timestamp: outTime3,
            latitude: CHENNAI_LAT + 0.00008,
            longitude: CHENNAI_LON + 0.00008,
            accuracy: 8.5,
            distanceToCenter: 12.0
          },
          durationMinutes: dur3,
          status: 'completed',
          geofenceCenter: { latitude: CHENNAI_LAT, longitude: CHENNAI_LON, radius: 75 },
          anomaly: {
            isAnomaly: false,
            score: 0.19,
            mlScore: 0.19,
            mlPrediction: 1,
            detectionSource: 'none',
            hardRuleViolations: [],
            features: { checkInDeviation: -2, checkOutDeviation: 12, geofenceDuration: dur3, distanceFromCenter: 15.0 },
            reviewStatus: 'resolved',
            explanation: 'On-time store attendance session.',
            assessedAt: outTime3
          }
        });
      }
    }
  }

  persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const snapshot = {
        workplaces: this.workplaces,
        users: this.users,
        workplaceMemberships: this.workplaceMemberships,
        geofences: this.geofences,
        devices: this.devices,
        attendanceRecords: this.attendanceRecords,
        leaveRequests: this.leaveRequests,
        auditLogs: this.auditLogs,
        faceEnrollments: this.faceEnrollments
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MemoryStore] Failed to persist data to disk:', err);
    }
  }

  loadFromDisk() {
    try {
      if (!fs.existsSync(STORE_FILE)) {
        return false;
      }
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      if (!raw || !raw.trim()) return false;
      const data = JSON.parse(raw);

      // Merge workplaces: keep disk versions, append any missing seed workplaces
      if (Array.isArray(data.workplaces)) {
        const diskWpMap = new Map(data.workplaces.map((w) => [w.workplaceId, w]));
        this.workplaces.forEach((seedWp) => {
          if (!diskWpMap.has(seedWp.workplaceId)) {
            data.workplaces.push(seedWp);
          }
        });
        this.workplaces = data.workplaces;
      }

      // Merge users: keep disk versions, append any missing seed users
      if (Array.isArray(data.users)) {
        const diskUserMap = new Map(data.users.map((u) => [u.employeeId, u]));
        this.users.forEach((seedUser) => {
          if (!diskUserMap.has(seedUser.employeeId)) {
            data.users.push(seedUser);
          }
        });
        this.users = data.users;
      }

      // Merge workplaceMemberships
      if (Array.isArray(data.workplaceMemberships)) {
        const diskMemMap = new Map(
          data.workplaceMemberships.map((m) => [m._id || `${m.employeeId}_${m.workplaceId}`, m])
        );
        this.workplaceMemberships.forEach((seedMem) => {
          const key = seedMem._id || `${seedMem.employeeId}_${seedMem.workplaceId}`;
          if (!diskMemMap.has(key)) {
            data.workplaceMemberships.push(seedMem);
          }
        });
        this.workplaceMemberships = data.workplaceMemberships;
      }

      // Merge geofences
      if (Array.isArray(data.geofences)) {
        const diskGeoMap = new Map(
          data.geofences.map((g) => [g._id || `${g.workplaceId}_${g.employeeId}`, g])
        );
        this.geofences.forEach((seedGeo) => {
          const key = seedGeo._id || `${seedGeo.workplaceId}_${seedGeo.employeeId}`;
          if (!diskGeoMap.has(key)) {
            data.geofences.push(seedGeo);
          }
        });
        this.geofences = data.geofences;
      }

      // Merge devices
      if (Array.isArray(data.devices)) {
        const diskDevMap = new Map(data.devices.map((d) => [d.deviceId || d._id, d]));
        this.devices.forEach((seedDev) => {
          const key = seedDev.deviceId || seedDev._id;
          if (!diskDevMap.has(key)) {
            data.devices.push(seedDev);
          }
        });
        this.devices = data.devices;
      }

      // Merge attendance records
      if (Array.isArray(data.attendanceRecords)) {
        const diskAttMap = new Map(data.attendanceRecords.map((a) => [a._id, a]));
        this.attendanceRecords.forEach((seedAtt) => {
          if (!diskAttMap.has(seedAtt._id)) {
            data.attendanceRecords.push(seedAtt);
          }
        });
        this.attendanceRecords = data.attendanceRecords;
      }

      // Merge leave requests
      if (Array.isArray(data.leaveRequests)) {
        const diskLeaveMap = new Map(data.leaveRequests.map((l) => [l._id, l]));
        this.leaveRequests.forEach((seedLeave) => {
          if (!diskLeaveMap.has(seedLeave._id)) {
            data.leaveRequests.push(seedLeave);
          }
        });
        this.leaveRequests = data.leaveRequests;
      }

      // Merge audit logs
      if (Array.isArray(data.auditLogs)) {
        this.auditLogs = data.auditLogs;
      }

      // Merge face enrollments
      if (Array.isArray(data.faceEnrollments)) {
        const diskFaceMap = new Map(data.faceEnrollments.map((f) => [f.employeeId, f]));
        this.faceEnrollments.forEach((seedFace) => {
          if (!diskFaceMap.has(seedFace.employeeId)) {
            data.faceEnrollments.push(seedFace);
          }
        });
        this.faceEnrollments = data.faceEnrollments;
      }

      console.log(`[MemoryStore] Loaded persisted local data from ${STORE_FILE}`);
      return true;
    } catch (err) {
      console.error('[MemoryStore] Failed to load persisted data from disk:', err);
      return false;
    }
  }
}

const memoryStore = new MemoryStore();
module.exports = memoryStore;
