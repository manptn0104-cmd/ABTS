const mongoose = require('mongoose');

/**
 * Bill Model - Professional Invoice System for ABTS
 * Stores billing information for completed ambulance rides
 */
const billSchema = new mongoose.Schema(
  {
    // Unique receipt number for invoice tracking
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // References
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ambulanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      required: true,
    },

    // Patient Details (snapshot at time of billing)
    patientName: {
      type: String,
      required: true,
    },

    // Driver Details (snapshot at time of billing)
    driverName: {
      type: String,
      required: true,
    },

    // Ambulance Details (snapshot at time of billing)
    ambulanceNumber: {
      type: String,
      required: true,
    },

    // Ride Details
    pickupAddress: {
      type: String,
      required: true,
    },
    dropAddress: {
      type: String,
      required: true,
    },
    rideDistanceKm: {
      type: Number,
      required: true,
      min: 0,
    },

    // Pricing
    baseFare: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    pricePerKm: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    distanceCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Facility Charges
    oxygenCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    salineCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    stretcherCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    nurseCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    doctorCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    ventilatorCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    defibrillatorCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Other Charges
    waitingCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tollCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Totals
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    gst: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
      default: 18, // 18% GST by default
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Payment
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet'],
      required: true,
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      required: true,
      default: 'pending',
    },

    // Audit fields
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index for efficient queries
billSchema.index({ patientId: 1, createdAt: -1 });
billSchema.index({ driverId: 1, createdAt: -1 });
billSchema.index({ createdAt: -1 });

// Generate unique receipt number before saving
billSchema.pre('save', async function (next) {
  if (this.isNew && !this.receiptNumber) {
    // Format: ABTS-YYYYMMDD-XXXXX (5-digit random number)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    this.receiptNumber = `ABTS-${dateStr}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);
