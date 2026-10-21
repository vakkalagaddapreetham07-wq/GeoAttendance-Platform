const mongoose = require('mongoose');

const faceEnrollmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      index: true
    },
    workplaceId: {
      type: String,
      required: true,
      index: true
    },
    enrollmentStatus: {
      type: String,
      enum: ['enrolled', 'revoked', 'pending'],
      default: 'enrolled',
      index: true
    },
    // Encrypted face embedding (AES-256-GCM)
    // Never store raw photos or plaintext biometric vectors
    protectedEmbedding: {
      iv: { type: String, required: true },
      ciphertext: { type: String, required: true },
      authTag: { type: String, required: true },
      dimension: { type: Number, default: 128 },
      algorithm: { type: String, default: 'aes-256-gcm' }
    },
    modelName: {
      type: String,
      default: 'opencv_sface_yunet',
      required: true
    },
    modelVersion: {
      type: String,
      default: '1.0.0',
      required: true
    },
    consentGiven: {
      type: Boolean,
      required: true,
      default: false
    },
    consentVersion: {
      type: String,
      default: 'v1.0'
    },
    consentTimestamp: {
      type: Date,
      default: Date.now
    },
    consentStatement: {
      type: String,
      default: 'I consent to biometric face verification solely for work attendance identity validation and fraud prevention.'
    },
    qualityMetrics: {
      sharpness: { type: Number, default: 0 },
      brightness: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 }
    },
    auditLog: [
      {
        action: {
          type: String,
          enum: ['enrolled', 'verified', 're_enrolled', 'revoked', 'verify_failed'],
          required: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        similarityScore: {
          type: Number,
          default: null
        },
        ip: String,
        userAgent: String,
        details: String
      }
    ]
  },
  {
    timestamps: true
  }
);

faceEnrollmentSchema.index({ employeeId: 1, workplaceId: 1 }, { unique: true });

module.exports = mongoose.model('FaceEnrollment', faceEnrollmentSchema);
