const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      required: true,
    },
    // Denormalized snapshot of the assigned ambulance's organization; not yet populated at creation.
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'unavailable'],
      default: 'pending',
    },
    tripStage: {
      type: String,
      enum: [
        // Shared by every booking up through pickup.
        'assigned', 'en_route_to_pickup', 'arrived_at_pickup',
        // Regular-ambulance transport leg.
        'patient_onboard', 'en_route_to_hospital', 'arrived_at_hospital', 'patient_dropped_off',
        // Bike-ambulance on-scene response and legacy handoff stages.
        'patient_assessment', 'first_aid_provided',
        'regular_ambulance_requested', 'regular_ambulance_arrived', 'patient_handover',
        'bike_response_completed',
        // Shared final stages.
        'handover_completed', 'trip_completed',
      ],
    },
    // Which workflow this booking follows (see utils/tripStages.js). Derived
    // from the assigned ambulance's type at creation time.
    responseType: {
      type: String,
      enum: ['regular', 'bike'],
      default: 'regular',
    },
    // Historical fields retained for bookings created before the bike-only workflow.
    likelyRegularAmbulanceNeeded: {
      type: Boolean,
      default: false,
    },
    // Set explicitly at the bike-response decision point: null = not yet
    // decided, true = a regular ambulance was requested, false = the bike
    // crew completed the response on their own.
    regularAmbulanceRequired: {
      type: Boolean,
      default: null,
    },
    // The regular ambulance coordinated to take over transport after a bike
    // ambulance's on-scene response (only set when regularAmbulanceRequired).
    secondaryAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },
    // Snapshot of the original bike ambulance once the booking is handed off
    // to a regular ambulance for pickup/transport (see updateTripStage).
    firstResponderAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },
    tripTimeline: [
      {
        _id: false,
        stage: String,
        at: { type: Date, default: Date.now },
      },
    ],
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    dropLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: { type: [Number] },
      address: { type: String },
    },
    emergencyType: {
      type: String,
      enum: ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'],
      default: 'general',
    },
    requiredFacilities: {
      type: [String],
      enum: ['oxygen', 'saline', 'stretcher', 'nurse', 'doctor', 'ventilator', 'defibrillator','cctvCamera'],
      default: [],
    },
    patientDetails: {
      name:      { type: String },
      age:       { type: Number, min: 0, max: 150 },
      condition: { type: String },
      bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'],
        default: 'unknown',
      },
      emergencyContact: {
        name:  { type: String },
        phone: { type: String },
      },
    },
    estimatedDistance: { type: Number, default: 0 },
    estimatedTime:     { type: Number, default: 0 },
    actualDistance:    { type: Number, default: 0 },
    fare: {
      base:  { type: Number, default: 0 },
      perKm: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'online', 'insurance'],
      default: 'cash',
    },
    rejectionReason: { type: String, default: null },
    confirmedAt:     { type: Date },
    startedAt:       { type: Date },
    completedAt:     { type: Date },
    cancelledAt:     { type: Date },
    rating: {
      stars:    { type: Number, min: 1, max: 5 },
      feedback: { type: String },
      givenAt:  { type: Date },
    },
    patientConsent: {
      accepted: {
        type: Boolean,
        default: false,
      },
      acceptedAt: {
        type: Date,
      },
      guardianName: {
        type: String,
        default: '',
      },
      relation: {
        type: String,
        default: '',
      },
      emergencyRiskAccepted: {
        type: Boolean,
        default: false,
      },
    },
    assignedAt: {
      type: Date,
      default: () => new Date(),
    },
    reassignedAt: {
      type: Date,
      default: null,
    },
    reassignmentCount: {
      type: Number,
      default: 0,
    },
    previousAssignments: [{
      ambulanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ambulance',
      },
      driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      assignedAt: Date,
      timeoutAt: Date,
      reason: String,
      driverName: String,
      vehicleNumber: String,
    }],
  },
  { timestamps: true }
);

bookingSchema.index({ pickupLocation: '2dsphere' });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ ambulance: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1, assignedAt: 1 });
bookingSchema.index({ status: 1, reassignmentCount: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
