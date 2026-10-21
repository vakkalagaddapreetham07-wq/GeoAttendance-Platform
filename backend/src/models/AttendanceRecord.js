const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    workplaceId: {
      type: String,
      required: true,
      index: true
    },
    employeeId: {
      type: String,
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true
    },
    attendanceDate: {
      type: String,
      required: true,
      index: true // YYYY-MM-DD
    },
    checkIn: {
      timestamp: {
        type: Date,
        required: true
      },
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      },
      accuracy: {
        type: Number,
        default: 10.0 // meters
      },
      distanceToCenter: {
        type: Number,
        default: 0.0 // meters
      }
    },
    checkOut: {
      timestamp: {
        type: Date,
        default: null
      },
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      },
      accuracy: {
        type: Number,
        default: null
      },
      distanceToCenter: {
        type: Number,
        default: null
      }
    },
    durationMinutes: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['checked_in', 'completed', 'incomplete'],
      default: 'checked_in',
      index: true
    },
    geofenceCenter: {
      latitude: Number,
      longitude: Number,
      radius: {
        type: Number,
        default: 50
      }
    },
    anomaly: {
      isAnomaly: {
        type: Boolean,
        default: false,
        index: true
      },
      score: {
        type: Number,
        default: 0
      },
      mlScore: {
        type: Number,
        default: null
      },
      mlPrediction: {
        type: Number, // 1: normal, -1: anomaly
        default: 1
      },
      detectionSource: {
        type: String,
        enum: ['none', 'ml_only', 'hard_rule_only', 'both'],
        default: 'none',
        index: true
      },
      hardRuleViolations: {
        type: [String],
        default: []
      },
      features: {
        checkInDeviation: { type: Number, default: 0 },
        checkOutDeviation: { type: Number, default: 0 },
        geofenceDuration: { type: Number, default: 0 },
        distanceFromCenter: { type: Number, default: 0 }
      },
      reviewStatus: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'approved', 'rejected'],
        default: 'pending'
      },
      reviewedBy: {
        type: String,
        default: null
      },
      reviewNotes: {
        type: String,
        default: ''
      },
      explanation: {
        type: String,
        default: ''
      },
      assessedAt: {
        type: Date,
        default: null
      }
    },
    isSynthetic: {
      type: Boolean,
      default: false
    },
    auditLog: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' },
        changes: { type: Object, default: {} }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound index to ensure fast queries and lookup by employee & date
attendanceRecordSchema.index({ employeeId: 1, attendanceDate: 1 });
attendanceRecordSchema.index({ 'anomaly.isAnomaly': 1, 'anomaly.reviewStatus': 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
