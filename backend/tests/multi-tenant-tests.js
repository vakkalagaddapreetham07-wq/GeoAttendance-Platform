/**
 * Automated Multi-Tenant Architecture & Platform Verification Test Suite
 * Tests:
 * 1. Public Workplace Registration
 * 2. Platform SuperAdmin Governance (All workplaces, approvals, suspensions, summary)
 * 3. Tenant Isolation (Workplace A vs Workplace B data scoping, admin boundaries)
 * 4. Workplace Membership Lifecycle (Request, Review, Approval, Roster)
 * 5. Geofence Attendance Gating (Unapproved blocked, inside/outside radius)
 * 6. Leave Management Scoping (Tenant-isolated leave requests & approvals)
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  MULTI-TENANT ATTENDANCE PLATFORM TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: Authentication & Seed Accounts
    // -----------------------------------------------------------------
    console.log('[1] Testing Authentication for 3 Account Roles...');

    // SuperAdmin Login
    const superRes = await request('POST', '/auth/login', {
      identifier: 'SUPERADMIN001',
      password: 'SuperAdmin@12345'
    });
    assert(superRes.status === 200 && superRes.body.token, 'SuperAdmin login successful');
    const superToken = superRes.body.token;

    // Workplace Admin 1 (Acme Tech) Login
    const admin1Res = await request('POST', '/auth/login', {
      identifier: 'ADMIN001',
      password: 'Admin@12345'
    });
    assert(admin1Res.status === 200 && admin1Res.body.token, 'Workplace Admin 1 (Acme Tech) login successful');
    const admin1Token = admin1Res.body.token;

    // Workplace Admin 2 (Metro Retail) Login
    const admin2Res = await request('POST', '/auth/login', {
      identifier: 'ADMIN002',
      password: 'Admin@12345'
    });
    assert(admin2Res.status === 200 && admin2Res.body.token, 'Workplace Admin 2 (Metro Retail) login successful');
    const admin2Token = admin2Res.body.token;

    // Employee (Alice - Acme) Login
    const emp1Res = await request('POST', '/auth/login', {
      identifier: 'EMP001',
      password: 'Emp@12345'
    });
    assert(emp1Res.status === 200 && emp1Res.body.token, 'Employee (Alice - Acme) login successful');
    const emp1Token = emp1Res.body.token;

    // -----------------------------------------------------------------
    // TEST 2: Public Workplace Registration Flow
    // -----------------------------------------------------------------
    console.log('\n[2] Testing Public Workplace Registration...');
    const testWpId = `WP_TEST_${Date.now().toString().slice(-4)}`;
    const regRes = await request('POST', '/workplaces/register', {
      name: `Zenith AI Labs ${testWpId}`,
      organizationName: 'Zenith Global Technologies',
      category: 'it_tech',
      address: {
        street: '45 Tech Boulevard',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        postalCode: '500081'
      },
      contactEmail: `contact_${testWpId.toLowerCase()}@zenith.local`,
      contactPhone: '+91 99887 76655',
      geofence: {
        center: { latitude: 17.4447, longitude: 78.3789 },
        radius: 60,
        locationName: 'Zenith Cyber Gateway'
      },
      shiftSchedule: {
        shiftStart: '10:00',
        shiftEnd: '19:00',
        gracePeriodMinutes: 20
      },
      admin: {
        name: 'Dr. Vikram Zenith',
        email: `admin_${testWpId.toLowerCase()}@zenith.local`,
        mobileNumber: '+91 99887 76655',
        password: 'Password@12345'
      }
    });

    assert(regRes.status === 201 && regRes.body.success, 'Workplace registered successfully with status 201');
    assert(regRes.body.workplace.verificationStatus === 'pending', 'New workplace initialized in "pending" status');
    assert(regRes.body.workplace.geofence.radius === 60, 'Workplace geofence radius recorded accurately');
    const createdWpId = regRes.body.workplace.workplaceId;

    // -----------------------------------------------------------------
    // TEST 3: Platform SuperAdmin Governance
    // -----------------------------------------------------------------
    console.log('\n[3] Testing Platform SuperAdmin Governance...');

    // SuperAdmin views summary
    const platSumRes = await request('GET', '/workplaces/platform/dashboard-summary', null, superToken);
    assert(platSumRes.status === 200 && platSumRes.body.summary, 'SuperAdmin can fetch platform-wide metrics');
    assert(platSumRes.body.summary.totalWorkplaces >= 3, 'Platform metrics accurately aggregate registered workplaces');

    // SuperAdmin lists all workplaces
    const platAllRes = await request('GET', '/workplaces/platform/all', null, superToken);
    assert(platAllRes.status === 200 && Array.isArray(platAllRes.body.workplaces), 'SuperAdmin can list all registered tenants');

    // SuperAdmin approves the new workplace
    const reviewRes = await request('PUT', `/workplaces/platform/${createdWpId}/review`, {
      status: 'approved',
      notes: 'Verification verified and business documents approved.'
    }, superToken);
    assert(reviewRes.status === 200 && reviewRes.body.workplace.verificationStatus === 'approved', 'SuperAdmin can approve pending workplace');

    // Non-SuperAdmin blocked from platform endpoints
    const forbiddenRes = await request('GET', '/workplaces/platform/all', null, admin1Token);
    assert(forbiddenRes.status === 403, 'Workplace Admin blocked with 403 from Platform SuperAdmin endpoints');

    // -----------------------------------------------------------------
    // TEST 4: Tenant Isolation & Administrative Boundaries
    // -----------------------------------------------------------------
    console.log('\n[4] Testing Strict Multi-Tenant Isolation...');

    // Admin 1 (Acme Tech) accesses their own workplace
    const myWpRes = await request('GET', '/workplaces/my-workplace', null, admin1Token);
    assert(myWpRes.status === 200 && myWpRes.body.workplace.workplaceId === 'WP_ACME_001', 'Admin 1 scoped to Acme Tech (WP_ACME_001)');

    // Admin 2 (Metro Retail) accesses their own workplace
    const myWp2Res = await request('GET', '/workplaces/my-workplace', null, admin2Token);
    assert(myWp2Res.status === 200 && myWp2Res.body.workplace.workplaceId === 'WP_METRO_002', 'Admin 2 scoped to Metro Retail (WP_METRO_002)');

    // Admin 1 updates shift schedule for Acme Tech
    const updateShiftRes = await request('PUT', '/attendance/shift-schedule', {
      shiftStart: '08:45',
      shiftEnd: '17:45',
      gracePeriodMinutes: 10
    }, admin1Token);
    assert(updateShiftRes.status === 200 && updateShiftRes.body.schedule.shiftStart === '08:45', 'Admin 1 successfully updated Acme Tech shift schedule');

    // Verify Metro Retail schedule remains untouched (Isolation)
    const metroShiftRes = await request('GET', '/attendance/shift-schedule', null, admin2Token);
    assert(metroShiftRes.status === 200 && metroShiftRes.body.schedule.shiftStart === '10:00', 'Metro Retail shift schedule unaffected by Acme Tech changes');

    // Admin 1 dashboard query only returns Acme Tech attendance records
    const admin1Records = await request('GET', '/analytics/attendance-records', null, admin1Token);
    assert(admin1Records.status === 200, 'Admin 1 attendance records retrieved');
    const allAcme = admin1Records.body.records.every((r) => r.workplaceId === 'WP_ACME_001');
    assert(allAcme, 'Tenant Isolation: Admin 1 only sees Acme Tech attendance records');

    // -----------------------------------------------------------------
    // TEST 5: Workplace Membership Lifecycle
    // -----------------------------------------------------------------
    console.log('\n[5] Testing Workplace Membership Lifecycle...');

    // Register a fresh test employee
    const newEmpId = `EMP_TEST_${Date.now().toString().slice(-4)}`;
    const empRegRes = await request('POST', '/auth/register', {
      employeeId: newEmpId,
      name: 'Rohan Sharma',
      email: `${newEmpId.toLowerCase()}@platform.local`,
      password: 'Password@12345',
      mobileNumber: '+91 91234 56789'
    });
    assert(empRegRes.status === 201, 'Fresh employee account registered');
    const empToken = empRegRes.body.token;

    // Check membership status before applying
    const preStatus = await request('GET', '/memberships/my-status', null, empToken);
    assert(preStatus.status === 200 && !preStatus.body.hasActiveWorkplace, 'New employee initially has no active workplace');

    // Employee cannot check in without approved membership
    const checkInBlocked = await request('POST', '/attendance/check-in', {
      deviceId: 'DEVICE_TEST_ROHAN',
      latitude: 12.9715987,
      longitude: 77.5945627,
      accuracy: 10
    }, empToken);
    assert(checkInBlocked.status === 403 && checkInBlocked.body.requiresMembership, 'Attendance check-in blocked with 403 when unassigned to a workplace');

    // Employee applies to join Acme Tech
    const joinReqRes = await request('POST', '/memberships/request', {
      workplaceId: 'WP_ACME_001',
      requestNote: 'Full-stack software engineer onIndiranagar campus.'
    }, empToken);
    assert(joinReqRes.status === 201 && joinReqRes.body.membership.status === 'pending', 'Membership application submitted with status "pending"');
    const membershipId = joinReqRes.body.membership._id;

    // Acme Tech Admin views pending requests
    const pendingListRes = await request('GET', '/memberships/pending', null, admin1Token);
    assert(pendingListRes.status === 200 && pendingListRes.body.pending.some((p) => p.employeeId === newEmpId), 'Acme Tech Admin can see applicant in pending queue');

    // Metro Retail Admin should NOT see Acme applicant
    const metroPendingRes = await request('GET', '/memberships/pending', null, admin2Token);
    assert(metroPendingRes.status === 200 && !metroPendingRes.body.pending.some((p) => p.employeeId === newEmpId), 'Tenant Isolation: Metro Admin cannot see Acme applicant');

    // Acme Tech Admin approves the membership
    const approveRes = await request('PUT', `/memberships/${membershipId}/approve`, {
      notes: 'Welcome to Acme Tech Software Team!'
    }, admin1Token);
    assert(approveRes.status === 200 && approveRes.body.membership.status === 'approved', 'Acme Admin approved employee membership');

    // Employee verifies approved status
    const postStatus = await request('GET', '/memberships/my-status', null, empToken);
    assert(postStatus.status === 200 && postStatus.body.hasActiveWorkplace && postStatus.body.membership.status === 'approved', 'Employee status updated to approved active member');

    // -----------------------------------------------------------------
    // TEST 6: Device Binding & Geofence Attendance Execution
    // -----------------------------------------------------------------
    console.log('\n[6] Testing Device Binding & Geofence Radius Verification...');

    // Request OTP for device binding
    const otpReq = await request('POST', '/auth/request-otp', {
      employeeId: newEmpId,
      password: 'Password@12345',
      deviceId: 'DEVICE_TEST_ROHAN_PHONE',
      deviceModel: 'Google Pixel 8 Pro'
    });
    const otpVal = otpReq.body.otp || otpReq.body.debugOtp;
    assert(otpReq.status === 200 && otpVal, 'SMS OTP successfully issued for employee device');

    // Verify OTP and bind device
    const bindRes = await request('POST', '/auth/verify-otp-device', {
      employeeId: newEmpId,
      deviceId: 'DEVICE_TEST_ROHAN_PHONE',
      deviceModel: 'Google Pixel 8 Pro',
      osVersion: 'Android 14',
      otp: otpVal
    });
    assert(bindRes.status === 200 && bindRes.body.device.isBound, 'Single device securely bound to employee account');

    // Attempt check-in from 500m away (Outside Geofence)
    const outsideCheckIn = await request('POST', '/attendance/check-in', {
      deviceId: 'DEVICE_TEST_ROHAN_PHONE',
      latitude: 12.9760, // ~500m away
      longitude: 77.5945,
      accuracy: 10,
      isNativeEvent: true
    }, empToken);
    assert(outsideCheckIn.status === 400 && outsideCheckIn.body.isOutside, 'Geofence Guard: Check-in outside workplace perimeter rejected with 400');

    // Attempt check-in inside geofence perimeter (15m from Bangalore center)
    const insideCheckIn = await request('POST', '/attendance/check-in', {
      deviceId: 'DEVICE_TEST_ROHAN_PHONE',
      latitude: 12.97165,
      longitude: 77.59460,
      accuracy: 8,
      isNativeEvent: true
    }, empToken);
    assert(insideCheckIn.status === 201 && insideCheckIn.body.attendance.status === 'checked_in', 'Geofence Verification: Check-in inside perimeter successfully recorded');
    assert(insideCheckIn.body.attendance.workplaceId === 'WP_ACME_001', 'Attendance record properly stamped with workplaceId');

    // Check-out
    const checkOutRes = await request('POST', '/attendance/check-out', {
      deviceId: 'DEVICE_TEST_ROHAN_PHONE',
      latitude: 12.97160,
      longitude: 77.59458,
      accuracy: 8,
      isNativeEvent: true
    }, empToken);
    assert(checkOutRes.status === 200 && checkOutRes.body.attendance.status === 'completed', 'Attendance session completed upon check-out');

    // -----------------------------------------------------------------
    // TEST 7: Tenant-Scoped Leave Management
    // -----------------------------------------------------------------
    console.log('\n[7] Testing Tenant-Scoped Leave Management...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const leaveRes = await request('POST', '/leave/apply', {
      leaveType: 'casual',
      startDate: tomorrow.toISOString(),
      endDate: dayAfter.toISOString(),
      reason: 'Attending technical conference.'
    }, empToken);
    assert(leaveRes.status === 201 && leaveRes.body.leaveRequest.status === 'pending', 'Leave request submitted successfully');
    assert(leaveRes.body.leaveRequest.workplaceId === 'WP_ACME_001', 'Leave request stamped with employee workplaceId');
    const leaveId = leaveRes.body.leaveRequest._id;

    // Acme Admin approves leave
    const approveLeaveRes = await request('PUT', `/leave/approve/${leaveId}`, {
      decisionNote: 'Approved. Enjoy the conference!'
    }, admin1Token);
    assert(approveLeaveRes.status === 200 && approveLeaveRes.body.leave.status === 'approved', 'Workplace Admin 1 approved leave request');

    // Metro Admin should be blocked from approving Acme leave
    const crossLeaveRes = await request('PUT', `/leave/reject/${leaveId}`, {
      decisionNote: 'Should fail'
    }, admin2Token);
    assert(crossLeaveRes.status === 403, 'Cross-Workplace Guard: Workplace Admin 2 blocked from modifying Workplace 1 leaves');

    console.log('\n====================================================');
    console.log(`  ALL TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
