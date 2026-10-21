/**
 * Automated Test Suite:
 * Real SMS OTP Mobile Verification Before Employee Account Creation
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

async function runSmsOtpTestSuite() {
  console.log('========================================================================');
  console.log(' RUNNING SMS OTP MOBILE VERIFICATION & REGISTRATION SECURITY TEST SUITE');
  console.log('========================================================================\n');

  try {
    const uniqueNum = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `+919876${uniqueNum}`;
    const testEmail = `otp_emp_${Date.now()}@gmail.com`;
    const testPassword = 'SecurePassword@123';
    const testDeviceId = `DEV_BROWSER_${Date.now()}`;

    // Test 1: Direct registration attempt without OTP token must be rejected
    console.log('[Test 1] Attempting registration without mobile OTP verification token...');
    const noTokenRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Unverified User',
        email: testEmail,
        password: testPassword,
        phone: testPhone,
        department: 'Operations',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId
      }
    });
    assert(noTokenRes.status === 403, 'Registration without verification token rejected with 403 Forbidden', noTokenRes.data);
    assert(noTokenRes.data.success === false, 'Response has success: false');

    // Test 2: Send OTP to test mobile phone
    console.log(`\n[Test 2] Requesting SMS OTP for phone: ${testPhone}...`);
    const sendOtpRes = await request('/auth/registration-otp/send', {
      method: 'POST',
      body: { phone: testPhone }
    });
    assert(sendOtpRes.status === 200, 'Send OTP returns 200 OK', sendOtpRes.data);
    assert(sendOtpRes.data.success === true, 'Send OTP success is true');
    assert(typeof sendOtpRes.data.cooldownSeconds === 'number', 'Cooldown seconds returned');
    const generatedOtp = sendOtpRes.data.debugOtp || '123456';
    console.log(`  -> Received OTP for testing: ${generatedOtp}`);

    // Test 3: Resend OTP immediately should be blocked by 60-second cooldown
    console.log('\n[Test 3] Testing resend cooldown enforcement...');
    const cooldownRes = await request('/auth/registration-otp/send', {
      method: 'POST',
      body: { phone: testPhone }
    });
    assert(cooldownRes.status === 429, 'Immediate resend rejected with 429 Too Many Requests', cooldownRes.data);
    assert(typeof cooldownRes.data.remainingSeconds === 'number' && cooldownRes.data.remainingSeconds > 0, 'Remaining cooldown seconds specified');

    // Test 4: Verify OTP with incorrect code
    console.log('\n[Test 4] Verifying with incorrect OTP (000000)...');
    const wrongOtpRes = await request('/auth/registration-otp/verify', {
      method: 'POST',
      body: { phone: testPhone, otp: '000000' }
    });
    assert(wrongOtpRes.status === 400, 'Incorrect OTP rejected with 400 Bad Request', wrongOtpRes.data);
    assert(wrongOtpRes.data.success === false, 'Verification success is false');

    // Test 5: Verify OTP with correct code
    console.log(`\n[Test 5] Verifying with correct OTP (${generatedOtp})...`);
    const correctOtpRes = await request('/auth/registration-otp/verify', {
      method: 'POST',
      body: { phone: testPhone, otp: generatedOtp }
    });
    assert(correctOtpRes.status === 200, 'Correct OTP verified with 200 OK', correctOtpRes.data);
    assert(correctOtpRes.data.success === true, 'Verification success: true');
    assert(Boolean(correctOtpRes.data.verificationToken), 'Cryptographic verificationToken issued');
    const validToken = correctOtpRes.data.verificationToken;

    // Test 6: Phone Spoofing Prevention (Trying to use token for testPhone with a different phone number)
    console.log('\n[Test 6] Testing phone spoofing prevention (token issued for Phone A, registering with Phone B)...');
    const spoofPhone = '+919999999999';
    const spoofRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Spoof Attacker',
        email: `spoof_${Date.now()}@gmail.com`,
        password: testPassword,
        phone: spoofPhone,
        verificationToken: validToken,
        department: 'Operations',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId
      }
    });
    assert(spoofRes.status === 403, 'Phone spoofing rejected with 403 Forbidden', spoofRes.data);

    // Test 7: Successful registration with verified phone, token, and biometric face enrollment
    console.log('\n[Test 7] Completing registration with verified phone, valid token, and Face Biometrics...');
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Verified OTP Employee',
        email: testEmail,
        password: testPassword,
        phone: testPhone,
        verificationToken: validToken,
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
    assert(regRes.data.user.email === testEmail.toLowerCase(), 'Employee registered with correct email');
    assert(regRes.data.user.isFaceEnrolled === true, 'Biometric face enrolled');
    assert(regRes.data.user.isMobileVerified === true, 'Account has isMobileVerified: true');
    assert(regRes.data.user.mobileNumber === testPhone, 'Account has exact verified mobileNumber');

    // Test 8: Token Replay Prevention (Reusing the consumed token must fail)
    console.log('\n[Test 8] Testing token replay prevention (attempting to reuse consumed verification token)...');
    const replayRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Replay User',
        email: `replay_${Date.now()}@gmail.com`,
        password: testPassword,
        phone: testPhone,
        verificationToken: validToken,
        department: 'Engineering',
        faceImage: FACE_A,
        consentGiven: true,
        deviceId: testDeviceId
      }
    });
    assert(replayRes.status === 403 || replayRes.status === 409, 'Token replay rejected (403 or 409)', replayRes.data);

    // Test 9: Duplicate Phone Prevention (Requesting OTP for an already registered mobile number)
    console.log('\n[Test 9] Testing duplicate phone registration prevention...');
    const dupOtpRes = await request('/auth/registration-otp/send', {
      method: 'POST',
      body: { phone: testPhone }
    });
    assert(dupOtpRes.status === 409, 'Duplicate phone OTP request returns 409 Conflict', dupOtpRes.data);

    // Test 10: Authenticate with registered user and verify session
    console.log('\n[Test 10] Signing in with registered account and verifying user profile...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: testEmail,
        password: testPassword,
        deviceId: testDeviceId
      }
    });
    assert(loginRes.status === 200, 'Login succeeded with 200 OK', loginRes.data);
    assert(Boolean(loginRes.data.token), 'JWT authentication token received');
    assert(loginRes.data.user.isMobileVerified === true, 'User profile reflects isMobileVerified: true');
    assert(loginRes.data.user.mobileNumber === testPhone, 'User profile reflects verified phone number');

    console.log('\n========================================================================');
    console.log(` SMS OTP TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered unhandled error:', err);
    process.exit(1);
  }
}

runSmsOtpTestSuite();
