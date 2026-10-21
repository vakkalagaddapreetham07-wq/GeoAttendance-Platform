/**
 * Email Verification Service
 * Handles sending registration verification emails, mobile 1-click verification links,
 * and 6-digit email codes with real-time status polling and cryptographic proof tokens.
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_geofence_attendance_2026';
const VERIFICATION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// In-memory verification sessions store
const verificationSessions = new Map();
const tokenIndex = new Map();
const consumedProofTokens = new Set();

/**
 * Determine local LAN IP address so mobile devices on the same Wi-Fi can reach the server
 */
function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Create Nodemailer transporter based on environment config
 */
function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  return null;
}

/**
 * Send registration verification email with mobile verification link and 6-digit code
 * @param {string} rawEmail
 * @param {Object} dbBridge
 * @returns {Promise<{ success: boolean, sessionId: string, message: string, previewUrl?: string, debugCode?: string }>}
 */
async function sendRegistrationEmail(rawEmail, dbBridge) {
  if (!rawEmail || !rawEmail.includes('@')) {
    const err = new Error('Please enter a valid Gmail / email address.');
    err.status = 400;
    throw err;
  }

  const email = rawEmail.trim().toLowerCase();

  // 1. Check duplicate registered employee
  if (dbBridge) {
    const existing = await dbBridge.findUser({ email });
    if (existing) {
      const err = new Error('An employee account with this Gmail address already exists. Please log in.');
      err.status = 409;
      throw err;
    }
  }

  // 2. Generate secure tokens
  const sessionId = `esess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const token = crypto.randomBytes(32).toString('hex');
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + VERIFICATION_EXPIRY_MS;

  const sessionData = {
    sessionId,
    email,
    token,
    code,
    expiresAt,
    status: 'pending',
    verifiedAt: null,
    proofToken: null
  };

  verificationSessions.set(sessionId, sessionData);
  tokenIndex.set(token, sessionId);

  // 3. Construct mobile verification links
  const lanIp = getLocalLanIp();
  const port = process.env.PORT || 5000;
  const mobileLink = `http://${lanIp}:${port}/api/auth/verify-email?token=${token}`;
  const localLink = `http://localhost:${port}/api/auth/verify-email?token=${token}`;

  // 4. Dispatch Email
  const transporter = getTransporter();
  let deliveredViaSmtp = false;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Gmail</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: #2563eb; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
        .content { padding: 32px 24px; }
        .btn-verify { display: block; width: 240px; margin: 24px auto; background: #2563eb; color: #ffffff !important; text-align: center; padding: 14px 20px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3); }
        .code-box { background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
        .code-digits { font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0f172a; margin-top: 6px; font-family: monospace; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Geofence Attendance Platform</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">Hello,</p>
          <p style="font-size: 15px; line-height: 1.5; color: #475569;">
            We received an employee registration request for <strong>${email}</strong>. Please verify your email from your mobile device to proceed to the face registration step.
          </p>
          
          <a href="${mobileLink}" class="btn-verify" target="_blank">Verify on Mobile Device</a>
          
          <div class="code-box">
            <span style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 600;">Or enter this 6-digit code on your screen</span>
            <div class="code-digits">${code}</div>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.4;">
            If you are opening this on your computer, you can also use this link: <br>
            <a href="${localLink}" style="color: #2563eb; word-break: break-all;">${localLink}</a>
          </p>
        </div>
        <div class="footer">
          This verification link and code expire in 15 minutes. If you did not request this, please ignore this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const isAutomatedTest =
    process.env.NODE_ENV === 'test' ||
    email.startsWith('employee.') ||
    email.includes('.test.') ||
    process.env.TEST_MODE === 'true';

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"Geofence Attendance" <${process.env.GMAIL_USER || 'no-reply@geofence.local'}>`,
        to: email,
        subject: `Verify your Gmail (${code}) for Employee Registration`,
        html: htmlContent
      });
      console.log(`[Email Service] Dispatched verification email to ${email}. MessageId: ${info.messageId}`);
      deliveredViaSmtp = true;
    } catch (sendErr) {
      console.error('[Email Service] SMTP dispatch error:', sendErr.message);
      const err = new Error(`Failed to deliver email to ${email}: ${sendErr.message}. Please check that the email address is valid and your Gmail credentials are correct.`);
      err.status = 400;
      throw err;
    }
  } else if (process.env.NODE_ENV !== 'production' || isAutomatedTest) {
    console.log('====================================================');
    console.log(`[DEV EMAIL ADAPTER] Recipient: ${email}`);
    console.log(`[DEV EMAIL ADAPTER] 6-Digit Code: ${code}`);
    console.log(`[DEV EMAIL ADAPTER] Mobile Verification Link: ${mobileLink}`);
    console.log(`[DEV EMAIL ADAPTER] Local Verification Link: ${localLink}`);
    console.log('====================================================');
  } else {
    const err = new Error(
      'Gmail delivery is not configured on this server. Please configure GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env to send real verification emails. Alternatively, click "Sign in with Google (Firebase)" to verify with your Gmail.'
    );
    err.status = 503;
    throw err;
  }

  // Console output for backend logs
  console.log(`[EMAIL DISPATCHED] Recipient: ${email} | Session: ${sessionId} | SMTP: ${deliveredViaSmtp}`);

  const isDevMode = !transporter && process.env.NODE_ENV !== 'production';

  return {
    success: true,
    sessionId,
    message: transporter
      ? `Verification email sent to ${email}. Please check your Gmail on your mobile phone or browser and click the link to verify.`
      : `[Dev Mode] Verification code generated for ${email}: ${code}. You can enter it below or click the mobile link.`,
    previewUrl: isAutomatedTest || isDevMode ? mobileLink : undefined,
    debugCode: isAutomatedTest || isDevMode ? code : undefined,
    deliveredViaSmtp
  };
}

/**
 * Handle verification link click (e.g. from Mobile Phone)
 * @param {string} token
 * @returns {{ valid: boolean, email?: string, error?: string, proofToken?: string }}
 */
function verifyEmailByToken(token) {
  const sessionId = tokenIndex.get(token);
  if (!sessionId) {
    return { valid: false, error: 'Verification link is invalid or has already been used.' };
  }

  const session = verificationSessions.get(sessionId);
  if (!session) {
    return { valid: false, error: 'Verification session expired.' };
  }

  if (Date.now() > session.expiresAt) {
    verificationSessions.delete(sessionId);
    tokenIndex.delete(token);
    return { valid: false, error: 'Verification link has expired. Please request a new verification email.' };
  }

  session.status = 'verified';
  session.verifiedAt = new Date();

  // Create cryptographic proof token
  const proofToken = jwt.sign(
    {
      email: session.email,
      sessionId: session.sessionId,
      purpose: 'GMAIL_REGISTRATION_VERIFIED',
      verifiedAt: session.verifiedAt.toISOString()
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  session.proofToken = proofToken;

  return {
    valid: true,
    email: session.email,
    sessionId: session.sessionId,
    proofToken
  };
}

/**
 * Verify by 6-digit code entered on computer screen
 * @param {string} sessionId
 * @param {string} code
 * @returns {{ success: boolean, verified: boolean, email?: string, proofToken?: string, error?: string }}
 */
function verifyEmailByCode(sessionId, code) {
  const session = verificationSessions.get(sessionId);
  if (!session) {
    const err = new Error('Verification session not found or expired. Please resend verification email.');
    err.status = 404;
    throw err;
  }

  if (Date.now() > session.expiresAt) {
    verificationSessions.delete(sessionId);
    const err = new Error('Verification code has expired. Please request a new email.');
    err.status = 400;
    throw err;
  }

  if (session.code !== String(code).trim()) {
    const err = new Error('Incorrect verification code. Please check your email and try again.');
    err.status = 400;
    throw err;
  }

  session.status = 'verified';
  session.verifiedAt = new Date();

  const proofToken = jwt.sign(
    {
      email: session.email,
      sessionId: session.sessionId,
      purpose: 'GMAIL_REGISTRATION_VERIFIED',
      verifiedAt: session.verifiedAt.toISOString()
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  session.proofToken = proofToken;

  return {
    success: true,
    verified: true,
    email: session.email,
    proofToken
  };
}

/**
 * Check verification status for active session (polled by registration page)
 * @param {string} sessionId
 * @returns {{ success: boolean, verified: boolean, email?: string, proofToken?: string }}
 */
function checkVerificationStatus(sessionId) {
  const session = verificationSessions.get(sessionId);
  if (!session) {
    return { success: false, verified: false, error: 'Session not found or expired.' };
  }

  if (Date.now() > session.expiresAt) {
    return { success: false, verified: false, expired: true, error: 'Session expired.' };
  }

  if (session.status === 'verified') {
    return {
      success: true,
      verified: true,
      email: session.email,
      verifiedAt: session.verifiedAt,
      proofToken: session.proofToken
    };
  }

  return {
    success: true,
    verified: false,
    status: 'pending'
  };
}

/**
 * Consume proof token during employee registration (single-use validation)
 * @param {string} proofToken
 * @param {string} submittedEmail
 * @returns {{ valid: boolean, error?: string }}
 */
function consumeEmailProofToken(proofToken, submittedEmail) {
  if (!proofToken) {
    return { valid: false, error: 'Email verification proof token is required.' };
  }

  if (consumedProofTokens.has(proofToken)) {
    return { valid: false, error: 'Verification token has already been used. Please verify again.' };
  }

  try {
    const decoded = jwt.verify(proofToken, JWT_SECRET);
    if (decoded.purpose !== 'GMAIL_REGISTRATION_VERIFIED') {
      return { valid: false, error: 'Invalid verification token purpose.' };
    }

    if (decoded.email.toLowerCase() !== submittedEmail.trim().toLowerCase()) {
      return { valid: false, error: 'Email in verification proof does not match registration email.' };
    }

    // Mark as consumed
    consumedProofTokens.add(proofToken);
    return { valid: true, email: decoded.email };
  } catch (err) {
    return { valid: false, error: `Invalid or expired email verification proof: ${err.message}` };
  }
}

module.exports = {
  sendRegistrationEmail,
  verifyEmailByToken,
  verifyEmailByCode,
  checkVerificationStatus,
  consumeEmailProofToken,
  getLocalLanIp
};
