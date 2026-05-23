const path = require('path');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');

const DOC_FIELDS = [
  'insurance',
  'pollutionCertificate',
  'rcBook',
  'driverLicense',
  'aadhaar',
  'ambulanceImage',
];

const buildPublicUrl = (req, relativePath) =>
  `${req.protocol}://${req.get('host')}/uploads/${relativePath.replace(/\\/g, '/')}`;

// POST /api/admin/ambulances/:ambulanceId/documents
exports.uploadDocuments = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No documents uploaded.' });
    }

    DOC_FIELDS.forEach((field) => {
      const file = req.files[field]?.[0];
      if (file) {
        const rel = path.join('ambulance-docs', req.params.ambulanceId, file.filename);
        ambulance.documents[field] = {
          url: buildPublicUrl(req, rel),
          uploadedAt: new Date(),
        };
      }
    });

    ambulance.verificationStatus = 'pending';
    await ambulance.save();

    res.json({
      success: true,
      message: 'Documents uploaded. Pending verification.',
      ambulance,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/ambulances/:ambulanceId/verification
exports.updateVerification = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    }

    const ambulance = await Ambulance.findById(req.params.ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    ambulance.verificationStatus = status;
    ambulance.verificationNote = note || null;
    ambulance.verifiedAt = new Date();
    ambulance.verifiedBy = req.user._id;
    await ambulance.save();

    await logAudit({
      actorId: req.user._id,
      action: `ambulance_verification_${status}`,
      targetType: 'ambulance',
      targetId: ambulance._id,
      metadata: { note },
      ip: req.ip,
    });

    res.json({ success: true, message: `Ambulance ${status}.`, ambulance });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/drivers/:userId/suspend
exports.suspendDriver = async (req, res, next) => {
  try {
    const { reason, inactive = false } = req.body;
    const driver = await User.findById(req.params.userId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    driver.isSuspended = true;
    driver.suspendedAt = new Date();
    driver.suspendedReason = reason || 'Suspended by admin';
    driver.driverStatus = inactive ? 'inactive' : 'offline';
    await driver.save();

    await logAudit({
      actorId: req.user._id,
      action: 'driver_suspended',
      targetType: 'user',
      targetId: driver._id,
      metadata: { reason },
      ip: req.ip,
    });

    res.json({ success: true, message: 'Driver suspended.', user: driver });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/ambulances/:ambulanceId/documents
exports.getDocuments = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.ambulanceId).select(
      'vehicleNumber documents verificationStatus verificationNote driverName'
    );
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }
    res.json({ success: true, ambulance });
  } catch (error) {
    next(error);
  }
};
