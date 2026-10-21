/**
 * Automated Test:
 * Verifies that newly registered users appear in Admin workplace employee list and can have their geofence configured.
 */

const BACKEND_BASE = 'http://127.0.0.1:5000/api';

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
  console.log(' RUNNING ADMIN EMPLOYEE WORKPLACE VISIBILITY & GEOFENCE TEST');
  console.log('========================================================================\n');

  try {
    const timestamp = Date.now();
    const testGmail = `new_employee_${timestamp}@gmail.com`;
    const testEmployeeId = `EMP_NEW_${timestamp.toString().slice(-4)}`;

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

    // Step 1: Register new Employee with Gmail into Acme Tech
    console.log(`[Step 1] Registering fresh employee (${testEmployeeId}) into Acme Tech...`);
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        employeeId: testEmployeeId,
        name: 'Priya Patel',
        email: testGmail,
        password: 'Password@123',
        phone: testPhone,
        verificationToken,
        department: 'Operations',
        workplaceId: 'WP_ACME_001'
      }
    });

    assert(regRes.status === 201, 'Employee registered with status 201');
    assert(regRes.data.user.assignedWorkplaceId === 'WP_ACME_001', 'Assigned to Acme Tech');

    // Step 2: Login as Acme Tech Workplace Admin
    console.log('\n[Step 2] Authenticating as Acme Tech Admin (ADMIN001)...');
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'ADMIN001',
        password: 'Admin@12345'
      }
    });

    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Step 3: Fetch workplace members as Admin
    console.log('\n[Step 3] Fetching workplace members as Admin...');
    const membersRes = await request('/memberships/members', {
      headers: adminHeaders
    });

    assert(membersRes.status === 200, 'GET /memberships/members returns 200 OK');
    assert(Array.isArray(membersRes.data.members), 'Returns members array');

    const foundNewEmp = membersRes.data.members.find((m) => m.employeeId === testEmployeeId);
    assert(!!foundNewEmp, `New registered user ${testEmployeeId} is visible in admin workplace employee list!`);
    if (foundNewEmp) {
      assert(foundNewEmp.name === 'Priya Patel', 'Member name is accurate');
      assert(foundNewEmp.email === testGmail.toLowerCase(), 'Member email is accurate');
    }

    // Step 4: Admin retrieves geofence for the new employee
    console.log(`\n[Step 4] Querying geofence specifically for ${testEmployeeId}...`);
    const geoGetRes = await request(`/attendance/geofence/${testEmployeeId}`, {
      headers: adminHeaders
    });
    assert(geoGetRes.status === 200, 'Geofence for new user retrieved with 200 OK');
    assert(geoGetRes.data.geofence !== undefined, 'Contains geofence payload');

    // Step 5: Admin updates workplace geofence specifically for the new employee
    console.log(`\n[Step 5] Admin sets workplace coordinates for ${testEmployeeId}...`);
    const geoUpdateRes = await request(`/attendance/geofence/${testEmployeeId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        latitude: 12.9720,
        longitude: 77.5950,
        radius: 65,
        locationName: 'Priya Dedicated Worksite'
      }
    });

    assert(geoUpdateRes.status === 200, 'Geofence update for new user returns 200 OK');
    assert(geoUpdateRes.data.geofence.radius === 65, 'Updated radius to 65m');

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
