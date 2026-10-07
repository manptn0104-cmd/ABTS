const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name:               { type: String, required: [true, 'Organization name is required'], trim: true },
    email:              { type: String, required: [true, 'Email is required'], unique: true, lowercase: true },
    phone:              { type: String, required: [true, 'Phone is required'] },
    city:               { type: String, required: [true, 'City is required'], trim: true },
    state:              { type: String, required: [true, 'State is required'], trim: true },
    address:            { type: String, default: null },
    gstNumber:          { type: String, default: null },
    registrationNumber: { type: String, default: null },
    logo:               { type: String, default: null },
    website:            { type: String, default: null },
    contactPerson:      { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'suspended', 'expired', 'pending'],
      default: 'pending',
    },
    subscriptionPlan:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
    subscriptionExpiry:   { type: Date, default: null },
    subscriptionStarted:  { type: Date, default: null },
    notes:                { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
