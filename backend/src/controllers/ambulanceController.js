const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { calculateSmartETA, calculateRankScore } = require('../utils/etaPredictor');
// Routing service for road‑distance & traffic‑aware ETA
const { getRoadInfo, RoutingError } = require('../services/routingService');
// Configurable number of candidates to actually route (default 5)
const MAX_ROUTED_CANDIDATES = Number(process.env.MAX_ROUTED_CANDIDATES || 5);

const FACILITY_FIELDS = ['oxygen', 'saline', 'stretcher', 'nurse', 'doctor', 'defibrillator', 'ventilator', 'cctvCamera'];

const getRequestedFacilities = (query) => {
  const selectedFacilities = Array.isArray(query.facilities)
    ? query.facilities
    : [query.facilities];
  const requestedFacilities = selectedFacilities
    .filter(Boolean)
    .flatMap((facilities) => String(facilities).split(','))
    .map((facility) => facility.trim())
    .filter((facility) => FACILITY_FIELDS.includes(facility));

  FACILITY_FIELDS.forEach((facility) => {
    if (query[facility] === 'true') requestedFacilities.push(facility);
  });

  return [...new Set(requestedFacilities)];
};

const calculateDistanceKm = (firstCoordinates, secondCoordinates) => {
  const [firstLongitude, firstLatitude] = firstCoordinates;
  const [secondLongitude, secondLatitude] = secondCoordinates;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(secondLatitude - firstLatitude);
  const longitudeDifference = toRadians(secondLongitude - firstLongitude);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(toRadians(firstLatitude)) * Math.cos(toRadians(secondLatitude)) * Math.sin(longitudeDifference / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

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
    console.log('[TRACE API REQUEST]', { path: req.originalUrl || req.url, method: req.method });
    const {
      lat, lng,
      maxDistance = 20000,
      type, available,
      minPrice, maxPrice,
      emergencyType,
      page = 1, limit = 20,
    } = req.query;
    console.log('[TRACE API INPUT]', { lat, lng, maxDistance, type, available, minPrice, maxPrice, emergencyType, page, limit });

    const filterQuery = {};
    if (available !== 'all') filterQuery.isAvailable = available !== 'false';
    if (type) filterQuery.type = type;
    if (emergencyType) filterQuery.specializations = emergencyType;

    const requestedFacilities = getRequestedFacilities(req.query);
    requestedFacilities.forEach((facility) => {
      filterQuery[`facilities.${facility}`] = true;
    });

    if (minPrice) filterQuery.basePrice = { ...(filterQuery.basePrice || {}), $gte: Number(minPrice) };
    if (maxPrice) filterQuery.basePrice = { ...(filterQuery.basePrice || {}), $lte: Number(maxPrice) };

    let ambulances;
    const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const requestedLimit = Math.max(1, Number.parseInt(limit, 10) || 20);
    const skip = (requestedPage - 1) * requestedLimit;

    if (lat && lng) {
      const pickupLat = parseFloat(lat);
      const pickupLng = parseFloat(lng);
      // Rank a broad proximity pool before applying client pagination or final limit.
      const candidatePoolSize = Math.max(50, skip + requestedLimit);
      ambulances = await Ambulance.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [pickupLng, pickupLat] },
            key: 'currentLocation',
            distanceField: 'distance',
            maxDistance: parseInt(maxDistance),
            query: filterQuery,
            spherical: true,
          },
        },
        { $limit: candidatePoolSize },
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

      console.log('[TRACE AMBULANCE COUNT]', ambulances.length);

      const destination = {
        latitude: Number(pickupLat),
        longitude: Number(pickupLng),
      };

      // Enrich ambulances with road-distance & traffic-aware ETA using baseLocation as authoritative routing origin
      const enriched = await Promise.allSettled(
        ambulances.map(async (ambulance) => {
          const coordinates = ambulance.baseLocation?.coordinates;
          const hasValidBase =
            Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            typeof coordinates[0] === 'number' &&
            typeof coordinates[1] === 'number' &&
            !Number.isNaN(coordinates[0]) &&
            !Number.isNaN(coordinates[1]) &&
            (coordinates[0] !== 0 || coordinates[1] !== 0);

          let origin = null;
          if (hasValidBase) {
            origin = {
              latitude: Number(coordinates[1]),
              longitude: Number(coordinates[0]),
            };
            console.log('[TRACE BASE LOCATION]', {
              vehicleNumber: ambulance.vehicleNumber,
              coordinates,
              latitude: origin.latitude,
              longitude: origin.longitude,
            });
          } else {
            console.warn('[TRACE BASE LOCATION]', {
              vehicleNumber: ambulance.vehicleNumber,
              coordinates,
              warning: 'Missing or invalid baseLocation coordinates',
            });
          }

          let roadDistanceKm = null;
          let etaMinutes = null;
          let etaFallback = false;
          let estimatedArrivalMin = null;

          const straightDistanceKm = typeof ambulance.distance === 'number'
            ? Number((ambulance.distance / 1000).toFixed(2))
            : null;
          let distanceKmField = straightDistanceKm;

          if (origin) {
            console.log('[TRACE ROUTE INPUT]', {
              vehicleNumber: ambulance.vehicleNumber,
              origin,
              destination,
            });

            try {
              const route = await getRoadInfo(origin, destination);
              roadDistanceKm = route.roadDistanceKm;
              etaMinutes = route.durationMinutes;
              estimatedArrivalMin = route.durationMinutes;
              distanceKmField = route.roadDistanceKm;
              etaFallback = false;

              console.log('[TRACE ROUTE RESULT]', {
                vehicleNumber: ambulance.vehicleNumber,
                roadDistanceKm: route.roadDistanceKm,
                etaMinutes: route.durationMinutes,
              });
            } catch (error) {
              console.warn(`[ROUTING FALLBACK] Google routing failed for ${ambulance.vehicleNumber}:`, error.message);
              roadDistanceKm = null;
              etaMinutes = null;
              estimatedArrivalMin = null;
              etaFallback = true;
              distanceKmField = straightDistanceKm;
            }
          } else {
            etaFallback = true;
          }

          // Fallback ETA using existing smart calculation (only if we have no ETA)
          if (estimatedArrivalMin === null) {
            estimatedArrivalMin = calculateSmartETA({
              distanceMeters: ambulance.distance || 0,
              currentSpeed: ambulance.currentSpeed,
              trafficLevel: ambulance.trafficLevel,
              roadType: ambulance.roadType,
              signalsCount: ambulance.signalsCount,
              motionStatus: ambulance.motionStatus,
            });
            etaFallback = true;
          }

          const smartRankScore = calculateRankScore({
            smartETA: estimatedArrivalMin,
            ambulanceType: ambulance.type,
            emergencyType,
            ratingAverage: ambulance.rating?.average,
            facilities: ambulance.facilities,
          });

          return {
            ...ambulance,
            distanceKm: distanceKmField,
            roadDistanceKm,
            etaMinutes,
            estimatedArrivalMin,
            etaFallback,
            smartRankScore,
          };
        })
      ).then((results) =>
        results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)
      );

      // Sort, mark fastest, and paginate
      const sorted = enriched
        .sort((a, b) => a.smartRankScore - b.smartRankScore)
        .map((amb, i) => ({ ...amb, isFastestArrival: i === 0 }));

      ambulances = sorted.slice(skip, skip + requestedLimit);
    } else {
      ambulances = await Ambulance.find(filterQuery)
        .populate('owner', 'name phone')
        .skip(skip)
        .limit(requestedLimit)
        .sort({ 'rating.average': -1 })
        .lean();
    }

    const total = await Ambulance.countDocuments(filterQuery);

    res.json({
      success: true,
      count: ambulances.length,
      total,
      pages: Math.ceil(total / requestedLimit),
      ambulances,
    });
  } catch (error) {
    console.error('[TRACE API ERROR]', error);
    next(error);
  }
};

