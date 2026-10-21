const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbBridge = require('../services/dbBridge');
const otpService = require('../services/otpService');
const smsService = require('../services/smsService');
const faceService = require('../services/faceService');
const emailService = require('../services/emailService');
const { JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Register a new employee account (with optional/mandatory face biometric enrollment, workplace selection, and device binding)
 */
async function register(req, res) {
  try {
    const {
      employeeId,
      name,
      email,
      password,
      role = 'employee',
      department = 'Operations',
      phone,
      mobileNumber,
      workplaceId,
      faceImage,
      image,
      consentGiven = true,
      consentStatement,
      deviceId,
      deviceModel = 'Web Browser',
      geofenceCenter
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, Email, and Password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let cleanEmployeeId = employeeId ? employeeId.trim().toUpperCase() : '';

    // Auto-generate employeeId if not provided (e.g. from Gmail registration)
    if (!cleanEmployeeId) {
      const prefix = name.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'EMP';
      const rand = Math.floor(1000 + Math.random() * 9000);
      cleanEmployeeId = `${prefix}${rand}`;
    }

    // 0. Gmail Verification & Security Proof Validation
    const cleanPhone = (phone || mobileNumber || '').trim();
    const isGmailAuth = Boolean(req.body.isGmailVerified || req.body.firebaseToken || req.body.googleId || req.body.verificationToken);
    const { emailVerificationProof } = req.body;
    let isEmailVerified = false;
    let authProvider = 'local';

    if (emailVerificationProof) {
      const proofResult = emailService.consumeEmailProofToken(emailVerificationProof, cleanEmail);
      if (!proofResult.valid) {
        return res.status(403).json({
          success: false,
          error: proofResult.error || 'Invalid or expired email verification proof token.'
        });
      }
      isEmailVerified = true;
      authProvider = 'email_verified';
    } else if (isGmailAuth) {
      isEmailVerified = true;
      authProvider = 'firebase_google';
    } else if (req.user && req.user.role === 'admin') {
      isEmailVerified = true;
      authProvider = 'admin_created';
    } else {
      return res.status(403).json({
        success: false,
        error: 'Gmail email verification is required. Please verify the email sent to your mobile device before proceeding.'
      });
    }

    // Check existing user by ID or Email
    const existing = await dbBridge.findUser({
      $or: [
        { employeeId: cleanEmployeeId },
        { email: cleanEmail }
      ]
    });

    if (existing) {
      let conflictMsg = 'An employee with this Employee ID already exists.';
      if (existing.email?.toLowerCase() === cleanEmail) {
        conflictMsg = 'An account with this Gmail address already exists. Please sign in with Google or your password.';
      }
      return res.status(409).json({
        success: false,
        error: conflictMsg
      });
    }

    // Biometric Face Enrollment (if image provided)
    const rawFaceImage = faceImage || image;
    let faceEnrollmentResult = null;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (rawFaceImage) {
      try {
        faceEnrollmentResult = await faceService.enrollEmployeeFace({
          employeeId: cleanEmployeeId,
          workplaceId: workplaceId || null,
          imageData: rawFaceImage,
          consentGiven: Boolean(consentGiven),
          consentStatement: consentStatement || 'Biometric face registration consent given during employee account onboarding.',
          clientIp,
          userAgent
        });
      } catch (faceErr) {
        console.error('[Registration] Face enrollment error:', faceErr.message);
        return res.status(400).json({
          success: false,
          error: `Face Biometric Registration Failed: ${faceErr.message}`
        });
      }
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Resolve Workplace if specified
    let targetWorkplace = null;
    if (workplaceId) {
      targetWorkplace = await dbBridge.findWorkplaceById(workplaceId);
    }

    // Create User
    const user = await dbBridge.createUser({
      employeeId: cleanEmployeeId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'employee',
      mobileNumber: cleanPhone || null,
      isMobileVerified: false,
      isEmailVerified: isEmailVerified,
      authProvider: authProvider,
      assignedWorkplaceId: targetWorkplace ? targetWorkplace.workplaceId : null,
      department: department.trim(),
      leaveBalance: { sick: 10, casual: 12, annual: 15 },
      accountStatus: 'active'
    });

    // If workplace selected, auto-create approved membership
    if (targetWorkplace) {
      await dbBridge.createMembership({
        workplaceId: targetWorkplace.workplaceId,
        employeeId: cleanEmployeeId,
        employeeName: name.trim(),
        status: 'approved',
        joinRequestedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: 'SYSTEM_ONBOARDING',
        reviewNotes: 'Auto-approved during initial employee onboarding with biometric enrollment'
      });

      // Bind geofence to workplace center
      if (targetWorkplace.geofence && targetWorkplace.geofence.center) {
        await dbBridge.upsertGeofence(targetWorkplace.workplaceId, cleanEmployeeId, {
          employeeId: cleanEmployeeId,
          center: targetWorkplace.geofence.center,
          radius: targetWorkplace.geofence.radius || 50,
          locationName: targetWorkplace.geofence.locationName || targetWorkplace.name,
          configuredBy: 'SYSTEM_ONBOARDING'
        });
      }
    } else {
      // Default fallback geofence
      const lat = geofenceCenter && geofenceCenter.latitude ? geofenceCenter.latitude : 12.9715987;
      const lon = geofenceCenter && geofenceCenter.longitude ? geofenceCenter.longitude : 77.5945627;

      await dbBridge.upsertGeofence(null, cleanEmployeeId, {
        employeeId: cleanEmployeeId,
        center: { latitude: lat, longitude: lon },
        radius: 50,
        locationName: 'Designated Office Site',
        configuredBy: req.user ? req.user.employeeId : 'SYSTEM_INIT'
      });
    }

    // Auto-bind device if deviceId provided
    let boundDeviceId = null;
    if (deviceId) {
      boundDeviceId = deviceId.trim();
      await dbBridge.saveDevice({
        employeeId: cleanEmployeeId,
        deviceId: boundDeviceId,
        deviceModel: deviceModel || 'Web Client',
        osVersion: 'Web Browser',
        isBound: true,
        registeredAt: new Date(),
        lastSeenAt: new Date()
      });
    }

    await dbBridge.logAudit({
      action: 'USER_REGISTERED',
      performedBy: req.user ? req.user.employeeId : cleanEmployeeId,
      targetEmployeeId: cleanEmployeeId,
      entityType: 'user',
      entityId: String(user._id),
      details: {
        role: user.role,
        email: user.email,
        faceEnrolled: !!faceEnrollmentResult,
        workplaceId: user.assignedWorkplaceId
      }
    });

    const token = jwt.sign(
      {
        employeeId: user.employeeId,
        role: user.role,
        workplaceId: user.assignedWorkplaceId || null,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully with biometric face enrollment.',
      token,
      user: {
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedWorkplaceId: user.assignedWorkplaceId,
        leaveBalance: user.leaveBalance,
        isDeviceBound: !!boundDeviceId,
        boundDeviceId: boundDeviceId || null,
        isFaceEnrolled: !!faceEnrollmentResult,
        mobileNumber: user.mobileNumber || null,
        isMobileVerified: Boolean(user.isMobileVerified),
        isEmailVerified: Boolean(user.isEmailVerified),
        authProvider: user.authProvider || 'local'
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
  }
}

/**
 * Log in with Employee ID / Email and Password
 */
async function login(req, res) {
  try {
    const rawIdentifier = req.body.identifier || req.body.employeeId || req.body.email;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID or Email and Password are required.'
      });
    }

    const cleanIdentifier = String(rawIdentifier).trim();
    const user = await dbBridge.findUser({
      $or: [
        { employeeId: cleanIdentifier.toUpperCase() },
        { email: cleanIdentifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended or deactivated. Contact HR.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    const activeDevice = await dbBridge.findDevice({
      employeeId: user.employeeId,
      isBound: true
    });

    const faceEnrollment = await dbBridge.findFaceEnrollment({ employeeId: user.employeeId });

    const token = jwt.sign(
      {
        employeeId: user.employeeId,
        role: user.role,
        workplaceId: user.assignedWorkplaceId || null,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedWorkplaceId: user.assignedWorkplaceId || null,
        leaveBalance: user.leaveBalance,
        isDeviceBound: !!activeDevice,
        boundDeviceId: activeDevice ? activeDevice.deviceId : null,
        isFaceEnrolled: !!(faceEnrollment && faceEnrollment.enrollmentStatus === 'enrolled'),
        mobileNumber: user.mobileNumber || null,
        isMobileVerified: Boolean(user.isMobileVerified),
        isEmailVerified: Boolean(user.isEmailVerified),
        authProvider: user.authProvider || 'local',
        accountStatus: user.accountStatus
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
}

/**
 * Sign in using Firebase Google Authentication
 */
async function firebaseLogin(req, res) {
  try {
    const { email, name, idToken, googleId, deviceId, deviceModel } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Gmail address from Firebase Google authentication is required.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Look up employee by verified Gmail address
    const user = await dbBridge.findUser({ email: cleanEmail });

    if (!user) {
      return res.status(200).json({
        success: false,
        notRegistered: true,
        email: cleanEmail,
        name: name || '',
        message: 'This Gmail account is not registered yet. Please complete registration with biometric face enrollment.'
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended or deactivated. Contact your workplace administrator.'
      });
    }

    // Auto-bind device if deviceId provided
    let boundDeviceId = null;
    if (deviceId) {
      boundDeviceId = String(deviceId).trim();
      await dbBridge.saveDevice({
        employeeId: user.employeeId,
        deviceId: boundDeviceId,
        deviceModel: deviceModel || 'Web Client',
        osVersion: 'Web Browser',
        isBound: true,
        registeredAt: new Date(),
        lastSeenAt: new Date()
      });
    }

    const activeDevice = await dbBridge.findDevice({
      employeeId: user.employeeId,
      isBound: true
    });

    const faceEnrollment = await dbBridge.findFaceEnrollment({ employeeId: user.employeeId });

    await dbBridge.logAudit({
      action: 'USER_LOGIN_FIREBASE_GMAIL',
      performedBy: user.employeeId,
      targetEmployeeId: user.employeeId,
      entityType: 'user',
      entityId: String(user._id),
      details: { email: user.email, authProvider: 'firebase_google' }
    });

    const token = jwt.sign(
      {
        employeeId: user.employeeId,
        role: user.role,
        workplaceId: user.assignedWorkplaceId || null,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: 'Gmail Firebase login successful.',
      token,
      user: {
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedWorkplaceId: user.assignedWorkplaceId || null,
        leaveBalance: user.leaveBalance,
        isDeviceBound: !!activeDevice,
        boundDeviceId: activeDevice ? activeDevice.deviceId : null,
        isFaceEnrolled: !!(faceEnrollment && faceEnrollment.enrollmentStatus === 'enrolled'),
        mobileNumber: user.mobileNumber || null,
        isMobileVerified: Boolean(user.isMobileVerified),
        isEmailVerified: true,
        authProvider: 'firebase_google',
        accountStatus: user.accountStatus
      }
    });
  } catch (err) {
    console.error('Firebase login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to authenticate with Firebase Google login.'
    });
  }
}

/**
 * Log out user
 */
async function logout(req, res) {
  try {
    if (req.user) {
      await dbBridge.logAudit({
        action: 'USER_LOGOUT',
        performedBy: req.user.employeeId,
        targetEmployeeId: req.user.employeeId,
        entityType: 'user',
        entityId: String(req.user._id)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, error: 'Internal error during logout.' });
  }
}

/**
 * Request OTP for device registration
 */
async function requestOtp(req, res) {
  try {
    const { employeeId, password, deviceId, deviceModel = '' } = req.body;

    if (!employeeId || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, password, and device ID are required.'
      });
    }

    const cleanEmployeeId = employeeId.trim().toUpperCase();
    const user = await dbBridge.findUser({ employeeId: cleanEmployeeId });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid employee credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid employee credentials.' });
    }

    // Invalidate prior active OTPs
    await dbBridge.invalidateActiveOtps(cleanEmployeeId);

    const rawOtp = otpService.generateSecureOtp();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await dbBridge.createOtp({
      employeeId: cleanEmployeeId,
      deviceId: deviceId.trim(),
      deviceModel,
      hashedOtp,
      expiresAt,
      attemptCount: 0,
      maxAttempts: 3,
      isConsumed: false
    });

    const deliveryResult = await otpService.dispatchOtp(cleanEmployeeId, rawOtp, user.email);

    return res.status(200).json({
      success: true,
      message: `OTP dispatched to registered contact for employee ${cleanEmployeeId}. Valid for 5 minutes.`,
      channel: deliveryResult.channel,
      expiresAt,
      debugOtp: deliveryResult.debugOtp,
      otp: deliveryResult.debugOtp
    });
  } catch (err) {
    console.error('OTP request error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate OTP.' });
  }
}

/**
 * Verify OTP and bind the device to the employee's account
 */
async function verifyOtpAndBindDevice(req, res) {
  try {
    const { employeeId, deviceId, deviceModel = '', osVersion = '', otp } = req.body;

    if (!employeeId || !deviceId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, Device ID, and OTP are required.'
      });
    }

    const cleanEmployeeId = employeeId.trim().toUpperCase();
    const cleanDeviceId = deviceId.trim();

    const otpRecord = await dbBridge.findLatestOtp(cleanEmployeeId, cleanDeviceId);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'No active OTP request found for this device. Please request a new OTP.'
      });
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      otpRecord.isConsumed = true;
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new OTP.' });
    }

    if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
      otpRecord.isConsumed = true;
      return res.status(400).json({ success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    otpRecord.attemptCount += 1;
    const isMatch = await bcrypt.compare(otp.trim(), otpRecord.hashedOtp);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: `Invalid OTP. ${otpRecord.maxAttempts - otpRecord.attemptCount} attempt(s) remaining.`
      });
    }

    otpRecord.isConsumed = true;
    otpRecord.consumedAt = new Date();

    // Invalidate prior bindings for this employee
    await dbBridge.invalidateEmployeeDevices(cleanEmployeeId, cleanDeviceId);

    // Save active device binding
    const device = await dbBridge.saveDevice({
      employeeId: cleanEmployeeId,
      deviceId: cleanDeviceId,
      deviceModel: deviceModel || 'Android Device',
      osVersion: osVersion || 'Android 14',
      isBound: true,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      revokedAt: null
    });

    await dbBridge.logAudit({
      action: 'DEVICE_BOUND',
      performedBy: cleanEmployeeId,
      targetEmployeeId: cleanEmployeeId,
      entityType: 'device',
      entityId: String(device._id),
      details: { deviceId: cleanDeviceId, deviceModel }
    });

    return res.status(200).json({
      success: true,
      message: 'Device successfully registered and bound to account.',
      device: {
        employeeId: device.employeeId,
        deviceId: device.deviceId,
        deviceModel: device.deviceModel,
        isBound: device.isBound,
        registeredAt: device.registeredAt
      }
    });
  } catch (err) {
    console.error('Device binding error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during device binding.' });
  }
}

