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
const { protect, authorize, requireActiveOrganization } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/', protect, requireActiveOrganization, getMyBookings);
router.get('/ambulance/:ambulanceId', protect, authorize('driver', 'admin', 'superadmin'), requireActiveOrganization, getAmbulanceBookings);
router.get('/debug/timeout-status', protect, authorize('admin', 'superadmin'), requireActiveOrganization, getTimeoutDebugStatus);
router.get('/:id', protect, getBooking);
router.get('/:id/reassignment-history', protect, authorize('admin', 'superadmin'), requireActiveOrganization, getReassignmentHistory);
router.put('/:id/status', protect, authorize('driver', 'admin', 'superadmin'), requireActiveOrganization, updateBookingStatus);
router.put('/:id/cancel', protect, requireActiveOrganization, cancelBooking);
router.post('/:id/rate', protect, requireActiveOrganization, rateBooking);
router.post('/:id/manual-reassign', protect, authorize('admin', 'superadmin'), requireActiveOrganization, manualReassign);

module.exports = router;
