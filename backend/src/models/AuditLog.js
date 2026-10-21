const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    performedBy: {
      type: String,
      required: true
    },
    targetEmployeeId: {
      type: String,
      index: true
    },
    entityType: {
      type: String,
      enum: ['device', 'geofence', 'attendance', 'leave', 'shift_schedule', 'shift', 'user', 'membership', 'workplace'],
      required: true
    },
    entityId: {
      type: String
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
