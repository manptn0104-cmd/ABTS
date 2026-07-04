require('dotenv').config();
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
