const mongoose = require('mongoose');

const MAX_OTP_ATTEMPTS = 5;

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
  attempts: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Otp', otpSchema);
module.exports.MAX_OTP_ATTEMPTS = MAX_OTP_ATTEMPTS;
