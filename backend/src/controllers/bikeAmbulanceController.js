const BikeAmbulance  = require('../models/BikeAmbulance');
const BikeBooking    = require('../models/BikeBooking');
const User           = require('../models/User');
const { evaluateRecommendation, getEmergencyConfig } = require('../services/recommendationService');
const { getIO }      = require('../services/socketService');

// ── GET /api/bike-ambulances/nearby ─────────────────────────────────────────
exports.getNearby = async (req, res, next) => {
  try {
    const { lat, lng, maxDistance = 5000, limit = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required.' });
    }

    const bikes = await BikeAmbulance.aggregate([
      {
        $geoNear: {
          near:          { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distanceM',
          maxDistance:   parseInt(maxDistance),
          query:         { isAvailable: true, isActive: true },
          spherical:     true,
        },
      },
      { $limit: parseInt(limit) },
      {
        $addFields: {
          distanceKm:          { $round: [{ $divide: ['$distanceM', 1000] }, 2] },
          estimatedArrivalMin: { $round: [{ $multiply: [{ $divide: ['$distanceM', 1000] }, 2.5] }, 0] },
        },
      },
    ]);

    res.json({ success: true, count: bikes.length, bikes });
  } catch (error) { next(error); }
};

// ── GET /api/bike-ambulances/recommendation ──────────────────────────────────
// Called after fetching regular ambulances — returns bike recommendation if applicable
exports.getRecommendation = async (req, res, next) => {
  try {
    const { lat, lng, regularETA, roadDifficult } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required.' });
    }

    // Build a minimal regularAmbulances array from the query param
    const regularAmbulances = regularETA
      ? [{ estimatedArrivalMin: parseFloat(regularETA) }]
      : [];

    const recommendation = await evaluateRecommendation({
      pickupCoordinates: [parseFloat(lng), parseFloat(lat)],
      regularAmbulances,
      roadDifficult: roadDifficult === 'true',
    });

    if (!recommendation) {
      return res.json({ success: true, recommended: false });
    }

    res.json({ success: true, ...recommendation });
  } catch (error) { next(error); }
};

// ── POST /api/bike-ambulances/assign ────────────────────────────────────────
exports.assignBike = async (req, res, next) => {
  try {
    const {
      bikeAmbulanceId, pickupCoordinates, pickupAddress,
      regularAmbulanceETA, bikeAmbulanceETA, distanceKm,
      recommendationReasons = [], patientDetails = {},
      originalBookingId,
    } = req.body;

    if (!bikeAmbulanceId || !pickupCoordinates) {
      return res.status(400).json({ success: false, message: 'bikeAmbulanceId and pickupCoordinates are required.' });
    }

    const bike = await BikeAmbulance.findById(bikeAmbulanceId);
    if (!bike || !bike.isAvailable) {
      return res.status(409).json({ success: false, message: 'Bike ambulance is not available.' });
    }

    // Mark bike as requested
    bike.isAvailable = false;
    bike.status = 'requested';
    await bike.save();

    const bikeBooking = await BikeBooking.create({
      user:                req.user.id,
      bikeAmbulance:       bikeAmbulanceId,
      originalBooking:     originalBookingId || null,
      pickupLocation: {
        type:        'Point',
        coordinates: pickupCoordinates,
        address:     pickupAddress || '',
      },
      status:              'assigned',
      regularAmbulanceETA: regularAmbulanceETA || null,
      bikeAmbulanceETA:    bikeAmbulanceETA || null,
      distanceKm:          distanceKm || null,
      recommendationReasons,
      patientDetails,
      assignedAt:          new Date(),
      auditLog: [{
        action:      'ASSIGNED',
        note:        `Bike ambulance ${bike.vehicleNumber} assigned to user`,
        performedBy: req.user.id,
      }],
    });

    await bikeBooking.populate([
      { path: 'bikeAmbulance' },
      { path: 'user', select: 'name phone email' },
    ]);

    const io = getIO();

    // Notify bike driver
    const driverUser = await User.findById(bike.owner);
    if (driverUser) {
      io.to(`user_${driverUser._id}`).emit('bike_booking_request', {
        bikeBooking,
        message: 'New bike ambulance request received',
      });
    }

    // Confirm to patient
    io.to(`user_${req.user.id}`).emit('bike_booking_created', {
      bikeBookingId: bikeBooking._id,
      message:       'Bike ambulance assigned. Waiting for driver confirmation.',
    });

    res.status(201).json({ success: true, message: 'Bike ambulance assigned.', bikeBooking });
  } catch (error) { next(error); }
};

