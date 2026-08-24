const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  generateBill,
  getBill,
  getBillsByUser,
  getBillByBooking,
  getBillsByDriver,
  downloadReceipt,
  getRevenueStats,
} = require('../controllers/billController');

// Generate bill for a completed booking (protected, admin or driver)
router.post('/generate/:bookingId', protect, authorize('admin', 'driver'), generateBill);

router.get('/booking/:bookingId', protect, getBillByBooking);

// Get bill by ID (protected, patient, driver, or admin)
router.get('/:id', protect, getBill);

// Download receipt as PDF (protected, patient, driver, or admin)
router.get('/:id/pdf', protect, downloadReceipt);

// Get all bills for logged-in user (patient)
router.get('/user/my-bills', protect, getBillsByUser);

// Get all bills for logged-in driver
router.get('/driver/my-bills', protect, authorize('driver'), getBillsByDriver);

// Get revenue statistics (admin only)
router.get('/stats/revenue', protect, authorize('admin'), getRevenueStats);

module.exports = router;
