const path = require('path');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');
const { logAudit } = require('../utils/audit');

// Document fields for driver verification
const DRIVER_DOC_FIELDS = [
  'aadhaarImage',
  'licenceImage',
  'driverPhoto',
];

// Document fields for ambulance verification
const AMBULANCE_DOC_FIELDS = [
  'insurance',
  'pollutionCertificate',
  'rcBook',
  'driverLicense',
  'aadhaar',
  'ambulanceImage',
];

const buildPublicUrl = (req, relativePath) =>
  `${req.protocol}://${req.get('host')}/uploads/${relativePath.replace(/\\/g, '/')}`;

// POST /api/drivers/:driverId/documents - Upload driver verification documents
exports.uploadDriverDocuments = async (req, res, next) => {
  try {
    const driver = await User.findById(req.params.driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    // Authorization: driver themselves or admin
    const isOwner = driver._id.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to upload documents for this driver.' });
    }
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No documents uploaded.' });
    }
    // Initialize document storage
    
   DRIVER_DOC_FIELDS.forEach((field) => {
  const file = req.files[field]?.[0];

  if (file) {
    const rel = path.join(
      'driver-docs',
      driver._id.toString(),
      file.filename
    );

    driver[field] = {
      url: buildPublicUrl(req, rel),
      fileName: file.originalname,
      uploadedAt: new Date(),
    };
  }
});
    driver.approvalStatus = 'pending';
    driver.rejectionReason = null;
    await driver.save();
    res.json({ success: true, message: 'Documents uploaded. Pending verification.', driver });
  } catch (error) {
    next(error);
  }
};

// POST /api/ambulances/:ambulanceId/documents - Upload ambulance documents
exports.uploadDocuments = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }
    // Authorization: driver (owner) or admin
    const isOwner = ambulance.owner && ambulance.owner.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to upload documents for this ambulance.' });
    }
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No documents uploaded.' });
    }
    // Initialize document storage
    ambulance.documents = ambulance.documents || {};
    AMBULANCE_DOC_FIELDS.forEach((field) => {
      const file = req.files[field]?.[0];
      if (file) {
        const rel = path.join('ambulance-docs', ambulance._id.toString(), file.filename);
        ambulance.documents[field] = { url: buildPublicUrl(req, rel), uploadedAt: new Date() };
      }
    });
    ambulance.verificationStatus = 'pending';
    await ambulance.save();
    res.json({ success: true, message: 'Documents uploaded. Pending verification.', ambulance });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/drivers/:driverId/verification - Admin updates verification status
exports.updateDriverVerification = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    }
    const driver = await User.findById(req.params.driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    driver.approvalStatus = status;
driver.rejectionReason = note || null;

// Control dashboard access
driver.canAccessDashboard = status === 'approved';

driver.verifiedAt = new Date();
driver.verifiedBy = req.user._id;
    await driver.save();
    await logAudit({
      actorId: req.user._id,
      action: `driver_verification_${status}`,
      targetType: 'user',
      targetId: driver._id,
      metadata: { note },
      ip: req.ip,
    });
    res.json({ success: true, message: `Driver ${status}.`, driver });
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
      'vehicleNumber documents verificationStatus verificationNote driverName owner'
    );
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    // Authorization check: only owner or admin can retrieve docs
    const isOwner = ambulance.owner && ambulance.owner.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view documents for this ambulance.' });
    }

    res.json({ success: true, ambulance });
  } catch (error) {
    next(error);
  }
};

// GET /api/drivers/:driverId/documents - Get driver verification documents
exports.getDriverDocuments = async (req, res, next) => {
  try {
    const driver = await User.findById(req.params.driverId).select(
  `
  name
  email
  phone
  role
  approvalStatus
  rejectionReason
  aadhaarImage
  licenceImage
  driverPhoto
  `
);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    // Authorization: driver themselves or admin
    const isOwner = driver._id.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view documents for this driver.' });
    }

    res.json({ success: true, driver });
  } catch (error) {
    next(error);
  }
};
