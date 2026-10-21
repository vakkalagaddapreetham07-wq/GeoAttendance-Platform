/**
 * Automated Verification Suite for Face Recognition Attendance System
 * Real end-to-end integration across:
 * - Node/Express backend (Port 5000)
 * - Python ML / Face Verification Microservice (Port 5001)
 * - Biometric AES-256 encrypted template store
 * - GPS Geofence & Device Binding
 */

const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:5000/api';
const BANGALORE_LAT = 12.8435349;
const BANGALORE_LON = 80.153128;

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

async function runFaceAttendanceTests() {
  console.log('========================================================');
  console.log(' RUNNING FACE RECOGNITION ATTENDANCE VERIFICATION SUITE');
  console.log('========================================================\n');

  try {
    // Step 1: Login as Alice Smith (EMP001) in Acme Tech (WP_ACME_001)
    console.log('[Step 1] Authenticating as EMP001 (Alice Smith)...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'EMP001', password: 'Emp@12345' }
    });
    assert(loginRes.status === 200 && loginRes.data.token, 'EMP001 successfully logged in', loginRes.data);
    const token = loginRes.data.token;
    const authHeader = { Authorization: `Bearer ${token}` };

    // Step 2: Check Face Status
    console.log('\n[Step 2] Querying initial Face Enrollment status...');
    const statusRes = await request('/face/status', {
      method: 'GET',
      headers: authHeader
    });
    assert(statusRes.status === 200, 'GET /api/face/status returns 200');

    // Step 3: Attempt Check-In WITHOUT Face Verification Reference
    console.log('\n[Step 3] Attempting check-in WITHOUT face verification reference...');
    const unverifiedCheckIn = await request('/attendance/check-in', {
      method: 'POST',
      headers: authHeader,
      body: {
        deviceId: 'DEVICE_UUID_EMP001_2026',
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 10
      }
    });
    assert(unverifiedCheckIn.status === 403, 'Check-in without face verification returns 403 Forbidden', unverifiedCheckIn.data);
    assert(unverifiedCheckIn.data.requiresFaceVerification === true, 'Response flags requiresFaceVerification: true');

    // Step 4: Attempt Face Enrollment WITHOUT Consent
    console.log('\n[Step 4] Testing Face Enrollment consent enforcement...');
    const noConsentRes = await request('/face/enroll', {
      method: 'POST',
      headers: authHeader,
      body: {
        image: FACE_A,
        consentGiven: false
      }
    });
    assert(noConsentRes.status === 400, 'Enrollment without explicit consent returns 400 Bad Request', noConsentRes.data);
    assert(noConsentRes.data.error.includes('consent'), 'Error specifies consent requirement');

    // Step 5: Perform Real Biometric Face Enrollment WITH Consent & Image
    console.log('\n[Step 5] Enrolling biometric template with real face image & consent...');
    const enrollRes = await request('/face/enroll', {
      method: 'POST',
      headers: authHeader,
      body: {
        image: FACE_A,
        consentGiven: true,
        consentStatement: 'I give consent to biometric face verification for attendance.'
      }
    });
    assert(enrollRes.status === 200, 'Biometric face enrollment succeeds with 200 OK', enrollRes.data);
    assert(enrollRes.data.enrollmentStatus === 'enrolled', 'Enrollment status updated to enrolled');

    // Step 6: Verify with IMPOSTOR Face (FACE_B) - should be REJECTED!
    console.log('\n[Step 6] Testing Impostor / Buddy-Punching Rejection with mismatched face...');
    const impostorRes = await request('/face/verify', {
      method: 'POST',
      headers: authHeader,
      body: {
        image: FACE_B
      }
    });
    assert(impostorRes.status === 401, 'Impostor face verification correctly rejected with 401 Unauthorized', impostorRes.data);
    assert(impostorRes.data.verified === false, 'Verification result verified: false');

    // Step 7: Verify with GENUINE Face (FACE_A) - should SUCCEED & return verificationReference
    console.log('\n[Step 7] Testing Genuine Face Verification with matched face...');
    const genuineRes = await request('/face/verify', {
      method: 'POST',
      headers: authHeader,
      body: {
        image: FACE_A
      }
    });
    assert(genuineRes.status === 200, 'Genuine face verification succeeds with 200 OK', genuineRes.data);
    assert(genuineRes.data.verified === true, 'Verification result verified: true');
    assert(typeof genuineRes.data.verificationReference === 'string', 'Received one-time verificationReference token');
    const validToken = genuineRes.data.verificationReference;

    // Step 8: Perform Check-In WITH valid verification reference
    console.log('\n[Step 8] Performing Check-In with issued verificationReference...');
    const validCheckIn = await request('/attendance/check-in', {
      method: 'POST',
      headers: authHeader,
      body: {
        deviceId: 'DEVICE_UUID_EMP001_2026',
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 10,
        verificationReference: validToken
      }
    });
    assert(validCheckIn.status === 201, 'Check-in with face verification succeeds (201 Created)', validCheckIn.data);
    assert(validCheckIn.data.attendance?.faceVerified === true, 'Attendance record marks faceVerified: true');

    // Step 9: Anti-Replay: Attempt to re-use the SAME verification reference
    console.log('\n[Step 9] Testing Replay Attack prevention (reusing consumed verificationReference)...');
    const replayCheckIn = await request('/attendance/check-in', {
      method: 'POST',
      headers: authHeader,
      body: {
        deviceId: 'DEVICE_UUID_EMP001_2026',
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 10,
        verificationReference: validToken
      }
    });
    assert(replayCheckIn.status === 403, 'Reused verification reference is rejected with 403 Forbidden', replayCheckIn.data);
    assert(replayCheckIn.data.error.includes('already been consumed'), 'Error identifies consumed token replay');

    // Step 10: Verify face for Check-Out
    console.log('\n[Step 10] Verifying face for Check-Out...');
    const outVerifyRes = await request('/face/verify', {
      method: 'POST',
      headers: authHeader,
      body: {
        image: FACE_A
      }
    });
    assert(outVerifyRes.status === 200, 'Check-out face verification succeeds', outVerifyRes.data);
    const checkOutToken = outVerifyRes.data.verificationReference;

    // Step 11: Perform Check-Out with new verification reference
    console.log('\n[Step 11] Performing Check-Out with verificationReference...');
    const validCheckOut = await request('/attendance/check-out', {
      method: 'POST',
      headers: authHeader,
      body: {
        deviceId: 'DEVICE_UUID_EMP001_2026',
        latitude: BANGALORE_LAT,
        longitude: BANGALORE_LON,
        accuracy: 10,
        verificationReference: checkOutToken
      }
    });
    assert(validCheckOut.status === 200, 'Check-out succeeds with 200 OK', validCheckOut.data);
    assert(validCheckOut.data.attendance?.faceVerified === true, 'Check-out records faceVerified: true');
    assert(validCheckOut.data.attendance?.status === 'completed', 'Attendance status transitioned to completed');

    // Step 12: Re-enrollment password security
    console.log('\n[Step 12] Testing Re-enrollment security (password requirement)...');
    const badPwReEnroll = await request('/face/re-enroll', {
      method: 'POST',
      headers: authHeader,
      body: {
        password: 'WrongPassword!999',
        image: FACE_A,
        consentGiven: true
      }
    });
    assert(badPwReEnroll.status === 401, 'Re-enrollment with incorrect password rejected with 401', badPwReEnroll.data);

    console.log('\n========================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runFaceAttendanceTests();
