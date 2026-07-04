const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendOtp,
  verifyOtp,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone')
      .matches(/^[0-9]{10,15}$/)
      .withMessage('Phone must be 10-15 digits'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

router.post('/send-otp',   sendOtp);
router.post('/verify-otp', verifyOtp);

module.exports = router;