/**
 * Retrieve current active device binding for an employee
 */
async function getDeviceBinding(req, res) {
  try {
    const employeeId = req.params.employeeId ? req.params.employeeId.toUpperCase() : req.user.employeeId;

    if (req.user.role !== 'admin' && req.user.employeeId !== employeeId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view other employee device bindings.' });
    }

    const device = await dbBridge.findDevice({ employeeId, isBound: true });

    return res.status(200).json({
      success: true,
      isBound: !!device,
      device: device || null
    });
  } catch (err) {
    console.error('Get device error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve device binding.' });
  }
}

/**
 * Retrieve current authenticated user profile for session synchronization
 */
async function getMe(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }

    const activeDevice = await dbBridge.findDevice({
      employeeId: user.employeeId,
      isBound: true
    });

    const faceEnrollment = await dbBridge.findFaceEnrollment({ employeeId: user.employeeId });

    return res.status(200).json({
      success: true,
      user: {
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedWorkplaceId: user.assignedWorkplaceId || null,
        leaveBalance: user.leaveBalance,
        isDeviceBound: !!activeDevice,
        boundDeviceId: activeDevice ? activeDevice.deviceId : null,
        isFaceEnrolled: !!(faceEnrollment && faceEnrollment.enrollmentStatus === 'enrolled'),
        mobileNumber: user.mobileNumber || null,
        isMobileVerified: Boolean(user.isMobileVerified),
        accountStatus: user.accountStatus
      }
    });
  } catch (err) {
    console.error('Get profile session error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve session profile.' });
  }
}

