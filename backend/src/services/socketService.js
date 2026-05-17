const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Ambulance = require('../models/Ambulance');
const Location = require('../models/Location');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || '*').split(',').map(u => u.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authenticate every socket connection
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: no token'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected [${socket.id}] user=${socket.userId}`);

    // Each user joins their personal room for targeted notifications
    socket.join(`user_${socket.userId}`);

    // ── Driver: join ambulance room ──────────────────────────────────────────
    socket.on('join_ambulance_room', (ambulanceId) => {
      socket.join(`ambulance_${ambulanceId}`);
      socket.ambulanceId = ambulanceId;
      console.log(`🚑 Driver joined ambulance room: ${ambulanceId}`);
    });

    // ── User: join booking room to receive live tracking ─────────────────────
    socket.on('join_booking_room', (bookingId) => {
      socket.join(`booking_${bookingId}`);
      console.log(`👤 User joined booking room: ${bookingId}`);
    });

    socket.on('leave_booking_room', (bookingId) => {
      socket.leave(`booking_${bookingId}`);
    });

    // ── Driver: broadcast real-time location ─────────────────────────────────
    socket.on('driver_location_update', async (data) => {
      const { ambulanceId, bookingId, latitude, longitude, speed = 0, heading = 0, accuracy = 0 } = data;

      if (!ambulanceId || !latitude || !longitude) return;

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      try {
        // Persist to DB
        await Location.create({
          ambulance: ambulanceId,
          booking: bookingId || null,
          coordinates: { type: 'Point', coordinates: [lng, lat] },
          speed,
          heading,
          accuracy,
          timestamp: new Date(),
        });

        // Update ambulance current position
        await Ambulance.findByIdAndUpdate(ambulanceId, {
          currentLocation: { type: 'Point', coordinates: [lng, lat] },
        });

        const payload = { ambulanceId, latitude: lat, longitude: lng, speed, heading, timestamp: new Date() };

        // Push to tracking booking room
        if (bookingId) {
          socket.to(`booking_${bookingId}`).emit('ambulance_location', payload);
        }

        // Push to general ambulance watchers
        socket.to(`watch_ambulance_${ambulanceId}`).emit('ambulance_location', payload);
      } catch (err) {
        console.error('Socket location save error:', err.message);
      }
    });

    // ── User: start watching an ambulance on the map ──────────────────────────
    socket.on('watch_ambulance', (ambulanceId) => {
      socket.join(`watch_ambulance_${ambulanceId}`);
    });

    socket.on('unwatch_ambulance', (ambulanceId) => {
      socket.leave(`watch_ambulance_${ambulanceId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected [${socket.id}] reason=${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initializeSocket first.');
  return io;
};

module.exports = { initializeSocket, getIO };
