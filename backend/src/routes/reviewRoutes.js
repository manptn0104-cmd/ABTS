const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  createReview,
  getDriverReviews,
  getAmbulanceReviews,
  getReview,
  getAllReviews,
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

// Validation middleware
const reviewValidation = [
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().trim().isLength({ max: 500 }).withMessage('Feedback must be less than 500 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
];

// Routes
router.post('/', protect, reviewValidation, createReview);
router.get('/driver/:driverId', getDriverReviews);
router.get('/ambulance/:ambulanceId', getAmbulanceReviews);
router.get('/admin/all', protect, authorize('admin'), getAllReviews);
router.get('/:id', protect, getReview);

module.exports = router;