/**
 * Send SMS OTP for new employee registration
 */
async function sendRegistrationOtp(req, res) {
  try {
    const rawPhone = req.body.phone || req.body.mobileNumber;
    if (!rawPhone) {
      return res.status(400).json({ success: false, error: 'Mobile phone number is required.' });
    }

    const result = await smsService.sendRegistrationOtp(rawPhone, dbBridge);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to dispatch verification OTP.',
      remainingSeconds: err.remainingSeconds
    });
  }
}

/**
 * Verify SMS OTP and issue signed Phone Verification Token
 */
async function verifyRegistrationOtp(req, res) {
  try {
    const rawPhone = req.body.phone || req.body.mobileNumber;
    const otp = req.body.otp;

    if (!rawPhone || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Mobile phone number and verification OTP code are required.'
      });
    }

    const result = await smsService.verifyRegistrationOtp(rawPhone, otp, dbBridge);
    return res.status(200).json({
      success: true,
      message: result.message,
      phone: result.phone,
      verificationToken: result.verificationToken
    });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({
      success: false,
      error: err.message || 'OTP verification failed.'
    });
  }
}

/**
 * Send Email Verification for Registration
 */
async function sendRegistrationEmail(req, res) {
  try {
    const rawEmail = req.body.email;
    if (!rawEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const result = await emailService.sendRegistrationEmail(rawEmail, dbBridge);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to dispatch verification email.'
    });
  }
}

