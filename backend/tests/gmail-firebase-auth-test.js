/**
 * Automated Test Suite:
 * Gmail Firebase Authentication & Employee Registration with Face Biometrics
 */

const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:5000/api';
const BANGALORE_LAT = 12.9715987;
const BANGALORE_LON = 77.5945627;

const FACE_A = fs.readFileSync(path.join(__dirname, 'fixtures_face_a.txt'), 'utf8').trim();

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

async function runFirebaseTestSuite() {
  console.log('========================================================================');
  console.log(' RUNNING GMAIL FIREBASE AUTHENTICATION & FACE REGISTRATION TEST SUITE');
  console.log('========================================================================\n');

  try {
    const timestamp = Date.now();
    const testGmail = `employee.firebase.${timestamp}@gmail.com`;
    const testPassword = 'Password@12345';
    const testDeviceId = `DEV_FIREBASE_${timestamp}`;
    const testGoogleId = `google_sub_${timestamp}`;

    // Test 1: Direct Firebase Login with an unregistered Gmail address
    console.log('[Test 1] Testing Firebase login with unregistered Gmail...');
    const unregLoginRes = await request('/auth/firebase-login', {
      method: 'POST',
      body: {
        email: `unregistered.${timestamp}@gmail.com`,
        name: 'Unregistered User',
        idToken: 'mock_token',
        deviceId: testDeviceId
      }
    });
    assert(unregLoginRes.status === 200, 'Unregistered Firebase login returns 200 response');
    assert(unregLoginRes.data.notRegistered === true, 'Response specifies notRegistered: true');

    // Test 2: Employee Registration with verified Gmail & Face Biometrics (NO PHONE OTP REQUIRED)
    console.log(`\n[Test 2] Registering employee with Gmail (${testGmail}) via Firebase and Face Biometrics...`);
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Arani Verified Employee',
        email: testGmail,
        password: testPassword,
        phone: '+91 93983 94987', // Plain optional phone number, no SMS OTP verification needed!
        isGmailVerified: true,
        googleId: testGoogleId,
        firebaseToken: `firebase_id_token_${timestamp}`,
        department: 'Engineering',
        workplaceId: 'WP_ACME_001',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId,
        deviceModel: 'Chrome on Windows 11'
      }
    });

    assert(regRes.status === 201, 'Registration returns 201 Created', regRes.data);
    assert(regRes.data.success === true, 'Registration reported success: true');
    assert(regRes.data.user.email === testGmail.toLowerCase(), 'Employee registered with correct Gmail address');
    assert(regRes.data.user.isFaceEnrolled === true, 'Biometric face enrolled with OpenCV YuNet & SFace');
    assert(regRes.data.user.isEmailVerified === true, 'Email verified via Firebase Auth');
    assert(regRes.data.user.authProvider === 'firebase_google', 'Auth provider is firebase_google');
    assert(regRes.data.user.assignedWorkplaceId === 'WP_ACME_001', 'Assigned to workplace Acme Tech');
    const assignedEmployeeId = regRes.data.user.employeeId;
    console.log(`  -> Assigned Employee ID: ${assignedEmployeeId}`);

    // Test 3: Duplicate Gmail Registration Prevention
    console.log('\n[Test 3] Attempting duplicate registration with same Gmail address...');
    const dupRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate Attempt',
        email: testGmail,
        password: testPassword,
        isGmailVerified: true,
        workplaceId: 'WP_ACME_001',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId
      }
    });
    assert(dupRes.status === 409, 'Duplicate registration returns 409 Conflict', dupRes.data);

    // Test 4: Sign in with Google (Firebase Login) for the registered employee
    console.log(`\n[Test 4] Signing in using Google Firebase for registered Gmail (${testGmail})...`);
    const firebaseLoginRes = await request('/auth/firebase-login', {
      method: 'POST',
      body: {
        email: testGmail,
        name: 'Arani Verified Employee',
        idToken: `firebase_id_token_${timestamp}`,
        googleId: testGoogleId,
        deviceId: testDeviceId,
        deviceModel: 'Chrome on Windows 11'
      }
    });

    assert(firebaseLoginRes.status === 200, 'Firebase login returns 200 OK', firebaseLoginRes.data);
    assert(firebaseLoginRes.data.success === true, 'Firebase login reported success: true');
    assert(Boolean(firebaseLoginRes.data.token), 'JWT authentication token received');
    assert(firebaseLoginRes.data.user.employeeId === assignedEmployeeId, 'Employee ID matches');
    assert(firebaseLoginRes.data.user.isFaceEnrolled === true, 'Face enrollment status preserved');
    const sessionToken = firebaseLoginRes.data.token;

    // Test 5: Verify Session Profile via GET /api/auth/me
    console.log('\n[Test 5] Verifying session profile with GET /api/auth/me...');
    const meRes = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
    assert(meRes.data.user.email === testGmail.toLowerCase(), 'User email matches registered Gmail');
    assert(meRes.data.user.assignedWorkplaceId === 'WP_ACME_001', 'Assigned workplace retained');

    // Test 6: Biometric Attendance Check-In with Face Verification
    console.log('\n[Test 6] Submitting face verification & attendance check-in for registered employee...');
    const verifyFaceRes = await request('/face/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: {
        image: FACE_A
      }
    });
    assert(verifyFaceRes.status === 200, 'Face verification returns 200 OK', verifyFaceRes.data);
    assert(verifyFaceRes.data.verified === true, 'Face matches enrolled reference template');
    const faceVerifyToken = verifyFaceRes.data.verificationReference;

    const checkInRes = await request('/attendance/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: {
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 10,
        deviceId: testDeviceId,
        verificationReference: faceVerifyToken
      }
    });
    assert(checkInRes.status === 201, 'Geofence check-in returns 201 Created', checkInRes.data);
    assert(checkInRes.data.attendance?.faceVerified === true, 'Attendance record stamped with faceVerified: true');
    assert(checkInRes.data.attendance?.status === 'checked_in', 'Attendance status transitioned to checked_in');

    console.log('\n========================================================================');
    console.log(` GMAIL FIREBASE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
}

runFirebaseTestSuite();
