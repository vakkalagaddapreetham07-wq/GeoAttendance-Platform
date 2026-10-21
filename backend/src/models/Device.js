const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    workplaceId: {
      type: String,
      default: null,
      index: true
    },
    employeeId: {
      type: String,
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceModel: {
      type: String,
      default: 'Unknown Device'
    },
    osVersion: {
      type: String,
      default: 'Unknown OS'
    },
    isBound: {
      type: Boolean,
      default: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Device', deviceSchema);
