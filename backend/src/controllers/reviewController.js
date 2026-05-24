const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private (user only)
exports.createReview = async (req, res, next) => {
  try {
    const { bookingId, rating, feedback, tags } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!bookingId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and rating are required'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only review your own bookings'
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'You can only review completed bookings'
      });
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this booking'
      });
    }

    // Get ambulance and driver info
    const ambulance = await Ambulance.findById(booking.ambulance);
    if (!ambulance) {
      return res.status(404).json({
        success: false,
        message: 'Ambulance not found'
      });
    }

    const driverId = ambulance.driver;

    // Create review
    const review = await Review.create({
      bookingId,
      ambulanceId: booking.ambulance,
      driverId,
      userId,
      rating,
      feedback,
      tags: tags || []
    });

    // Update driver's average rating and review count
    await updateDriverRating(driverId);

    // Update ambulance's average rating and review count
    await updateAmbulanceRating(booking.ambulance);

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a driver
// @route   GET /api/reviews/driver/:driverId
// @access  Public
exports.getDriverReviews = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const reviews = await Review.find({ driverId })
      .populate('userId', 'name')
      .populate('ambulanceId', 'vehicleNumber type')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Review.countDocuments({ driverId });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for an ambulance
// @route   GET /api/reviews/ambulance/:ambulanceId
// @access  Public
exports.getAmbulanceReviews = async (req, res, next) => {
  try {
    const { ambulanceId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const reviews = await Review.find({ ambulanceId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Review.countDocuments({ ambulanceId });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single review
// @route   GET /api/reviews/:id
// @access  Private
exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('userId', 'name')
      .populate('ambulanceId', 'vehicleNumber type')
      .populate('driverId', 'name')
      .populate('bookingId', 'status');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to update driver's average rating
async function updateDriverRating(driverId) {
  const reviews = await Review.find({ driverId });
  
  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await User.findByIdAndUpdate(driverId, {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    reviewCount: reviews.length
  });
}

// Helper function to update ambulance's average rating
async function updateAmbulanceRating(ambulanceId) {
  const reviews = await Review.find({ ambulanceId });
  
  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Ambulance.findByIdAndUpdate(ambulanceId, {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    reviewCount: reviews.length
  });
}
