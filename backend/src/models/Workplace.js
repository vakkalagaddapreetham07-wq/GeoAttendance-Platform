const mongoose = require('mongoose');

const workplaceSchema = new mongoose.Schema(
  {
    workplaceId: {
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
    organizationName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: [
        'IT & Software', 'Healthcare & Clinics', 'Retail & Commerce', 'Education & Institutes', 
        'Manufacturing & Logistics', 'Corporate Office', 'Hospitality', 'Other',
        'it_tech', 'healthcare', 'retail', 'education', 'logistics', 'corporate', 'hospitality', 'other'
      ],
      default: 'Corporate Office'
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, required: true },
      region: { type: String, default: '' },
      state: { type: String, required: true },
      country: { type: String, default: 'India' },
      postalCode: { type: String, default: '' }
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true
    },
    adminEmployeeId: {
      type: String,
      required: true,
      unique: true, // Rule: Exactly one active workplace administrator per workplace in v1.0
      index: true
    },
    adminName: {
      type: String,
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'suspended', 'rejected'],
      default: 'approved',
      index: true
    },
    verificationNote: {
      type: String,
      default: ''
    },
    reviewedBy: {
      type: String,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    geofence: {
      center: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
      },
      radius: {
        type: Number,
        default: 50 // Default 50m, configurable by workplace admin
      },
      locationName: {
        type: String,
        default: 'Main Office Site'
      }
    },
    shiftSchedule: {
      shiftStart: { type: String, default: '09:00' },
      shiftEnd: { type: String, default: '18:00' },
      gracePeriodMinutes: { type: Number, default: 15 },
      timezone: { type: String, default: 'Asia/Kolkata' }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    adminReplacementRequest: {
      hasPendingRequest: { type: Boolean, default: false },
      newAdminEmployeeId: { type: String, default: null },
      newAdminName: { type: String, default: null },
      newAdminEmail: { type: String, default: null },
      reason: { type: String, default: '' },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' }
    }
  },
  {
    timestamps: true
  }
);

workplaceSchema.index({ name: 'text', organizationName: 'text', 'address.city': 'text' });

module.exports = mongoose.model('Workplace', workplaceSchema);
