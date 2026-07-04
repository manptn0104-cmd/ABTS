const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL index — MongoDB auto-deletes expired docs
  },
  used: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Otp', otpSchema);
