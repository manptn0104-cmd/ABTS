const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    name:          { type: String, required: [true, 'Plan name is required'], unique: true, trim: true },
    description:   { type: String, default: '' },
    price:         { type: Number, required: [true, 'Price is required'], min: 0 },
    duration:      { type: Number, required: [true, 'Duration (days) is required'] },
    maxAmbulances: { type: Number, default: -1 },   // -1 = unlimited
    maxDrivers:    { type: Number, default: -1 },
    features:      [{ type: String }],
    isActive:      { type: Boolean, default: true },
    gstPercent:    { type: Number, default: 18 },
    trialDays:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
