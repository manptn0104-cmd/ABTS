const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    driverName: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
    },
    driverPhone: {
      type: String,
      required: [true, 'Driver phone is required'],
    },
    driverLicense: {
      type: String,
      required: [true, 'Driver license number is required'],
    },
    driverImage: { type: String, default: null },
    vehicleImage: { type: String, default: null },
    type: {
      type: String,
      enum: ['basic', 'advanced', 'icu', 'neonatal'],
      default: 'basic',
    },
    facilities: {
      oxygen:       { type: Boolean, default: false },
      saline:       { type: Boolean, default: false },
      stretcher:    { type: Boolean, default: true },
      nurse:        { type: Boolean, default: false },
      doctor:       { type: Boolean, default: false },
      defibrillator:{ type: Boolean, default: false },
      ventilator:   { type: Boolean, default: false },
      cctvCamera:   { type: Boolean, default: true },
    },
    pricePerKm: {
      type: Number,
      required: [true, 'Price per km is required'],
      min: [0, 'Price cannot be negative'],
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price cannot be negative'],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      address: {
        type: String,
        default: '',
      },
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0 },
    },
    totalTrips: {
      type: Number,
      default: 0,
    },
    specializations: {
      type: [String],
      enum: ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'],
      default: ['general'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documents: {
      insurance: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
      pollutionCertificate: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
      rcBook: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
      driverLicense: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
      aadhaar: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
      ambulanceImage: {
        url: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
    },
    verificationStatus: {
      type: String,
      enum: ['unuploaded', 'pending', 'approved', 'rejected'],
      default: 'unuploaded',
    },
    verificationNote: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

ambulanceSchema.index({ currentLocation: '2dsphere' });
ambulanceSchema.index({ isAvailable: 1, type: 1 });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
