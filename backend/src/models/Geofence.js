const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema(
  {
    workplaceId: {
      type: String,
      default: null,
      index: true
    },
    employeeId: {
      type: String,
      default: null,
      index: true
    },
    center: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    radius: {
      type: Number,
      required: true,
      default: 50 // Exactly 50 meters as required by SRS v1.0
    },
    locationName: {
      type: String,
      default: 'Main Office Site'
    },
    configuredBy: {
      type: String,
      default: 'SYSTEM_ADMIN'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Geofence', geofenceSchema);
