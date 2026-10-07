const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    submittedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submitterType:    { type: String, enum: ['user', 'driver', 'organization', 'hospital'], default: 'user' },
    subject:          { type: String, required: [true, 'Subject is required'] },
    description:      { type: String, required: [true, 'Description is required'] },
    category:         { type: String, enum: ['service', 'billing', 'driver', 'app', 'other'], default: 'other' },
    priority:         { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'reopened'],
      default: 'open',
    },
    assignedTo:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    organization:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    booking:          { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    resolution:       { type: String, default: null },
    escalationReason: { type: String, default: null },
    attachments:      [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
