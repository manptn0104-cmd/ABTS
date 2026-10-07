const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type:         { type: String, enum: ['app', 'driver', 'organization', 'hospital'], required: true },
    rating:       { type: Number, min: 1, max: 5, required: true },
    comment:      { type: String, default: '' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    driverName:   { type: String, default: null },
    booking:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    status:       { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open' },
    tags:         [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
