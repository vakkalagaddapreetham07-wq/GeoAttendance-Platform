/**
 * Unified SMS Verification Service
 * Supports:
 * - Twilio Verify API (Recommended for Global / Direct developer setup)
 * - MSG91 SendOTP API (Recommended for India DLT-compliant low-cost delivery)
 * - Mock Mode (Local development & automated testing only; disallowed in production)
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'geofence_secret_key_development_2026';
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

// In-memory cooldown & attempt tracking
const resendTracker = new Map(); // normalizedPhone -> timestamp
const attemptTracker = new Map(); // normalizedPhone -> count
const phoneVerificationTokens = new Map(); // tokenId -> { phone, expiresAt, used }

/**
 * Clean & normalize phone number to E.164 international standard
 * @param {string} rawPhone
 * @returns {string} E.164 formatted phone number (e.g. +919876543210)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('A valid phone number is required.');
  }

  // Remove spaces, hyphens, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();

  // If local Indian 10-digit number (e.g. 9876543210)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If prefixed with 0 (e.g. 09876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // If starts with 91 followed by 10 digits without plus
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If already starts with +
  if (/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    return cleaned;
  }

  throw new Error('Invalid mobile phone number format. Please provide a valid phone number with country code (e.g. +91 98765 43210).');
}

/**
 * Determine the active SMS provider from environment
 * @returns {'twilio' | 'msg91' | 'mock'}
 */
function getProvider() {
  const isProd = process.env.NODE_ENV === 'production';
  const configuredProvider = (process.env.SMS_PROVIDER || '').toLowerCase().trim();

  if (configuredProvider === 'twilio') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      if (isProd) {
        throw new Error('Twilio Verify credentials missing in production environment.');
      }
      console.warn('[SMS Provider] Twilio credentials incomplete; falling back to Mock mode in development.');
      return 'mock';
    }
    return 'twilio';
  }

  if (configuredProvider === 'msg91') {
    if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) {
      if (isProd) {
        throw new Error('MSG91 credentials missing in production environment.');
      }
      console.warn('[SMS Provider] MSG91 credentials incomplete; falling back to Mock mode in development.');
      return 'mock';
    }
    return 'msg91';
  }

  if (isProd) {
    throw new Error('SMS_PROVIDER must be explicitly configured as "twilio" or "msg91" in production. Mock mode is forbidden.');
  }

  return 'mock';
}

/**
 * Check if resend cooldown is active for a phone number
 * @param {string} phone
 * @returns {{ allowed: boolean, remainingSeconds: number }}
 */
function checkCooldown(phone) {
  const lastSent = resendTracker.get(phone);
  if (!lastSent) return { allowed: true, remainingSeconds: 0 };

  const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    return {
      allowed: false,
      remainingSeconds: RESEND_COOLDOWN_SECONDS - elapsedSeconds
    };
  }
  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Request real SMS OTP dispatch
 * @param {string} rawPhone
 * @param {Object} dbBridge
 * @returns {Promise<{ success: boolean, message: string, provider: string, cooldownSeconds: number, expiresInSeconds: number, debugOtp?: string }>}
 */
