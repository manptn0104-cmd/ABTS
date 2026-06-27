require('dotenv').config();

// ── Startup environment validation ────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const INSECURE_DEFAULTS = {
  JWT_SECRET: ['abts_super_secret_jwt_key_2024_dev_only', 'secret', 'changeme'],
};
REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️  WARNING: Environment variable '${key}' is not set. Using fallback.`);
  }
});
Object.entries(INSECURE_DEFAULTS).forEach(([key, defaults]) => {
  if (defaults.includes(process.env[key])) {
    console.warn(`🚨 SECURITY WARNING: '${key}' is using a known insecure default. Set a strong value in production!`);
  }
});
if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ FATAL: Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const app = require('./src/app');
const { initializeSocket } = require('./src/services/socketService');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`\n🚑 ABTS Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API Base: http://localhost:${PORT}/api\n`);

  // Self-ping every 14 minutes to prevent Render free-tier cold starts
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    setInterval(() => {
      fetch(`${RENDER_URL}/health`)
        .then(() => console.log('🏓 Self-ping OK'))
        .catch(() => console.log('🏓 Self-ping failed (non-critical)'));
    }, 14 * 60 * 1000); // every 14 minutes
    console.log('🏓 Self-ping enabled (every 14 min)');
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});
