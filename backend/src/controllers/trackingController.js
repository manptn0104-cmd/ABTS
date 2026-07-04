const Location = require('../models/Location');
const Ambulance = require('../models/Ambulance');

// GET /api/tracking/:ambulanceId/location
exports.getLatestLocation = async (req, res, next) => {
  try {
    const loc = await Location.findOne({ ambulance: req.params.ambulanceId }).sort({ timestamp: -1 });

    if (!loc) {
      const ambulance = await Ambulance.findById(req.params.ambulanceId).select('currentLocation');
      if (!ambulance) {
        return res.status(404).json({ success: false, message: 'Ambulance not found.' });
      }
      return res.json({
        success: true,
        location: {
          latitude: ambulance.currentLocation.coordinates[1],
          longitude: ambulance.currentLocation.coordinates[0],
          address: ambulance.currentLocation.address,
          timestamp: new Date(),
        },
      });
    }

    res.json({
      success: true,
      location: {
        latitude: loc.coordinates.coordinates[1],
        longitude: loc.coordinates.coordinates[0],
        speed: loc.speed,
        heading: loc.heading,
        accuracy: loc.accuracy,
        timestamp: loc.timestamp,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tracking/:ambulanceId/history
exports.getLocationHistory = async (req, res, next) => {
  try {
    const { bookingId, from, to, limit = 100 } = req.query;
    const query = { ambulance: req.params.ambulanceId };
    if (bookingId) query.booking = bookingId;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const locations = await Location.find(query)
      .sort({ timestamp: 1 })
      .limit(parseInt(limit));

    res.json({ success: true, count: locations.length, locations });
  } catch (error) {
    next(error);
  }
};

// POST /api/tracking/:ambulanceId/location
exports.saveLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, speed, heading, accuracy, bookingId } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const [lat, lng] = [parseFloat(latitude), parseFloat(longitude)];

    const location = await Location.create({
      ambulance: req.params.ambulanceId,
      booking: bookingId || null,
      coordinates: { type: 'Point', coordinates: [lng, lat] },
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0,
    });

    await Ambulance.findByIdAndUpdate(req.params.ambulanceId, {
      currentLocation: { type: 'Point', coordinates: [lng, lat] },
    });

    res.status(201).json({ success: true, location });
  } catch (error) {
    next(error);
  }
};
