const mongoose = require('mongoose');

const bikeAmbulanceSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    driverName:    { type: String, required: true, trim: true },
    driverPhone:   { type: String, required: true },
    driverLicense: { type: String, default: null },

    owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },

    status: {
      type: String,
      enum: [
        'available', 'requested', 'assigned', 'accepted',
        'en_route', 'arrived', 'assistance_started',
        'waiting_for_ambulance', 'patient_transferred',
        'completed', 'offline',
      ],
      default: 'available',
    },

    isAvailable: { type: Boolean, default: true },
    isActive:    { type: Boolean, default: true },

    currentLocation: {
      type:        { type: String, default: 'Point' },
      coordinates: { type: [Number], default: [77.5946, 12.9716] },
      address:     { type: String, default: '' },
    },

    facilities: {
      firstAid:        { type: Boolean, default: false },
      emergencyKit:    { type: Boolean, default: false },
      oxygen:          { type: Boolean, default: false },
      basicLifeSupport:{ type: Boolean, default: false },
      aed:             { type: Boolean, default: false },
    },

    rating: {
      average: { type: Number, default: 0 },
      count:   { type: Number, default: 0 },
    },

    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bikeAmbulanceSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('BikeAmbulance', bikeAmbulanceSchema);
