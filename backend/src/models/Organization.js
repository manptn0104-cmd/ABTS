const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      minlength: [2, 'Organization name must be at least 2 characters'],
      maxlength: [150, 'Organization name cannot exceed 150 characters'],
    },
    organizationCode: {
      type: String,
      required: [true, 'Organization code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      match: [/^[A-Z0-9-]{3,20}$/, 'Organization code must be 3-20 characters (letters, numbers, hyphens only)'],
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      unique: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      // GST is not mandatory for every organization on the platform; validate format only if provided.
      match: [/^[0-9A-Z]{15}$/, 'GST number must be 15 alphanumeric characters'],
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person is required'],
      trim: true,
      maxlength: [100, 'Contact person name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [/^[0-9]{10,15}$/, 'Invalid mobile number (10-15 digits)'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email address'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    // No Subscription model yet — store only the current plan value/reference for now.
    subscriptionPlan: {
      type: String,
      enum: ['trial', 'basic', 'standard', 'premium', 'enterprise'],
      default: 'trial',
    },
    subscriptionExpiryDate: {
      type: Date,
      default: null,
    },
    maximumAmbulanceLimit: {
      type: Number,
      required: [true, 'Maximum ambulance limit is required'],
      min: [1, 'Maximum ambulance limit must be at least 1'],
    },
    maximumDriverLimit: {
      type: Number,
      required: [true, 'Maximum driver limit is required'],
      min: [1, 'Maximum driver limit must be at least 1'],
    },
    maximumUserLimit: {
      type: Number,
      required: [true, 'Maximum user limit is required'],
      min: [1, 'Maximum user limit must be at least 1'],
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'expired'],
      default: 'pending',
    },
    // Soft delete — organizations are never physically removed.
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ status: 1, createdAt: -1 });
organizationSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Organization', organizationSchema);