/**
 * Handle 1-click Mobile Verification Link
 */
async function verifyEmailLink(req, res) {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Verification Error</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #fef2f2; color: #991b1b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
            .card { background: white; border-radius: 16px; padding: 32px 24px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #fee2e2; }
            h1 { font-size: 20px; margin: 16px 0 8px; color: #b91c1c; }
            p { color: #64748b; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size: 48px;">⚠️</div>
            <h1>Verification Token Missing</h1>
            <p>No verification token was provided in the link. Please open the link directly from your email.</p>
          </div>
        </body>
        </html>
      `);
    }

    const result = emailService.verifyEmailByToken(token);
    if (!result.valid) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Verification Expired</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #fef2f2; color: #991b1b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
            .card { background: white; border-radius: 16px; padding: 32px 24px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #fee2e2; }
            h1 { font-size: 20px; margin: 16px 0 8px; color: #b91c1c; }
            p { color: #64748b; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size: 48px;">❌</div>
            <h1>Verification Link Expired or Invalid</h1>
            <p>${result.error || 'This link has expired or has already been used.'}</p>
            <p style="margin-top: 20px; font-weight: 600; color: #1e293b;">Please return to your computer and request a new verification email.</p>
          </div>
        </body>
        </html>
      `);
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Email Verified Successfully</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #166534; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; border-radius: 20px; padding: 36px 28px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04); border: 1px solid #bbf7d0; box-sizing: border-box; }
          .badge-icon { width: 72px; height: 72px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 38px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
          h1 { font-size: 22px; font-weight: 800; color: #14532d; margin: 0 0 10px; }
          .email-chip { display: inline-block; background: #f1f5f9; color: #334155; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; word-break: break-all; }
          p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
          .status-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; color: #64748b; }
          .highlight { color: #16a34a; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge-icon">✓</div>
          <h1>Gmail Verified!</h1>
          <div class="email-chip">${result.email}</div>
          <p>
            Your email has been verified from this mobile device.
          </p>
          <div class="status-box">
            <span class="highlight">Next Step:</span> Return to the registration screen on your computer. It has automatically detected this verification and unlocked <strong>Biometric Face Enrollment</strong> and Workplace Setup.
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`Verification internal error: ${err.message}`);
  }
}

/**
 * Verify 6-digit Code Entered on Screen
 */
async function verifyEmailCode(req, res) {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and 6-digit verification code are required.'
      });
    }

    const result = emailService.verifyEmailByCode(sessionId, code);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({
      success: false,
      error: err.message || 'Email verification failed.'
    });
  }
}

/**
 * Check Real-time Verification Status (Polled by Desktop Registration)
 */
async function checkEmailVerificationStatus(req, res) {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required.' });
    }

    const result = emailService.checkVerificationStatus(sessionId);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to check verification status.'
    });
  }
}

module.exports = {
  register,
  login,
  firebaseLogin,
  logout,
  getMe,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  sendRegistrationEmail,
  verifyEmailLink,
  verifyEmailCode,
  checkEmailVerificationStatus,
  requestOtp,
  verifyOtpAndBindDevice,
  getDeviceBinding
};
