const express = require('express');
const router = express.Router();
const {
  getLatestLocation,
  getLocationHistory,
  saveLocation,
} = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');

router.get('/:ambulanceId/location', protect, getLatestLocation);
router.get('/:ambulanceId/history', protect, getLocationHistory);
router.post('/:ambulanceId/location', protect, saveLocation);

module.exports = router;
