const mongoose = require('mongoose');

const otpRecordSchema = new mongoose.Schema(
  {
    purpose: {
      type: String,
      enum: ['registration', 'device_binding'],
      default: 'registration'
    },
    phone: {
      type: String,
      index: true,
      default: null
    },
    employeeId: {
      type: String,
      required: false,
      index: true,
      default: null
    },
    deviceId: {
      type: String,
      required: false,
      default: null
    },
    deviceModel: {
      type: String,
      default: ''
    },
    hashedOtp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '10m' } // auto-cleanup after 10m
    },
    attemptCount: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    isConsumed: {
      type: Boolean,
      default: false
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('OtpRecord', otpRecordSchema);
