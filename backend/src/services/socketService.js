const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Ambulance = require('../models/Ambulance');
const Location = require('../models/Location');
const Booking = require('../models/Booking');

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

  // ── Live Driver Movement Simulator ─────────────────────────────────────────
  const startSimulator = () => {
    console.log('📡 Starting Real-Time Smart Ambulance Location Simulator...');
    const { calculateSmartETA, calculateRankScore, getTrafficLabel, getMotionLabel } = require('../utils/etaPredictor');
    
    setInterval(async () => {
      try {
        const availableAmbulances = await Ambulance.find({ isAvailable: true });
        if (availableAmbulances.length === 0) return;

        const speeds = [20, 30, 45, 55, 65, 0];
        const motionStatuses = ['moving', 'moving', 'moving', 'waiting', 'stuck'];
        const trafficLevels = ['clear', 'clear', 'moderate', 'heavy'];
        const roadTypes = ['highway', 'main_road', 'local_street'];

        for (const amb of availableAmbulances) {
          if (!amb.currentLocation || !amb.currentLocation.coordinates) continue;
          let [lng, lat] = amb.currentLocation.coordinates;
          if (!lng || !lat || (lng === 0 && lat === 0)) {
            lng = 77.5946;
            lat = 12.9716;
          }

          // Move coordinates slightly (approx 30-100 meters per step)
          const dLng = (Math.random() - 0.5) * 0.0008;
          const dLat = (Math.random() - 0.5) * 0.0008;
          const newLng = lng + dLng;
          const newLat = lat + dLat;

          const currentSpeed = speeds[Math.floor(Math.random() * speeds.length)];
          const motionStatus = currentSpeed === 0 ? 'waiting' : (currentSpeed < 25 ? 'stuck' : 'moving');
          const trafficLevel = currentSpeed === 0 ? 'heavy' : (currentSpeed < 25 ? 'moderate' : 'clear');
          const roadType = roadTypes[Math.floor(Math.random() * roadTypes.length)];
          const signalsCount = Math.floor(Math.random() * 4);

          // Update MongoDB
          amb.currentLocation.coordinates = [newLng, newLat];
          amb.set('currentSpeed', currentSpeed, { strict: false });
          amb.set('motionStatus', motionStatus, { strict: false });
          amb.set('trafficLevel', trafficLevel, { strict: false });
          amb.set('roadType', roadType, { strict: false });
          amb.set('signalsCount', signalsCount, { strict: false });

          await amb.save();

          // Emit location payload to watchers
          const payload = {
            ambulanceId: amb._id,
            latitude: newLat,
            longitude: newLng,
            speed: currentSpeed,
            motionStatus,
            trafficLevel,
            roadType,
            signalsCount,
            timestamp: new Date(),
          };

          io.to(`watch_ambulance_${amb._id}`).emit('ambulance_location', payload);
        }

        // ── Simulate Active Booking Drivers ────────────────────────────────────
        const activeBookings = await Booking.find({ status: { $in: ['confirmed', 'in_progress'] } }).populate('ambulance');

        for (const booking of activeBookings) {
          const amb = booking.ambulance;
          if (!amb || !amb.currentLocation || !amb.currentLocation.coordinates) continue;
          if (!booking.pickupLocation || !booking.pickupLocation.coordinates) continue;

          let [ambLng, ambLat] = amb.currentLocation.coordinates;
          const [pickupLng, pickupLat] = booking.pickupLocation.coordinates;

          // Calculate current distance to check if reached pickup
          const dLatCheck = (pickupLat - ambLat) * Math.PI / 180;
          const dLonCheck = (pickupLng - ambLng) * Math.PI / 180;
          const aCheck = Math.sin(dLatCheck/2) * Math.sin(dLatCheck/2) +
                        Math.cos(ambLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                        Math.sin(dLonCheck/2) * Math.sin(dLonCheck/2);
          const cCheck = 2 * Math.atan2(Math.sqrt(aCheck), Math.sqrt(1-aCheck));
          const currentDistanceMeters = 6371000 * cCheck;

          // Stop movement simulation if ambulance is very close to pickup (< 50 meters)
          if (currentDistanceMeters < 50) {
            // Keep ambulance at pickup location
            amb.currentLocation.coordinates = [pickupLng, pickupLat];
            amb.set('motionStatus', 'at_location', { strict: false });
            await amb.save();

            const payload = {
              ambulanceId: amb._id,
              bookingId: booking._id,
              latitude: pickupLat,
              longitude: pickupLng,
              speed: 0,
              motionStatus: 'at_location',
              trafficLevel: 'clear',
              eta: 0,  // Already at location
              timestamp: new Date(),
            };

            io.to(`booking_${booking._id}`).emit('ambulance_location', payload);
            console.log(`[Simulator] Booking ${booking._id?.toString().slice(-6)}: Ambulance reached pickup location`);
            continue;  // Skip to next booking
          }

          // Move coordinates 8% closer per step (if not at destination)
          const step = 0.08;
          const newLng = ambLng + (pickupLng - ambLng) * step;
          const newLat = ambLat + (pickupLat - ambLat) * step;

          const currentSpeed = 35 + Math.floor(Math.random() * 20);
          const trafficLevel = Math.random() > 0.65 ? 'moderate' : 'clear';
          const motionStatus = 'moving';
          const signalsCount = 1;

          amb.currentLocation.coordinates = [newLng, newLat];
          amb.set('currentSpeed', currentSpeed, { strict: false });
          amb.set('motionStatus', motionStatus, { strict: false });
          amb.set('trafficLevel', trafficLevel, { strict: false });
          amb.set('signalsCount', signalsCount, { strict: false });
          await amb.save();

          // Calculate distance in meters (Haversine formula)
          const dLat = (pickupLat - newLat) * Math.PI / 180;
          const dLon = (pickupLng - newLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(newLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceMeters = 6371000 * c;

          const smartETA = calculateSmartETA({
            distanceMeters,
            currentSpeed,
            trafficLevel,
            roadType: 'main_road',
            signalsCount,
            motionStatus,
          });

          const payload = {
            ambulanceId: amb._id,
            bookingId: booking._id,
            latitude: newLat,
            longitude: newLng,
            speed: currentSpeed,
            motionStatus,
            trafficLevel,
            eta: smartETA,
            timestamp: new Date(),
          };

          io.to(`booking_${booking._id}`).emit('ambulance_location', payload);
          console.log(`[Simulator Active Booking] Booking ${booking._id?.toString().slice(-6)}: Dist: ${(distanceMeters/1000).toFixed(2)}km, Smart ETA = ${smartETA} mins`);
        }

        // Fetch fresh copy to broadcast with calculated smart ETA fields
        const listToBroadcast = await Ambulance.find({ isAvailable: true }).lean();

        // Add calculated fields to each ambulance for real-time dispatch ranking
        const enrichedList = listToBroadcast.map((amb) => {
          const distanceMeters = 0; // Socket broadcast doesn't know user location, so we can't calculate distance
          const currentSpeed = amb.currentSpeed !== undefined ? amb.currentSpeed : 40;
          const trafficLevel = amb.trafficLevel || 'clear';
          const roadType = amb.roadType || 'main_road';
          const signalsCount = amb.signalsCount !== undefined ? amb.signalsCount : 1;
          const motionStatus = amb.motionStatus || 'moving';

          // For socket broadcast, ETA is based on current motion state (not distance since location context is missing)
          const smartETA = motionStatus === 'at_location' ? 0 : (motionStatus === 'stuck' ? 8 : (motionStatus === 'waiting' ? 4 : 3));

          return {
            ...amb,
            distanceKm: 0,  // Distance cannot be calculated without user location context
            estimatedArrivalMin: smartETA,
            smartRankScore: smartETA,  // Use ETA as rank score for sorting
            trafficLevel,
            trafficLabel: getTrafficLabel(trafficLevel),
            motionStatus,
            motionLabel: getMotionLabel(motionStatus),
            currentSpeed,
            roadType,
            signalsCount,
            isFastestArrival: false,
          };
        });

        io.emit('nearby_ambulances_update', { ambulances: enrichedList });

        console.log(`[Simulator Update] Simulated movement for ${availableAmbulances.length} ambulances. Broadcasted updates to ${listToBroadcast.length} nearby ambulances.`);
      } catch (err) {
        console.error('❌ Live movement simulation error:', err.message);
      }
    }, 4000);
  };

  startSimulator();

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initializeSocket first.');
  return io;
};

module.exports = { initializeSocket, getIO };
