const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
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
    leaveType: {
      type: String,
      enum: ['sick', 'casual', 'annual', 'unpaid'],
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    daysCount: {
      type: Number,
      required: true,
      min: 1
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: String,
      default: null
    },
    decisionTimestamp: {
      type: Date,
      default: null
    },
    decisionNote: {
      type: String,
      default: ''
    },
    notificationRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
