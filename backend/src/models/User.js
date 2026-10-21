const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['employee', 'admin', 'superadmin'],
      default: 'employee'
    },
    mobileNumber: {
      type: String,
      default: ''
    },
    isMobileVerified: {
      type: Boolean,
      default: false
    },
    assignedWorkplaceId: {
      type: String,
      default: null,
      index: true
    },
    department: {
      type: String,
      default: 'Operations'
    },
    leaveBalance: {
      sick: { type: Number, default: 10 },
      casual: { type: Number, default: 12 },
      annual: { type: Number, default: 15 }
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
