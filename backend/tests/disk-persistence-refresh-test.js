/**
 * Automated Verification Test:
 * Disk Persistence, Session Synchronization (/api/auth/me), and Refresh State Preservation
 */

const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:5000/api';
const STORE_FILE = path.join(__dirname, '..', 'data', 'local_store.json');
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
    console.error(`  ✗ FAIL: ${message} ${extra ? `(${JSON.stringify(extra)})` : ''}`);
  }
}

async function runTest() {
  console.log('\n======================================================');
  console.log(' RUNNING DISK PERSISTENCE & REFRESH VERIFICATION TEST');
  console.log('======================================================\n');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testEmail = `persistent.emp.${randomSuffix}@gmail.com`;
  const testEmpId = `EMP_PERSIST_${randomSuffix}`;
  const testPassword = 'Password@12345';
  const testDeviceId = `DEV_PERSIST_${randomSuffix}`;

  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  // 0. Mobile SMS OTP Verification
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

  // 1. Register new employee with face biometric and workplace assignment
  console.log('[Step 1] Registering employee with Gmail, verified phone, and face biometric...');
  const regPayload = {
    employeeId: testEmpId,
    name: `Persistent Employee ${randomSuffix}`,
    email: testEmail,
    password: testPassword,
    phone: testPhone,
    verificationToken,
    department: 'Engineering',
    workplaceId: 'WP_ACME_001',
    faceImage: FACE_A,
    consentGiven: true,
    consentStatement: 'I explicitly consent to biometric enrollment for fraud prevention.',
    deviceId: testDeviceId,
    deviceModel: 'Test Device 2026'
  };

  const regRes = await request('/auth/register', { method: 'POST', body: regPayload });
  assert(regRes.status === 201, 'Registration returns 201 Created', regRes.data);
  assert(regRes.data.success === true, 'Registration succeeded flag');
  assert(Boolean(regRes.data.token), 'Registration returns valid JWT token');
  assert(regRes.data.user?.assignedWorkplaceId === 'WP_ACME_001', 'Assigned workplace is WP_ACME_001');
  assert(regRes.data.user?.isFaceEnrolled === true, 'User is marked face enrolled');

  const registrationToken = regRes.data.token;

  // 2. Verify disk persistence: check backend/data/local_store.json exists and contains the user
  console.log('\n[Step 2] Verifying backend/data/local_store.json on disk...');
  assert(fs.existsSync(STORE_FILE), 'local_store.json file exists on disk');
  const storeRaw = fs.readFileSync(STORE_FILE, 'utf8');
  const storeData = JSON.parse(storeRaw);
  const userInDisk = (storeData.users || []).find((u) => u.employeeId === testEmpId);
  assert(Boolean(userInDisk), 'Newly registered employee is stored in local_store.json on disk');
  assert(userInDisk?.email === testEmail, 'Email matches on disk');
  assert(userInDisk?.assignedWorkplaceId === 'WP_ACME_001', 'Workplace matches on disk');

  const faceInDisk = (storeData.faceEnrollments || []).find((f) => f.employeeId === testEmpId);
  assert(Boolean(faceInDisk), 'Biometric face enrollment record stored in local_store.json on disk');
  assert(faceInDisk?.protectedEmbedding && faceInDisk.protectedEmbedding.iv, 'Face embedding is securely AES-GCM encrypted on disk');

  // 3. Test Session Sync Endpoint: GET /api/auth/me
  console.log('\n[Step 3] Testing /api/auth/me profile synchronization...');
  const meRes = await request('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${registrationToken}` }
  });
  assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK', meRes.data);
  assert(meRes.data.success === true, 'GET /api/auth/me returns success');
  assert(meRes.data.user?.employeeId === testEmpId, 'GET /api/auth/me returns correct employeeId');
  assert(meRes.data.user?.assignedWorkplaceId === 'WP_ACME_001', 'GET /api/auth/me retains assignedWorkplaceId');
  assert(meRes.data.user?.isFaceEnrolled === true, 'GET /api/auth/me retains isFaceEnrolled');
  assert(meRes.data.user?.boundDeviceId === testDeviceId, 'GET /api/auth/me retains boundDeviceId');

  // 4. Test Login with newly registered credentials
  console.log('\n[Step 4] Testing login with new credentials...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { identifier: testEmail, password: testPassword }
  });
  assert(loginRes.status === 200, 'POST /api/auth/login returns 200 OK', loginRes.data);
  assert(loginRes.data.user?.assignedWorkplaceId === 'WP_ACME_001', 'Login response returns assignedWorkplaceId');
  assert(loginRes.data.user?.isFaceEnrolled === true, 'Login response returns isFaceEnrolled');

  // 5. Test MemoryStore Reload from Disk (Simulating Server Restart)
  console.log('\n[Step 5] Simulating server restart and verifying MemoryStore.loadFromDisk()...');
  // Load a fresh MemoryStore instance directly
  delete require.cache[require.resolve('../src/config/memoryStore')];
  const reloadedStore = require('../src/config/memoryStore');
  const userAfterReload = reloadedStore.users.find((u) => u.employeeId === testEmpId);
  assert(Boolean(userAfterReload), 'User survives restart and is reloaded from local_store.json');
  assert(userAfterReload?.email === testEmail, 'Email preserved after restart');

  const faceAfterReload = reloadedStore.faceEnrollments.find((f) => f.employeeId === testEmpId);
  assert(Boolean(faceAfterReload), 'Face enrollment survives restart and is reloaded from disk');

  // 6. Test Admin Workplace Member Visibility
  console.log('\n[Step 6] Verifying admin visibility of newly registered employee...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: 'ADMIN001', password: 'Admin@12345' }
  });
  assert(adminLogin.status === 200, 'Admin login succeeded');
  const adminToken = adminLogin.data.token;

  const membersRes = await request('/memberships/members?limit=100', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(membersRes.status === 200, 'GET /api/memberships/members returns 200 OK');
  const memberEntry = (membersRes.data.members || []).find((m) => m.employeeId === testEmpId);
  assert(Boolean(memberEntry), 'Admin sees newly registered employee in workplace roster');
  assert(memberEntry?.email === testEmail, 'Admin sees correct employee email');

  console.log(`\n======================================================`);
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
