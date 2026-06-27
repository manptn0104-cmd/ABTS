const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBooking,
  updateBookingStatus,
  cancelBooking,
  rateBooking,
  getAmbulanceBookings,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post(
  '/',
  protect,
  [
    body('ambulanceId').notEmpty().withMessage('Ambulance ID is required'),
    body('pickupLocation.coordinates').isArray().withMessage('Pickup coordinates must be an array'),
    body('pickupLocation.address').notEmpty().withMessage('Pickup address is required'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  createBooking
);
router.get('/', protect, getMyBookings);
router.get('/ambulance/:ambulanceId', protect, authorize('driver', 'admin'), getAmbulanceBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/status', protect, authorize('driver', 'admin'), updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/rate', protect, rateBooking);

module.exports = router;
