const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStats,
  getAllBookings,
  getAllUsers,
  getAllAmbulances,
  updateBookingStatus,
  reassignBooking,
  registerAmbulance,
  deregisterAmbulance,
  toggleAmbulanceAvailability,
} = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats',                          getStats);
router.get('/bookings',                       getAllBookings);
router.get('/users',                          getAllUsers);
router.get('/ambulances',                     getAllAmbulances);
router.patch('/bookings/:id/status',          updateBookingStatus);
router.patch('/bookings/:id/reassign',        reassignBooking);
router.post('/ambulances',                    registerAmbulance);
router.delete('/ambulances/:id',              deregisterAmbulance);
router.patch('/ambulances/:id/availability',  toggleAmbulanceAvailability);

module.exports = router;
