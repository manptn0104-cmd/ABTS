const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getAmbulances,
  getMyAmbulance,
  getAmbulance,
  createAmbulance,
  updateAmbulance,
  updateLocation,
  toggleAvailability,
} = require('../controllers/ambulanceController');
const { protect, authorize } = require('../middleware/auth');

router.get('/mine', protect, authorize('driver', 'admin'), getMyAmbulance);
router.get('/', getAmbulances);
router.get('/:id', getAmbulance);

router.post(
  '/',
  protect,
  authorize('driver', 'admin'),
  [
    body('vehicleNumber').notEmpty().withMessage('Vehicle number is required'),
    body('driverName').notEmpty().withMessage('Driver name is required'),
    body('driverPhone').notEmpty().withMessage('Driver phone is required'),
    body('driverLicense').notEmpty().withMessage('Driver license is required'),
    body('pricePerKm').isNumeric().withMessage('pricePerKm must be a number'),
    body('basePrice').isNumeric().withMessage('basePrice must be a number'),
  ],
  createAmbulance
);

router.put('/:id', protect, authorize('driver', 'admin'), updateAmbulance);
router.put('/:id/location', protect, updateLocation);
router.put('/:id/availability', protect, authorize('driver', 'admin'), toggleAvailability);

module.exports = router;