async function sendRegistrationOtp(rawPhone, dbBridge) {
  const phone = normalizePhoneNumber(rawPhone);

  // 1. Check duplicate registered user
  if (dbBridge) {
    const existing = await dbBridge.findUser({ mobileNumber: phone });
    if (existing) {
      const err = new Error('A user account with this mobile number already exists. Please log in or use another number.');
      err.status = 409;
      throw err;
    }
  }

  // 2. Enforce resend cooldown
  const cooldown = checkCooldown(phone);
  if (!cooldown.allowed) {
    const err = new Error(`Please wait ${cooldown.remainingSeconds} seconds before requesting a new OTP code.`);
    err.status = 429;
    err.remainingSeconds = cooldown.remainingSeconds;
    throw err;
  }

  const provider = getProvider();
  let result = null;

  if (provider === 'twilio') {
    // Official Twilio Verify API
    try {
      const authHeader = 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
      const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;

      const params = new URLSearchParams();
      params.append('To', phone);
      params.append('Channel', 'sms');

      const twilioRes = await axios.post(url, params.toString(), {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      console.log(`[Twilio Verify] Sent verification to ${phone}. Status: ${twilioRes.data.status}`);
      result = { provider: 'twilio', delivered: true };
    } catch (apiErr) {
      console.error('[Twilio Verify] Error dispatching verification:', apiErr.response?.data || apiErr.message);
      const message = apiErr.response?.data?.message || 'Twilio SMS dispatch failed. Please verify credentials or phone number.';
      const err = new Error(`SMS Provider Error: ${message}`);
      err.status = 502;
      throw err;
    }
  } else if (provider === 'msg91') {
    // Official MSG91 SendOTP API
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      const templateId = process.env.MSG91_TEMPLATE_ID;
      const cleanDigits = phone.replace('+', '');
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(cleanDigits)}&expiry=${OTP_EXPIRY_MINUTES}&otp_length=6`;

      const msg91Res = await axios.post(
        url,
        {},
        {
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (msg91Res.data.type === 'error') {
        throw new Error(msg91Res.data.message || 'MSG91 gateway rejected request.');
      }

      console.log(`[MSG91] Sent OTP to ${phone}. Response:`, msg91Res.data);
      result = { provider: 'msg91', delivered: true };
    } catch (apiErr) {
      console.error('[MSG91] Error dispatching OTP:', apiErr.response?.data || apiErr.message);
      const message = apiErr.response?.data?.message || apiErr.message || 'MSG91 SMS dispatch failed.';
      const err = new Error(`SMS Provider Error: ${message}`);
      err.status = 502;
      throw err;
    }
  } else {
    // Mock Mode (Local Development & Testing Only)
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (dbBridge) {
      await dbBridge.invalidateRegistrationOtps(phone);
      await dbBridge.createRegistrationOtp({
        phone,
        hashedOtp,
        expiresAt,
        attemptCount: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        isConsumed: false
      });
    }

    console.log('\n====================================================');
    console.log(`[DEV SMS ADAPTER - MOCK MODE]`);
    console.log(`Mobile Number: ${phone}`);
    console.log(`Verification OTP: ${rawOtp}`);
    console.log(`Valid for: ${OTP_EXPIRY_MINUTES} minutes (Max attempts: ${OTP_MAX_ATTEMPTS})`);
    console.log('====================================================\n');

    result = {
      provider: 'mock',
      delivered: true,
      debugOtp: process.env.NODE_ENV !== 'production' ? rawOtp : undefined
    };
  }

  // Update cooldown timestamp
  resendTracker.set(phone, Date.now());
  attemptTracker.delete(phone);

  return {
    success: true,
    message: `OTP sent successfully via SMS to ${phone}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
    provider: result.provider,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    debugOtp: result.debugOtp
  };
}

/**
 * Verify SMS OTP and issue signed Single-Use Phone Verification Token
 * @param {string} rawPhone
 * @param {string} rawOtp
 * @param {Object} dbBridge
 * @returns {Promise<{ valid: boolean, verificationToken: string, phone: string, message: string }>}
 */
async function verifyRegistrationOtp(rawPhone, rawOtp, dbBridge) {
  const phone = normalizePhoneNumber(rawPhone);
  const otp = String(rawOtp || '').trim();

  if (!otp || !/^\d{4,8}$/.test(otp)) {
    const err = new Error('Please enter a valid numeric verification code.');
    err.status = 400;
    throw err;
  }

  const provider = getProvider();
  let isValid = false;

  if (provider === 'twilio') {
    // Verify via Twilio Verify Check endpoint
    try {
      const authHeader = 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
      const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;

      const params = new URLSearchParams();
      params.append('To', phone);
      params.append('Code', otp);

      const twilioRes = await axios.post(url, params.toString(), {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      if (twilioRes.data.status === 'approved' && twilioRes.data.valid === true) {
        isValid = true;
      } else {
        const err = new Error('Invalid or expired OTP code. Please verify the code or request a new one.');
        err.status = 400;
        throw err;
      }
    } catch (apiErr) {
      if (apiErr.status === 400) throw apiErr;
      console.error('[Twilio Verify] Verification check error:', apiErr.response?.data || apiErr.message);
      const message = apiErr.response?.data?.message || 'Failed to verify OTP with SMS provider.';
      const err = new Error(message);
      err.status = 400;
      throw err;
    }
  } else if (provider === 'msg91') {
    // Verify via MSG91 Verify endpoint
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      const cleanDigits = phone.replace('+', '');
      const url = `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(otp)}&mobile=${encodeURIComponent(cleanDigits)}`;

      const msg91Res = await axios.post(
        url,
        {},
        {
          headers: { authkey: authKey },
          timeout: 10000
        }
      );

      if (msg91Res.data.type === 'success' || msg91Res.data.message?.toLowerCase().includes('verified')) {
        isValid = true;
      } else {
        const err = new Error(msg91Res.data.message || 'Invalid or expired OTP code.');
        err.status = 400;
        throw err;
      }
    } catch (apiErr) {
      if (apiErr.status === 400) throw apiErr;
      console.error('[MSG91] Error verifying OTP:', apiErr.response?.data || apiErr.message);
      const message = apiErr.response?.data?.message || 'Invalid OTP code.';
      const err = new Error(message);
      err.status = 400;
      throw err;
    }
  } else {
    // Mock / Local DB Verification
    if (!dbBridge) {
      throw new Error('Database bridge unavailable for OTP verification.');
    }

    const record = await dbBridge.findLatestRegistrationOtp(phone);
    if (!record) {
      const err = new Error('No active OTP request found for this mobile number. Please click "Send OTP" first.');
      err.status = 400;
      throw err;
    }

    if (new Date() > new Date(record.expiresAt)) {
      record.isConsumed = true;
      if (record.save) await record.save();
      const err = new Error('The OTP code has expired (validity is 5 minutes). Please request a new OTP.');
      err.status = 400;
      throw err;
    }

    if (record.attemptCount >= record.maxAttempts) {
      record.isConsumed = true;
      if (record.save) await record.save();
      const err = new Error('Maximum incorrect verification attempts exceeded. Please request a new OTP.');
      err.status = 400;
      throw err;
    }

    record.attemptCount += 1;
    const isMatch = await bcrypt.compare(otp, record.hashedOtp);

    if (!isMatch) {
      if (record.save) await record.save();
      const remaining = record.maxAttempts - record.attemptCount;
      const err = new Error(
        remaining > 0
          ? `Incorrect OTP code. ${remaining} attempt(s) remaining.`
          : 'Incorrect OTP code. Maximum attempts reached. Please request a new OTP.'
      );
      err.status = 400;
      throw err;
    }

    // Match confirmed
    record.isConsumed = true;
    record.consumedAt = new Date();
    if (record.save) await record.save();
    isValid = true;
  }

  if (!isValid) {
    const err = new Error('Verification failed. Invalid OTP code.');
    err.status = 400;
    throw err;
  }

  // Generate cryptographically signed single-use verification token
  const tokenId = crypto.randomUUID();
  const tokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes window to complete registration

  const verificationToken = jwt.sign(
    {
      purpose: 'PHONE_REGISTRATION_VERIFIED',
      phone,
      tokenId,
      verifiedAt: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Store in cache to guarantee single-use consumption
  phoneVerificationTokens.set(tokenId, {
    tokenId,
    phone,
    expiresAt: tokenExpiresAt,
    used: false
  });

  return {
    valid: true,
    verificationToken,
    phone,
    message: 'Mobile number verified successfully. You may now complete account registration.'
  };
}

/**
 * Validate and consume a Single-Use Phone Verification Token during account creation
 * @param {string} tokenString
 * @param {string} submittedPhone
 * @returns {{ valid: boolean, error?: string, phone?: string }}
 */
function consumePhoneVerificationToken(tokenString, submittedPhone) {
  if (!tokenString) {
    return {
      valid: false,
      error: 'Mobile phone number must be verified via SMS OTP before account registration.'
    };
  }

  let decoded;
  try {
    decoded = jwt.verify(tokenString, JWT_SECRET);
  } catch (err) {
    return {
      valid: false,
      error: 'Phone verification token is invalid or has expired. Please verify your phone number again.'
    };
  }

  if (decoded.purpose !== 'PHONE_REGISTRATION_VERIFIED' || !decoded.phone || !decoded.tokenId) {
    return {
      valid: false,
      error: 'Invalid phone verification token format.'
    };
  }

  const normalizedSubmitted = normalizePhoneNumber(submittedPhone);
  if (decoded.phone !== normalizedSubmitted) {
    return {
      valid: false,
      error: `Verification mismatch: The verified phone number (${decoded.phone}) does not match the registration phone number (${normalizedSubmitted}).`
    };
  }

  const cached = phoneVerificationTokens.get(decoded.tokenId);
  if (!cached) {
    // If not found in memory (e.g. server reload), check decoded expiration
    if (Date.now() > decoded.exp * 1000) {
      return { valid: false, error: 'Phone verification token has expired.' };
    }
  } else {
    if (cached.used) {
      return {
        valid: false,
        error: 'This phone verification token has already been consumed (replay prevention). Please verify again.'
      };
    }
    if (Date.now() > cached.expiresAt) {
      phoneVerificationTokens.delete(decoded.tokenId);
      return {
        valid: false,
        error: 'Phone verification token has expired (15m window). Please re-verify.'
      };
    }
    // Mark as consumed
    cached.used = true;
  }

  return {
    valid: true,
    phone: decoded.phone
  };
}

module.exports = {
  normalizePhoneNumber,
  getProvider,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  consumePhoneVerificationToken,
  RESEND_COOLDOWN_SECONDS,
  OTP_EXPIRY_MINUTES
};
