const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    speed:    { type: Number, default: 0 }, // km/h
    heading:  { type: Number, default: 0 }, // degrees 0-360
    accuracy: { type: Number, default: 0 }, // meters
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ ambulance: 1, timestamp: -1 });
// Auto-delete location logs older than 24 hours
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Location', locationSchema);
