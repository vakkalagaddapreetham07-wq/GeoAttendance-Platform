const mongoose = require('mongoose');

const shiftScheduleSchema = new mongoose.Schema(
  {
    workplaceId: {
      type: String,
      default: null,
      index: true
    },
    name: {
      type: String,
      default: 'Standard Company Shift'
    },
    shiftStart: {
      type: String,
      required: true,
      default: '09:00' // 24-hour format HH:mm
    },
    shiftEnd: {
      type: String,
      required: true,
      default: '18:00' // 24-hour format HH:mm
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata' // Documented timezone policy
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15
    },
    isCompanyWide: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: String,
      default: 'SYSTEM_ADMIN'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ShiftSchedule', shiftScheduleSchema);
