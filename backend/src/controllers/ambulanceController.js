const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const getManagementFilter = (req) => {
  if (req.user.role === 'superadmin') return {};

  const filter = { organizationId: req.user.organizationId };
  if (req.user.role === 'driver') filter.owner = req.user.id;
  return filter;
};

const getAmbulanceUpdates = (body) => {
  const allowedFields = [
    'vehicleNumber',
    'driverName',
    'driverPhone',
    'driverLicense',
    'driverImage',
    'vehicleImage',
    'type',
    'facilities',
    'pricePerKm',
    'basePrice',
    'specializations',
  ];
  const updates = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) updates[field] = body[field];
  });
  return updates;
};

// GET /api/ambulances
exports.getAmbulances = async (req, res, next) => {
  try {
    const {
      lat, lng,
      maxDistance = 20000,
      type, available,
      minPrice, maxPrice,
      emergencyType,
      page = 1, limit = 20,
    } = req.query;

    const filterQuery = {};
    if (available !== 'all') filterQuery.isAvailable = available !== 'false';
    if (type) filterQuery.type = type;
    if (emergencyType) filterQuery.specializations = emergencyType;

    ['oxygen', 'saline', 'stretcher', 'nurse', 'doctor', 'defibrillator', 'ventilator'].forEach((f) => {
      if (req.query[f] === 'true') filterQuery[`facilities.${f}`] = true;
    });

    if (minPrice) filterQuery.basePrice = { ...(filterQuery.basePrice || {}), $gte: Number(minPrice) };
    if (maxPrice) filterQuery.basePrice = { ...(filterQuery.basePrice || {}), $lte: Number(maxPrice) };

    let ambulances;
    const skip = (Number(page) - 1) * Number(limit);

    if (lat && lng) {
      ambulances = await Ambulance.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: 'distance',
            maxDistance: parseInt(maxDistance),
            query: filterQuery,
            spherical: true,
          },
        },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $addFields: {
            distanceKm: { $round: [{ $divide: ['$distance', 1000] }, 2] },
            // ETA at avg speed of 40 km/h, in minutes
            estimatedArrivalMin: {
              $round: [{ $multiply: [{ $divide: ['$distance', 1000] }, 1.5] }, 0],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerDetails',
            pipeline: [{ $project: { name: 1, phone: 1 } }],
          },
        },
        { $unwind: { path: '$ownerDetails', preserveNullAndEmptyArrays: true } },
      ]);
    } else {
      ambulances = await Ambulance.find(filterQuery)
        .populate('owner', 'name phone')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ 'rating.average': -1 });
    }

    const total = await Ambulance.countDocuments(filterQuery);

    res.json({
      success: true,
      count: ambulances.length,
      total,
      pages: Math.ceil(total / limit),
      ambulances,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/ambulances/:id
exports.getAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id).populate('owner', 'name phone email');
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }
    res.json({ success: true, ambulance });
  } catch (error) {
    next(error);
  }
};

// POST /api/ambulances
exports.createAmbulance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.user.role === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'SuperAdmin ambulance registration requires an organization-specific workflow.',
      });
    }

    let ownerId = req.user.id;
    if (req.user.role === 'admin') {
      if (!req.body.ownerId) {
        return res.status(400).json({ success: false, message: 'ownerId is required for admin ambulance registration.' });
      }

      const owner = await User.findOne({
        _id: req.body.ownerId,
        role: 'driver',
        organizationId: req.user.organizationId,
      });
      if (!owner) {
        return res.status(400).json({ success: false, message: 'ownerId must reference a driver in your organization.' });
      }
      ownerId = owner._id;
    }

    const ambulance = await Ambulance.create({
      ...getAmbulanceUpdates(req.body),
      owner: ownerId,
      organizationId: req.user.organizationId,
    });
    res.status(201).json({ success: true, message: 'Ambulance registered.', ambulance });
  } catch (error) {
    next(error);
  }
};

// PUT /api/ambulances/:id
exports.updateAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findOne({ _id: req.params.id, ...getManagementFilter(req) });
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    Object.assign(ambulance, getAmbulanceUpdates(req.body));
    await ambulance.save();

    res.json({ success: true, message: 'Ambulance updated.', ambulance });
  } catch (error) {
    next(error);
  }
};

// PUT /api/ambulances/:id/location
exports.updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const ambulance = await Ambulance.findByIdAndUpdate(
      req.params.id,
      {
        currentLocation: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
          address: address || '',
        },
      },
      { new: true }
    );

    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    res.json({ success: true, ambulance });
  } catch (error) {
    next(error);
  }
};

// GET /api/ambulances/mine  (driver's own ambulance)
exports.getMyAmbulance = async (req, res, next) => {
  try {
    const filter = { owner: req.user.id };
    if (req.user.role !== 'superadmin') filter.organizationId = req.user.organizationId;
    const ambulance = await Ambulance.findOne(filter);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'No ambulance assigned to this driver.' });
    }
    res.json({ success: true, ambulance });
  } catch (error) {
    next(error);
  }
};

// PUT /api/ambulances/:id/availability
exports.toggleAvailability = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findOne({ _id: req.params.id, ...getManagementFilter(req) });
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    ambulance.isAvailable = !ambulance.isAvailable;
    await ambulance.save();

    res.json({
      success: true,
      message: `Ambulance is now ${ambulance.isAvailable ? 'available' : 'unavailable'}.`,
      ambulance,
    });
  } catch (error) {
    next(error);
  }
};
