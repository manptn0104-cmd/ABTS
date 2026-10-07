const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

const authRoutes            = require('./routes/auth');
const ambulanceRoutes       = require('./routes/ambulances');
const bookingRoutes         = require('./routes/bookings');
const trackingRoutes        = require('./routes/tracking');
const adminRoutes           = require('./routes/admin');
const supportRoutes         = require('./routes/support');
const superAdminRoutes      = require('./routes/superAdmin');
const configRoutes          = require('./routes/config');
const bikeAmbulanceRoutes   = require('./routes/bikeAmbulances');
const errorHandler     = require('./middleware/errorHandler');

const app = express();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

async function fetchGoogleMapsJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Maps request failed: ${response.status} ${text}`);
  }
  return response.json();
}

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const frontendUrl = process.env.FRONTEND_URL || '';
    // In development with no FRONTEND_URL set, allow all origins
    if (!frontendUrl || frontendUrl === '*' || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    const allowed = frontendUrl.split(',').map(u => u.trim());
    if (!origin || allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
  

// Rate limiting — global (generous for dev/demo)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});
app.use('/api/', limiter);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Routes
app.use('/api/auth',             authRoutes);
app.use('/api/ambulances',       ambulanceRoutes);
app.use('/api/bookings',         bookingRoutes);
app.use('/api/tracking',         trackingRoutes);
app.use('/api/admin',            adminRoutes);
app.use('/api/support',          supportRoutes);
app.use('/api/superadmin',       superAdminRoutes);
app.use('/api/config',           configRoutes);
app.use('/api/bike-ambulances',  bikeAmbulanceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'ABTS API', timestamp: new Date() });
});

app.get('/api/maps/autocomplete', async (req, res) => {
  try {
    const input = (req.query.input || '').trim();
    const lat = Number(req.query.lat || 12.9716);
    const lng = Number(req.query.lng || 77.5946);

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ status: 'ERROR', error: 'Google Maps API key not configured.' });
    }

    if (!input || input.length < 2) {
      return res.json({ status: 'ZERO_RESULTS', predictions: [] });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&location=${lat},${lng}&radius=50000&types=geocode|establishment&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchGoogleMapsJson(url);
    return res.json(data);
  } catch (error) {
    console.error('Maps autocomplete proxy error:', error.message);
    return res.status(502).json({ status: 'ERROR', error: 'Failed to fetch suggestions from Google Maps.' });
  }
});

app.get('/api/maps/details', async (req, res) => {
  try {
    const placeId = (req.query.place_id || '').trim();

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ status: 'ERROR', error: 'Google Maps API key not configured.' });
    }

    if (!placeId) {
      return res.status(400).json({ status: 'INVALID_REQUEST', error: 'place_id is required.' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,geometry,name&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchGoogleMapsJson(url);
    return res.json(data);
  } catch (error) {
    console.error('Maps details proxy error:', error.message);
    return res.status(502).json({ status: 'ERROR', error: 'Failed to fetch place details from Google Maps.' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
