const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action:      { type: String, required: true },
    note:        { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp:   { type: Date, default: Date.now },
  },
  { _id: false }
);

const bikeBookingSchema = new mongoose.Schema(
  {
    user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bikeAmbulance: { type: mongoose.Schema.Types.ObjectId, ref: 'BikeAmbulance', default: null },

    // Link to original ambulance booking if this is a parallel dispatch
    originalBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },

    pickupLocation: {
      type:        { type: String, default: 'Point' },
      coordinates: { type: [Number], required: true },
      address:     { type: String, default: '' },
    },

    status: {
      type: String,
      enum: [
        'pending', 'assigned', 'accepted', 'en_route',
        'arrived', 'assistance_started',
        'waiting_for_ambulance', 'patient_transferred',
        'completed', 'cancelled',
      ],
      default: 'pending',
    },

    // ETAs captured at recommendation time (in minutes)
    regularAmbulanceETA: { type: Number, default: null },
    bikeAmbulanceETA:    { type: Number, default: null },
    distanceKm:          { type: Number, default: null },

    // Why the bike was recommended
    recommendationReasons: [{ type: String }],

    // Patient info (copied from booking form)
    patientDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

    auditLog: [auditLogSchema],

    assignedAt:     { type: Date, default: null },
    acceptedAt:     { type: Date, default: null },
    arrivedAt:      { type: Date, default: null },
    completedAt:    { type: Date, default: null },
    cancelledAt:    { type: Date, default: null },
    cancelReason:   { type: String, default: null },
  },
  { timestamps: true }
);

bikeBookingSchema.index({ pickupLocation: '2dsphere' });

module.exports = mongoose.model('BikeBooking', bikeBookingSchema);
