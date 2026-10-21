/**
 * Automated End-to-End Test:
 * Employee Registration with Gmail + Biometric Face Enrollment + Attendance Matching
 */

const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:5000/api';
const BANGALORE_LAT = 12.8438856;
const BANGALORE_LON = 80.1519553;

const FACE_A = fs.readFileSync(path.join(__dirname, 'fixtures_face_a.txt'), 'utf8').trim();
const FACE_B = fs.readFileSync(path.join(__dirname, 'fixtures_face_b.txt'), 'utf8').trim();

async function request(endpoint, options = {}) {
  const url = `${BACKEND_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(condition, message, extra = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} ${extra ? JSON.stringify(extra) : ''}`);
  }
}

async function runTest() {
  console.log('========================================================================');
  console.log(' RUNNING GMAIL REGISTRATION WITH FACE ENROLLMENT & MATCHING TEST SUITE');
  console.log('========================================================================\n');

  try {
    const testGmail = `employee_${Date.now()}@gmail.com`;
    const testPassword = 'SecurePassword@123';
    const testDeviceId = `DEV_BROWSER_${Date.now()}`;

    const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Step 0: Mobile SMS OTP Verification
    console.log(`[Step 0] Sending SMS OTP to ${testPhone}...`);
    const otpSendRes = await request('/auth/registration-otp/send', {
      method: 'POST',
      body: { phone: testPhone }
    });
    const otpCode = otpSendRes.data.debugOtp || '123456';
    const otpVerifyRes = await request('/auth/registration-otp/verify', {
      method: 'POST',
      body: { phone: testPhone, otp: otpCode }
    });
    const verificationToken = otpVerifyRes.data.verificationToken;

    // Step 1: Register new Employee with Gmail, Verified Phone, and Face Image (FACE_A)
    console.log(`[Step 1] Registering employee with Gmail (${testGmail}) and Face Biometrics...`);
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Aranit Gmail User',
        email: testGmail,
        password: testPassword,
        phone: testPhone,
        verificationToken,
        department: 'Engineering',
        workplaceId: 'WP_ACME_001',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId,
        deviceModel: 'Chrome on Windows 11'
      }
    });

    assert(regRes.status === 201, 'Registration returns 201 Created', regRes.data);
    assert(regRes.data.success === true, 'Registration reports success: true');
    assert(regRes.data.user.email === testGmail.toLowerCase(), 'Registered with correct Gmail address');
    assert(regRes.data.user.isFaceEnrolled === true, 'Face template was enrolled during registration');
    assert(regRes.data.user.isDeviceBound === true, 'Device was automatically bound during registration');
    const assignedEmployeeId = regRes.data.user.employeeId;
    console.log(`  -> Assigned Employee ID: ${assignedEmployeeId}`);

    // Step 2: Sign in with the registered Gmail address
    console.log(`\n[Step 2] Authenticating using registered Gmail (${testGmail})...`);
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: testGmail,
        password: testPassword
      }
    });

    assert(loginRes.status === 200, 'Login with Gmail returns 200 OK', loginRes.data);
    assert(loginRes.data.user.employeeId === assignedEmployeeId, 'Authenticated employee ID matches registered ID');
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Step 3: Check Face Enrollment status via API
    console.log('\n[Step 3] Verifying Face Enrollment status in database...');
    const statusRes = await request('/face/status', {
      headers: authHeaders
    });
    assert(statusRes.status === 200, 'Face status API returns 200');
    assert(statusRes.data.isEnrolled === true, 'Employee face status confirms isEnrolled: true');

    // Step 4: Attempt attendance face verification with an IMPOSTOR face (FACE_B)
    console.log('\n[Step 4] Testing Attendance Face Verification with Impostor Face (FACE_B)...');
    const impostorRes = await request('/face/verify', {
      method: 'POST',
      headers: authHeaders,
      body: {
        image: FACE_B
      }
    });
    assert(impostorRes.status === 401, 'Impostor face verification is rejected with 401 Unauthorized', impostorRes.data);
    assert(impostorRes.data.verified === false, 'Impostor verification result verified: false');

    // Step 5: Perform attendance face verification with the GENUINE registered face (FACE_A)
    console.log('\n[Step 5] Testing Attendance Face Verification with Genuine Face (FACE_A)...');
    const genuineRes = await request('/face/verify', {
      method: 'POST',
      headers: authHeaders,
      body: {
        image: FACE_A
      }
    });
    assert(genuineRes.status === 200, 'Genuine face verification succeeds with 200 OK', genuineRes.data);
    assert(genuineRes.data.verified === true, 'Verification confirms face matches registration template');
    assert(typeof genuineRes.data.verificationReference === 'string', 'Single-use verification token issued');
    const verificationRef = genuineRes.data.verificationReference;

    // Step 6: Submit Check-In using the issued verificationReference
    console.log('\n[Step 6] Submitting Geofence Check-In with Face Verification Reference...');
    const checkInRes = await request('/attendance/check-in', {
      method: 'POST',
      headers: authHeaders,
      body: {
        deviceId: testDeviceId,
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 8,
        verificationReference: verificationRef
      }
    });
    assert(checkInRes.status === 201, 'Attendance Check-In succeeds with 201 Created', checkInRes.data);
    assert(checkInRes.data.attendance.faceVerified === true, 'Attendance record stamped with faceVerified: true');
    assert(checkInRes.data.attendance.status === 'checked_in', 'Attendance status transitioned to checked_in');

    console.log('\n========================================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTest();
