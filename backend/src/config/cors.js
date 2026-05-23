/**
 * Shared CORS policy for Express and Socket.io.
 *
 * Development: allow any localhost / LAN Expo port (8081, 8085, 19006, etc.)
 * Production: only origins listed in FRONTEND_URL (comma-separated)
 */

const isProduction = process.env.NODE_ENV === 'production';

/** Expo Web, Metro, and local device testing origins */
const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

function getProductionOrigins() {
  return (process.env.FRONTEND_URL || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

function matchesDevOrigin(origin) {
  return DEV_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function isOriginAllowed(origin) {
  // Same-origin requests, Postman, curl, React Native native (no Origin header)
  if (!origin) return true;

  if (!isProduction) {
    return matchesDevOrigin(origin);
  }

  const allowed = getProductionOrigins();
  if (allowed.includes('*')) return true;
  return allowed.includes(origin);
}

function corsOriginCallback(origin, callback) {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
}

const corsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

function getSocketCorsOptions() {
  return {
    origin: corsOriginCallback,
    methods: ['GET', 'POST'],
    credentials: true,
  };
}

function logCorsMode() {
  if (isProduction) {
    console.log(`🔒 CORS: production — allowed origins: ${getProductionOrigins().join(', ') || '(none configured)'}`);
  } else {
    console.log('🔓 CORS: development — allowing localhost / LAN Expo origins on any port');
  }
}

module.exports = {
  corsOptions,
  getSocketCorsOptions,
  isOriginAllowed,
  logCorsMode,
};
