const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadDriverDocuments, getDriverDocuments } = require('../controllers/documentController');
const { uploadDriverDocs } = require('../middleware/upload');
const User = require('../models/User');

// Get current driver profile
router.get('/me', protect, authorize('driver'), async (req, res, next) => {
  try {
    const driver = await User.findById(req.user.id).select(
      'name email phone role approvalStatus rejectionReason documents aadhaarNumber licenceNumber'
    );
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    res.json({ success: true, driver });
  } catch (error) {
    next(error);
  }
});

// Upload driver verification documents
router.post('/:driverId/documents', protect, authorize('driver', 'admin'), uploadDriverDocs, uploadDriverDocuments);

// Get driver documents (owner or admin)
router.get('/:driverId/documents', protect, authorize('driver', 'admin'), getDriverDocuments);

module.exports = router;
