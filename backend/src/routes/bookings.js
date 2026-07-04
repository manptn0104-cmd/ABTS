const express = require('express');
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

router.post('/', protect, createBooking);
router.get('/', protect, getMyBookings);
router.get('/ambulance/:ambulanceId', protect, authorize('driver', 'admin'), getAmbulanceBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/status', protect, authorize('driver', 'admin'), updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/rate', protect, rateBooking);

module.exports = router;
