const Ambulance = require('../models/Ambulance');
const { validationResult } = require('express-validator');

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
      // Fetch near matches using aggregation (retrieve up to 100 to ensure sorting is comprehensive)
      let rawAmbulances = await Ambulance.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: 'distance',
            maxDistance: parseInt(maxDistance),
            query: filterQuery,
            spherical: true,
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

      const { calculateSmartETA, calculateRankScore, getTrafficLabel, getMotionLabel } = require('../utils/etaPredictor');

      // Map and predict smart ETA and rank score for each ambulance
      let rankedAmbulances = rawAmbulances.map((amb) => {
        const distanceMeters = amb.distance || 0;
        
        // Extract simulated or real parameters
        const currentSpeed = amb.currentSpeed !== undefined ? amb.currentSpeed : 40;
        const trafficLevel = amb.trafficLevel || 'clear';
        const roadType = amb.roadType || 'main_road';
        const signalsCount = amb.signalsCount !== undefined ? amb.signalsCount : 1;
        const motionStatus = amb.motionStatus || 'moving';

        const smartETA = calculateSmartETA({
          distanceMeters,
          currentSpeed,
          trafficLevel,
          roadType,
          signalsCount,
          motionStatus,
        });

        const rankScore = calculateRankScore({
          smartETA,
          ambulanceType: amb.type,
          emergencyType,
          ratingAverage: amb.rating?.average || 0,
          facilities: amb.facilities || {},
        });

        return {
          ...amb,
          distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
          estimatedArrivalMin: smartETA, // Dynamic real-time smart ETA
          smartRankScore: rankScore,
          trafficLevel: trafficLevel,
          trafficLabel: getTrafficLabel(trafficLevel),
          motionStatus: motionStatus,
          motionLabel: getMotionLabel(motionStatus),
          currentSpeed,
          roadType,
          signalsCount,
          isFastestArrival: false,
        };
      });

      // Sort by Smart Ranking Score ascending (lower score is better)
      rankedAmbulances.sort((a, b) => a.smartRankScore - b.smartRankScore);

      // Flag the #1 absolute fastest arrival ambulance
      if (rankedAmbulances.length > 0) {
        let fastestIdx = 0;
        for (let i = 1; i < rankedAmbulances.length; i++) {
          if (rankedAmbulances[i].estimatedArrivalMin < rankedAmbulances[fastestIdx].estimatedArrivalMin) {
            fastestIdx = i;
          }
        }
        rankedAmbulances[fastestIdx].isFastestArrival = true;
      }

      // Paginate the final sorted list
      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);
      const startIndex = (parsedPage - 1) * parsedLimit;
      ambulances = rankedAmbulances.slice(startIndex, startIndex + parsedLimit);
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
    const ambulance = await Ambulance.create({ ...req.body, owner: req.user.id });
    res.status(201).json({ success: true, message: 'Ambulance registered.', ambulance });
  } catch (error) {
    next(error);
  }
};

// PUT /api/ambulances/:id
exports.updateAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    const isOwner = ambulance.owner.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const updated = await Ambulance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Ambulance updated.', ambulance: updated });
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
    const ambulance = await Ambulance.findOne({ owner: req.user.id });
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
    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    const isOwner = ambulance.owner.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
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
