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
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
    },
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
      enum: ['oxygen', 'saline', 'stretcher', 'nurse', 'doctor', 'ventilator', 'defibrillator'],
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
  },
  { timestamps: true }
);

bookingSchema.index({ pickupLocation: '2dsphere' });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ ambulance: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
