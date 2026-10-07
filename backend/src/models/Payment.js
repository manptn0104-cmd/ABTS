const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    organization:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    subscription:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
    booking:       { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    amount:        { type: Number, required: true },
    gstAmount:     { type: Number, default: 0 },
    totalAmount:   { type: Number, required: true },
    type:          { type: String, enum: ['subscription', 'booking', 'penalty', 'refund'], required: true },
    status:        { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, default: null },
    invoiceNumber: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    notes:         { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
