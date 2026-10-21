/**
 * Automated Test Suite:
 * Mobile Email Verification & Biometric Face Registration
 */

const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:5000/api';
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
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => '');
  }
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

async function runMobileEmailTestSuite() {
  console.log('========================================================================');
  console.log(' RUNNING MOBILE EMAIL VERIFICATION & FACE ENROLLMENT TEST SUITE');
  console.log('========================================================================\n');

  try {
    const timestamp = Date.now();
    const testEmail = `employee.mobile.${timestamp}@gmail.com`;
    const testPassword = 'Password@12345';
    const testDeviceId = `DEV_MOBILE_${timestamp}`;

    // Test 1: Attempt registration WITHOUT mobile email verification
    console.log('[Test 1] Attempting registration without email verification proof token...');
    const unverifiedRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Unverified Employee',
        email: testEmail,
        password: testPassword,
        faceImage: FACE_A,
        consentGiven: true
      }
    });
    assert(
      unverifiedRes.status === 403,
      'Registration rejected with 403 Forbidden when email verification is missing',
      unverifiedRes.data
    );

    // Test 2: Dispatch registration verification email
    console.log(`\n[Test 2] Dispatching verification email to ${testEmail}...`);
    const emailRes = await request('/auth/registration-email/send', {
      method: 'POST',
      body: { email: testEmail }
    });
    assert(emailRes.status === 200, 'Verification email dispatched successfully (status 200)');
    assert(emailRes.data.success === true, 'Response contains success: true');
    assert(Boolean(emailRes.data.sessionId), `Received valid sessionId: ${emailRes.data.sessionId}`);
    assert(Boolean(emailRes.data.previewUrl), `Generated mobile 1-click link: ${emailRes.data.previewUrl}`);
    const sessionId = emailRes.data.sessionId;
    const previewUrl = emailRes.data.previewUrl;
    const token = new URL(previewUrl).searchParams.get('token');

    // Test 3: Check status on desktop before mobile click
    console.log('\n[Test 3] Desktop polling verification status before mobile link click...');
    const statusBefore = await request(`/auth/registration-email/status?sessionId=${sessionId}`);
    assert(statusBefore.status === 200, 'Status check returns 200');
    assert(statusBefore.data.verified === false, 'Session status is verified: false');

    // Test 4: Mobile user taps verification link
    console.log(`\n[Test 4] Mobile device accesses verification link (/api/auth/verify-email?token=...)...`);
    const mobileClickRes = await request(`/auth/verify-email?token=${token}`);
    assert(mobileClickRes.status === 200, 'Mobile link returns 200 OK');
    assert(
      typeof mobileClickRes.data === 'string' && mobileClickRes.data.includes('Gmail Verified!'),
      'Mobile response renders success confirmation HTML page'
    );

    // Test 5: Desktop polling detects mobile verification
    console.log('\n[Test 5] Desktop polling verification status after mobile link click...');
    const statusAfter = await request(`/auth/registration-email/status?sessionId=${sessionId}`);
    assert(statusAfter.status === 200, 'Status check returns 200');
    assert(statusAfter.data.verified === true, 'Session status is now verified: true');
    assert(Boolean(statusAfter.data.proofToken), 'Cryptographic proofToken issued to client');
    const proofToken = statusAfter.data.proofToken;

    // Test 6: Complete Registration with Face Biometrics and Proof Token
    console.log('\n[Test 6] Submitting employee registration with email proof token and biometric face image...');
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Arani Verified Mobile Employee',
        email: testEmail,
        password: testPassword,
        phone: '+91 93983 94987',
        emailVerificationProof: proofToken,
        workplaceId: 'WP_ACME_001',
        department: 'Operations',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId,
        deviceModel: 'Samsung Galaxy / Chrome'
      }
    });
    assert(regRes.status === 201, 'Registration returns 201 Created', regRes.data);
    assert(regRes.data.success === true, 'Registration reported success: true');
    assert(regRes.data.user.email === testEmail.toLowerCase(), 'Employee registered with correct Gmail address');
    assert(regRes.data.user.isEmailVerified === true, 'Account marked as email verified');
    assert(regRes.data.user.isFaceEnrolled === true, 'Biometric face enrolled with OpenCV YuNet & SFace');
    assert(regRes.data.user.assignedWorkplaceId === 'WP_ACME_001', 'Assigned to workplace Acme Tech');
    console.log(`  -> Registered Employee ID: ${regRes.data.user.employeeId}`);

    // Test 7: Prevent proofToken replay
    console.log('\n[Test 7] Attempting to reuse consumed proof token for another registration...');
    const replayRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Hacker Replay Attempt',
        email: `replay.${timestamp}@gmail.com`,
        password: testPassword,
        emailVerificationProof: proofToken,
        faceImage: FACE_A,
        consentGiven: true
      }
    });
    assert(replayRes.status === 403, 'Proof token replay rejected with 403 Forbidden', replayRes.data);

    // Test 8: Fallback 6-digit code verification
    console.log('\n[Test 8] Testing fallback 6-digit code verification on desktop screen...');
    const testEmail2 = `employee.code.${timestamp}@gmail.com`;
    const emailRes2 = await request('/auth/registration-email/send', {
      method: 'POST',
      body: { email: testEmail2 }
    });
    const sessionId2 = emailRes2.data.sessionId;
    const correctCode = emailRes2.data.debugCode;

    // 8a: Incorrect code
    const badCodeRes = await request('/auth/registration-email/verify-code', {
      method: 'POST',
      body: { sessionId: sessionId2, code: '000000' }
    });
    assert(badCodeRes.status === 400, 'Incorrect code rejected with 400 Bad Request');

    // 8b: Correct code
    const goodCodeRes = await request('/auth/registration-email/verify-code', {
      method: 'POST',
      body: { sessionId: sessionId2, code: correctCode }
    });
    assert(goodCodeRes.status === 200, 'Correct 6-digit code verified successfully');
    assert(Boolean(goodCodeRes.data.proofToken), 'Proof token issued upon code verification');

    // 8c: Register with code proof token
    const regRes2 = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Code Verified Employee',
        email: testEmail2,
        password: testPassword,
        emailVerificationProof: goodCodeRes.data.proofToken,
        workplaceId: 'WP_ACME_001',
        faceImage: FACE_A,
        consentGiven: true
      }
    });
    assert(regRes2.status === 201, 'Registration via code proof succeeded with 201 Created');

    console.log('\n========================================================================');
    console.log(` TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runMobileEmailTestSuite();
