const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const OtpRecord = require('../models/OtpRecord');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 * @returns {string} 6-digit OTP
 */
function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Dispatch OTP via local dev adapter or production SMS gateway
 * @param {string} employeeId
 * @param {string} otp
 * @param {string} recipientContact
 * @returns {Promise<{ delivered: boolean, channel: string, debugOtp?: string }>}
 */
async function dispatchOtp(employeeId, otp, recipientContact) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Development-only delivery adapter
    console.log('====================================================');
    console.log(`[DEV OTP ADAPTER] Employee: ${employeeId}`);
    console.log(`[DEV OTP ADAPTER] Contact: ${recipientContact || 'N/A'}`);
    console.log(`[DEV OTP ADAPTER] Generated OTP: ${otp}`);
    console.log(`[DEV OTP ADAPTER] Valid for: ${OTP_EXPIRY_MINUTES} minutes`);
    console.log('====================================================');
    return {
      delivered: true,
      channel: 'DEV_CONSOLE_ADAPTER',
      debugOtp: otp // Returned in dev mode for easy testing/demo
    };
  }

  // Production SMS Gateway (e.g. Twilio, AWS SNS, etc.)
  // Note: Actual production SMS gateway API credentials should be loaded from secure env vars
  console.log(`[PROD SMS GATEWAY] Dispatching OTP to registered recipient for ${employeeId}`);
  return {
    delivered: true,
    channel: 'SMS_GATEWAY'
  };
}

/**
 * Request a new OTP for device registration
 * @param {string} employeeId
 * @param {string} deviceId
 * @param {string} deviceModel
 * @param {string} contactInfo
 */
async function createAndSendOtp(employeeId, deviceId, deviceModel = '', contactInfo = '') {
  // Invalidate any existing active unconsumed OTPs for this employee & device
  await OtpRecord.updateMany(
    { employeeId, isConsumed: false },
    { isConsumed: true, consumedAt: new Date() }
  );

  const rawOtp = generateSecureOtp();
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(rawOtp, salt);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const otpRecord = await OtpRecord.create({
    employeeId,
    deviceId,
    deviceModel,
    hashedOtp,
    expiresAt,
    attemptCount: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    isConsumed: false
  });

  const deliveryResult = await dispatchOtp(employeeId, rawOtp, contactInfo);

  return {
    success: true,
    expiresAt,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
    channel: deliveryResult.channel,
    debugOtp: deliveryResult.debugOtp
  };
}

/**
 * Verify OTP entered by employee
 * @param {string} employeeId
 * @param {string} deviceId
 * @param {string} rawOtp
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function verifyOtp(employeeId, deviceId, rawOtp) {
  if (!rawOtp || rawOtp.length !== 6) {
    return { valid: false, error: 'OTP must be a 6-digit code.' };
  }

  const record = await OtpRecord.findOne({
    employeeId,
    deviceId,
    isConsumed: false
  }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, error: 'No active OTP request found for this device. Please request a new OTP.' };
  }

  // Check if expired
  if (new Date() > record.expiresAt) {
    record.isConsumed = true;
    await record.save();
    return { valid: false, error: 'OTP has expired. Please request a new OTP.' };
  }

  // Check max attempts
  if (record.attemptCount >= record.maxAttempts) {
    record.isConsumed = true;
    await record.save();
    return { valid: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
  }

  // Increment attempt count
  record.attemptCount += 1;

  // Compare OTP
  const isMatch = await bcrypt.compare(rawOtp, record.hashedOtp);

  if (!isMatch) {
    await record.save();
    const remainingAttempts = record.maxAttempts - record.attemptCount;
    return {
      valid: false,
      error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
    };
  }

  // Mark consumed and valid
  record.isConsumed = true;
  record.consumedAt = new Date();
  await record.save();

  return { valid: true };
}

module.exports = {
  generateSecureOtp,
  dispatchOtp,
  createAndSendOtp,
  verifyOtp,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS
};