// ── PUT /api/bike-ambulances/:id/status ─────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const validTransitions = {
      assigned:             ['accepted', 'cancelled'],
      accepted:             ['en_route', 'cancelled'],
      en_route:             ['arrived', 'cancelled'],
      arrived:              ['assistance_started', 'cancelled'],
      assistance_started:   ['waiting_for_ambulance', 'completed'],
      waiting_for_ambulance:['patient_transferred', 'completed'],
      patient_transferred:  ['completed'],
    };

    const bikeBooking = await BikeBooking.findById(req.params.id).populate('bikeAmbulance');
    if (!bikeBooking) {
      return res.status(404).json({ success: false, message: 'Bike booking not found.' });
    }

    if (!validTransitions[bikeBooking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${bikeBooking.status}' to '${status}'.`,
      });
    }

    bikeBooking.status = status;
    bikeBooking.auditLog.push({ action: status.toUpperCase(), note: note || '', performedBy: req.user.id });

    const timestamps = {
      accepted:   'acceptedAt',
      arrived:    'arrivedAt',
      completed:  'completedAt',
      cancelled:  'cancelledAt',
    };
    if (timestamps[status]) bikeBooking[timestamps[status]] = new Date();

    if (status === 'completed' || status === 'cancelled') {
      await BikeAmbulance.findByIdAndUpdate(bikeBooking.bikeAmbulance._id, {
        isAvailable: true,
        status:      'available',
      });
    }
    if (status === 'accepted') {
      await BikeAmbulance.findByIdAndUpdate(bikeBooking.bikeAmbulance._id, { status: 'assigned' });
    }

    await bikeBooking.save();
    await bikeBooking.populate([
      { path: 'bikeAmbulance' },
      { path: 'user', select: 'name phone email' },
    ]);

    const io = getIO();
    io.to(`user_${bikeBooking.user._id}`).emit('bike_status_update', {
      bikeBookingId: bikeBooking._id,
      status,
      message:       `Bike ambulance ${status.replace(/_/g, ' ')}.`,
      bikeBooking,
    });

    res.json({ success: true, message: `Status updated to ${status}.`, bikeBooking });
  } catch (error) { next(error); }
};

// ── PUT /api/bike-ambulances/:id/location ────────────────────────────────────
exports.updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const bike = await BikeAmbulance.findById(req.params.id);
    if (!bike) return res.status(404).json({ success: false, message: 'Bike ambulance not found.' });

    bike.currentLocation = {
      type:        'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      address:     address || '',
    };
    bike.lastActiveAt = new Date();
    await bike.save();

    // Broadcast to active booking rooms
    const activeBooking = await BikeBooking.findOne({
      bikeAmbulance: bike._id,
      status: { $in: ['accepted', 'en_route', 'arrived', 'assistance_started'] },
    });

    if (activeBooking) {
      const io = getIO();
      io.to(`user_${activeBooking.user}`).emit('bike_location_update', {
        bikeAmbulanceId: bike._id,
        latitude:  parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
      });
    }

    res.json({ success: true, bike });
  } catch (error) { next(error); }
};

// ── GET /api/bike-ambulances/my-bookings ─────────────────────────────────────
exports.getMyBikeBookings = async (req, res, next) => {
  try {
    const bikeBookings = await BikeBooking.find({ user: req.user.id })
      .populate('bikeAmbulance', 'vehicleNumber driverName driverPhone facilities rating currentLocation')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, count: bikeBookings.length, bikeBookings });
  } catch (error) { next(error); }
};

// ── GET /api/bike-ambulances/mine ────────────────────────────────────────────
// Driver fetches their own bike ambulance
exports.getMyBike = async (req, res, next) => {
  try {
    const bike = await BikeAmbulance.findOne({ owner: req.user.id });
    if (!bike) return res.status(404).json({ success: false, message: 'No bike ambulance assigned.' });
    res.json({ success: true, bike });
  } catch (error) { next(error); }
};

// ── GET /api/bike-ambulances (admin/superadmin) ──────────────────────────────
exports.listAll = async (req, res, next) => {
  try {
    const bikes = await BikeAmbulance.find()
      .populate('owner', 'name phone email')
      .populate('organization', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bikes.length, bikes });
  } catch (error) { next(error); }
};

// ── POST /api/bike-ambulances (admin registers a new bike ambulance) ─────────
exports.register = async (req, res, next) => {
  try {
    const { vehicleNumber, driverName, driverPhone, driverLicense, ownerId, facilities } = req.body;
    if (!vehicleNumber || !driverName || !driverPhone || !ownerId) {
      return res.status(400).json({ success: false, message: 'vehicleNumber, driverName, driverPhone, and ownerId are required.' });
    }
    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== 'driver') {
      return res.status(400).json({ success: false, message: 'ownerId must reference a driver account.' });
    }
    const bike = await BikeAmbulance.create({
      vehicleNumber, driverName, driverPhone, driverLicense,
      owner: ownerId, facilities: facilities || {},
      currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'Bangalore' },
    });
    res.status(201).json({ success: true, message: 'Bike ambulance registered.', bike });
  } catch (error) { next(error); }
};

// ── DELETE /api/bike-ambulances/:id (admin) ──────────────────────────────────
exports.deregister = async (req, res, next) => {
  try {
    const bike = await BikeAmbulance.findByIdAndDelete(req.params.id);
    if (!bike) return res.status(404).json({ success: false, message: 'Bike ambulance not found.' });
    res.json({ success: true, message: `Bike ambulance ${bike.vehicleNumber} deregistered.` });
  } catch (error) { next(error); }
};

// ── GET /api/bike-ambulances/emergency-config (admin) ───────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    const config = await getEmergencyConfig();
    res.json({ success: true, config });
  } catch (error) { next(error); }
};

// ── PUT /api/bike-ambulances/emergency-config (admin) ────────────────────────
exports.updateConfig = async (req, res, next) => {
  try {
    const AppConfig = require('../models/AppConfig');
    const current   = await getEmergencyConfig();
    const updated   = { ...current, ...req.body };
    await AppConfig.findOneAndUpdate(
      { key: 'emergencyConfig' },
      { value: updated },
      { upsert: true }
    );
    res.json({ success: true, message: 'Emergency config updated.', config: updated });
  } catch (error) { next(error); }
};
