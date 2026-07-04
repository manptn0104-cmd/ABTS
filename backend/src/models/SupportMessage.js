const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    sender: {
      type: String,
      enum: ['user', 'bot', 'admin'],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    isResolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'SupportMessage',
  supportMessageSchema
);