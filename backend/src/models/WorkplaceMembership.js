const mongoose = require('mongoose');

const workplaceMembershipSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended', 'ended'],
      default: 'pending',
      index: true
    },
    joinRequestedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: String,
      default: null
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    roleInWorkplace: {
      type: String,
      default: 'employee'
    },
    department: {
      type: String,
      default: 'General'
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// In v1.0, enforce one active membership per employee
workplaceMembershipSchema.index({ employeeId: 1, workplaceId: 1 }, { unique: true });

module.exports = mongoose.model('WorkplaceMembership', workplaceMembershipSchema);
