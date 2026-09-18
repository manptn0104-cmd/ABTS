/**
 * Routing Service - Google Routes API
 *
 * Calculates:
 * - Real road distance
 * - Traffic-aware ETA
 *
 * Origin      = ambulance current location
 * Destination = user's selected pickup location
 */

const fetch = global.fetch || require('node-fetch');

// ============================================================
// CONFIGURATION
// ============================================================

// We can use either variable.
// GOOGLE_ROUTES_API_KEY is preferred.
// GOOGLE_MAPS_API_KEY is supported as fallback.
const API_KEY =
  process.env.GOOGLE_ROUTES_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error(
    '🚨 routingService: Google Maps/Routes API key is missing'
  );
}

const CACHE_TTL_MS =
  Number(process.env.ROUTE_CACHE_TTL_SECONDS || 30) * 1000;


// ============================================================
// CACHE
// ============================================================

const routeCache = new Map();

function getCacheKey(origin, destination) {
  return [
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  ].join(',');
}

function getFromCache(key) {
  const entry = routeCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    routeCache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key, data) {
  routeCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
}


// ============================================================
// ERROR
// ============================================================

class RoutingError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'RoutingError';
    this.status = status;
  }
}


// ============================================================
// COORDINATE VALIDATION
// ============================================================

function validateLatLng(coord, name) {
  if (!coord) {
    throw new RoutingError(`${name} is missing`, 400);
  }

  const { latitude, longitude } = coord;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new RoutingError(
      `${name} coordinates are invalid`,
      400
    );
  }
}


// ============================================================
// GOOGLE DURATION PARSER
// ============================================================

function parseDuration(duration) {
  if (typeof duration !== 'string') {
    return null;
  }

  // Google normally returns values like:
  // "2640s"
  // "123.5s"

  const match = duration.match(/^([\d.]+)s$/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}


// ============================================================
// GET ROAD INFORMATION
// ============================================================

async function getRoadInfo(origin, destination) {

  // ----------------------------------------------------------
  // 1. Validate coordinates
  // ----------------------------------------------------------

  validateLatLng(origin, 'Origin');
  validateLatLng(destination, 'Destination');


  // ----------------------------------------------------------
  // 2. Check cache
  // ----------------------------------------------------------

  const cacheKey = getCacheKey(
    origin,
    destination
  );

  const cached = getFromCache(cacheKey);

  if (cached) {
    console.log(
      '🔁 Routing cache hit:',
      cached.roadDistanceKm,
      'km /',
      cached.durationMinutes,
      'min'
    );

    return cached;
  }


  // ----------------------------------------------------------
  // 3. Build Google Routes request
  // ----------------------------------------------------------

  const payload = {

    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      },
    },

    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },

    travelMode: 'DRIVE',

    routingPreference: 'TRAFFIC_AWARE',

    departureTime: new Date(Date.now() + 60 * 1000).toISOString(),
  };


  // ----------------------------------------------------------
  // 4. Google Routes API
  // ----------------------------------------------------------

  const url =
    'https://routes.googleapis.com/directions/v2:computeRoutes';

  const headers = {

    'Content-Type': 'application/json',

    'X-Goog-Api-Key': API_KEY,

    'X-Goog-FieldMask':
      'routes.distanceMeters,routes.duration,routes.staticDuration',
  };


  // ----------------------------------------------------------
  // 5. Call Google
  // ----------------------------------------------------------

  console.log('[TRACE ROUTE INPUT]', { origin, destination });
let response;

  try {

    response = await fetch(url, {

      method: 'POST',

      headers,

      body: JSON.stringify(payload),

    });

  } catch (error) {

    throw new RoutingError(
      `Network error contacting Google Routes API: ${error.message}`,
      null
    );
  }


  // ----------------------------------------------------------
  // 6. Handle Google errors
  // ----------------------------------------------------------

  if (!response.ok) {

    const status = response.status;

    let responseBody = '';

    try {
      responseBody = await response.text();
    } catch {
      responseBody = '';
    }

    console.error(
      '🚨 GOOGLE ROUTES ERROR',
      {
        status,
        body: responseBody,
        origin,
        destination,
      }
    );


    if (status === 401 || status === 403) {

      throw new RoutingError(
        `Google Routes API authentication/permission error: ${responseBody}`,
        status
      );
    }


    if (status === 429) {

      throw new RoutingError(
        `Google Routes API quota exceeded: ${responseBody}`,
        status
      );
    }


    throw new RoutingError(
      `Google Routes API error ${status}: ${responseBody}`,
      status
    );
  }


  // ----------------------------------------------------------
  // 7. Read response
  // ----------------------------------------------------------

  const data = await response.json();


  if (
    !data.routes ||
    !Array.isArray(data.routes) ||
    data.routes.length === 0
  ) {

    throw new RoutingError(
      'Google returned no route',
      404
    );
  }


  // ----------------------------------------------------------
  // 8. Extract route
  // ----------------------------------------------------------

  const route = data.routes[0];

  const roadDistanceMeters =
    route.distanceMeters;

  const durationSeconds =
    parseDuration(route.duration);


  // ----------------------------------------------------------
  // 9. Validate result
  // ----------------------------------------------------------

  if (
    typeof roadDistanceMeters !== 'number' ||
    typeof durationSeconds !== 'number'
  ) {

    console.error(
      '🚨 Invalid Google Routes response:',
      data
    );

    throw new RoutingError(
      'Invalid route data returned by Google',
      500
    );
  }


  // ----------------------------------------------------------
  // 10. Normalize result
  // ----------------------------------------------------------

  const result = {

    roadDistanceMeters,

    roadDistanceKm: Number(
      (roadDistanceMeters / 1000).toFixed(2)
    ),

    durationSeconds,

    durationMinutes: Math.max(
      1,
      Math.round(durationSeconds / 60)
    ),

  };


  // ----------------------------------------------------------
  // 11. Log result
  // ----------------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {

    console.log(
      '[TRACE ROUTE RESULT]',
      {
        origin,
        destination,
        roadDistanceKm: result.roadDistanceKm,
        durationMinutes: result.durationMinutes,
      }
    );

  }


  // ----------------------------------------------------------
  // 12. Cache
  // ----------------------------------------------------------

  setCache(
    cacheKey,
    result
  );


  // ----------------------------------------------------------
  // 13. Return
  // ----------------------------------------------------------

  return result;
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getRoadInfo,
  RoutingError,
};