/**
 * recommendationService.js
 *
 * Evaluates whether a Bike Ambulance should be recommended based on:
 *   A. No suitable regular ambulance
 *   B. Regular ambulance ETA exceeds configured threshold
 *   C. Bike ambulance is materially faster (minimum time saving met)
 *   D. (Road accessibility — flagged by caller; treated as forced recommendation)
 *   E. Bike ambulance is closer and faster
 *
 * All thresholds are read from MongoDB AppConfig (key = "emergencyConfig").
 */

const BikeAmbulance = require('../models/BikeAmbulance');
const AppConfig     = require('../models/AppConfig');

// ── Default emergency config (fallback if not in DB) ─────────────────────────
const DEFAULT_EMERGENCY_CONFIG = {
  bikeAmbulanceEnabled:   true,
  maxRegularAmbulanceETA: 10,   // minutes — above this, recommend bike
  minETAImprovement:      5,    // minutes — bike must save at least this much
  allowParallelDispatch:  true,
  allowAutoBikeDispatch:  false,
  bikeSearchRadius:       5000, // metres
};

const BIKE_SPEED_KMH = 24; // conservative urban bike speed (km/h)

async function getEmergencyConfig() {
  const doc = await AppConfig.findOne({ key: 'emergencyConfig' }).lean();
  return { ...DEFAULT_EMERGENCY_CONFIG, ...(doc?.value || {}) };
}

/**
 * @param {Object} options
 * @param {[number, number]} options.pickupCoordinates  [lng, lat]
 * @param {Array}            options.regularAmbulances  array with estimatedArrivalMin field
 * @param {boolean}          options.roadDifficult      caller-flagged road-accessibility concern
 * @returns {Object|null}  recommendation object or null if no bike recommendation
 */
async function evaluateRecommendation({ pickupCoordinates, regularAmbulances = [], roadDifficult = false }) {
  const config = await getEmergencyConfig();

  if (!config.bikeAmbulanceEnabled) return null;

  const [lng, lat] = pickupCoordinates;

  // Best ETA among available regular ambulances
  const regularETA = regularAmbulances.length > 0
    ? Math.min(...regularAmbulances.map((a) => a.estimatedArrivalMin ?? 9999))
    : 9999;

  // Find nearby bike ambulances within search radius
  const bikeAmbulances = await BikeAmbulance.aggregate([
    {
      $geoNear: {
        near:          { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceM',
        maxDistance:   config.bikeSearchRadius,
        query:         { isAvailable: true, isActive: true, status: 'available' },
        spherical:     true,
      },
    },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'ownerInfo',
        pipeline: [{ $project: { name: 1, phone: 1 } }],
      },
    },
    { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
  ]);

  if (bikeAmbulances.length === 0) return null;

  const bestBike = bikeAmbulances[0];
  const bikeDistanceKm = Math.round((bestBike.distanceM / 1000) * 100) / 100; // Round to 2 decimal places
  const bikeETA = Math.round((bikeDistanceKm / BIKE_SPEED_KMH) * 60);

  // ── Evaluate conditions ────────────────────────────────────────────────────
  const reasons = [];

  // Condition A: no regular ambulance
  if (regularAmbulances.length === 0) reasons.push('NO_REGULAR_AMBULANCE');

  // Condition B: ETA exceeds threshold
  if (regularETA > config.maxRegularAmbulanceETA) reasons.push('ETA_EXCEEDED');

  // Condition C/E: bike is materially faster
  if (regularETA !== 9999 && (regularETA - bikeETA) >= config.minETAImprovement) {
    reasons.push('FASTER_RESPONSE');
  }

  // Condition D: road accessibility (caller flagged)
  if (roadDifficult) reasons.push('ROAD_DIFFICULT');

  // Condition F: bike is available nearby (always show as an option)
  if (reasons.length === 0) reasons.push('BIKE_AVAILABLE');

  return {
    recommended:         true,
    bikeAmbulance:       bestBike,
    allBikeOptions:      bikeAmbulances,
    bikeETA,
    bikeDistanceKm,
    regularAmbulanceETA: regularETA === 9999 ? null : regularETA,
    timeSaving:          regularETA === 9999 ? null : Math.max(0, regularETA - bikeETA),
    reasons,
    config,
  };
}

module.exports = { evaluateRecommendation, getEmergencyConfig };