// GET /api/ambulances/:id
exports.getAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id).populate('owner', 'name phone email').lean();
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }

    const pickupLatitude = Number(req.query.lat);
    const pickupLongitude = Number(req.query.lng);

    const ambulanceCoordinates = ambulance.baseLocation?.coordinates;
    const hasValidPickup = Number.isFinite(pickupLatitude) && Number.isFinite(pickupLongitude);
    const hasValidAmbulanceLocation = Array.isArray(ambulanceCoordinates)
      && ambulanceCoordinates.length === 2
      && ambulanceCoordinates.every(Number.isFinite)
      && (ambulanceCoordinates[0] !== 0 || ambulanceCoordinates[1] !== 0);

    // Initialise fields for backward compatibility
    ambulance.distanceKm = null;
    ambulance.estimatedArrivalMin = null;
    ambulance.roadDistanceKm = null;
    ambulance.etaMinutes = null;
    ambulance.etaFallback = false;

    if (hasValidPickup && hasValidAmbulanceLocation) {
      // Convert GeoJSON to latitude/longitude for routing
      const origin = { latitude: Number(ambulanceCoordinates[1]), longitude: Number(ambulanceCoordinates[0]) };
      const destination = { latitude: pickupLatitude, longitude: pickupLongitude };

      console.log('[TRACE BASE LOCATION]', {
        vehicleNumber: ambulance.vehicleNumber,
        coordinates: ambulanceCoordinates,
        latitude: origin.latitude,
        longitude: origin.longitude,
      });

      console.log('[TRACE ROUTE INPUT]', {
        vehicleNumber: ambulance.vehicleNumber,
        origin,
        destination,
      });

      try {
        const route = await getRoadInfo(origin, destination);
        ambulance.roadDistanceKm = route.roadDistanceKm;
        ambulance.etaMinutes = route.durationMinutes;
        ambulance.estimatedArrivalMin = route.durationMinutes;
        ambulance.distanceKm = route.roadDistanceKm;
        ambulance.etaFallback = false;

        console.log('[TRACE ROUTE RESULT]', {
          vehicleNumber: ambulance.vehicleNumber,
          roadDistanceKm: route.roadDistanceKm,
          etaMinutes: route.durationMinutes,
        });
      } catch (err) {
        // Routing failure – fall back to geo‑based ETA
        ambulance.etaFallback = true;
        const distanceKm = calculateDistanceKm(
          [pickupLongitude, pickupLatitude],
          ambulanceCoordinates
        );
        ambulance.distanceKm = Number(distanceKm.toFixed(2));
        ambulance.estimatedArrivalMin = calculateSmartETA({
          distanceMeters: distanceKm * 1000,
          currentSpeed: ambulance.currentSpeed,
          trafficLevel: ambulance.trafficLevel,
          roadType: ambulance.roadType,
          signalsCount: ambulance.signalsCount,
          motionStatus: ambulance.motionStatus,
        });
      }
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

    const existingAmb = await Ambulance.findById(req.params.id).select('vehicleNumber currentLocation');
    console.log('[TRACE LOCATION UPDATE]', {
      vehicleNumber: existingAmb ? existingAmb.vehicleNumber : req.params.id,
      oldCoordinates: existingAmb?.currentLocation?.coordinates,
      newCoordinates: [parseFloat(longitude), parseFloat(latitude)],
      source: 'ambulanceController.updateLocation',
    });

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
