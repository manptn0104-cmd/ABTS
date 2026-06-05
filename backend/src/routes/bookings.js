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
  getReassignmentHistory,
  manualReassign,
  getTimeoutDebugStatus,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/', protect, getMyBookings);
router.get('/ambulance/:ambulanceId', protect, authorize('driver', 'admin'), getAmbulanceBookings);
router.get('/debug/timeout-status', protect, authorize('admin'), getTimeoutDebugStatus);
router.get('/:id', protect, getBooking);
router.get('/:id/reassignment-history', protect, authorize('admin'), getReassignmentHistory);
router.put('/:id/status', protect, authorize('driver', 'admin'), updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/rate', protect, rateBooking);
router.post('/:id/manual-reassign', protect, authorize('admin'), manualReassign);

module.exports = router;
