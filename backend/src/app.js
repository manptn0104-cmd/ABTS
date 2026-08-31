const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

const authRoutes      = require('./routes/auth');
const ambulanceRoutes = require('./routes/ambulances');
const bookingRoutes   = require('./routes/bookings');
const trackingRoutes  = require('./routes/tracking');
const adminRoutes     = require('./routes/admin');
const supportRoutes   = require('./routes/support');
const reviewRoutes    = require('./routes/reviewRoutes');
const organizationRoutes = require('./routes/organizations');
const superAdminRoutes = require('./routes/superAdmin');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:19006',
    ],
    credentials: true,
  })
);

app.options('*', cors());

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
app.use('/api/auth',       authRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/bookings',   bookingRoutes);
app.use('/api/tracking',   trackingRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/support',    supportRoutes);
app.use('/api/reviews',    reviewRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'ABTS API', timestamp: new Date() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
