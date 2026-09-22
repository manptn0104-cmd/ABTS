const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Ambulance = require('../models/Ambulance');
const Location = require('../models/Location');
const Booking = require('../models/Booking');
// Routing service & ETA utilities
const { getRoadInfo, RoutingError } = require('../services/routingService');
const { calculateSmartETA } = require('../utils/etaPredictor');

let io;

// In‑memory throttle map for routing requests per ambulance
const routeThrottleMap = new Map(); // ambulanceId -> { lastRouteTimestamp, lastRoutedLocation, routingInProgress }
const MIN_ROUTE_INTERVAL_MS = 30 * 1000; // 30 seconds
const MOVEMENT_THRESHOLD_M = 200; // 200 metres
// Separate route cache for simulated active-booking tracking.
// The simulator moves every 4 seconds, but Google Routes is
// recalculated at most once every 30 seconds.
const simulatorRouteMap = new Map();
const SIMULATOR_ROUTE_INTERVAL_MS = 30 * 1000;

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

      // Helper to compute haversine distance (m)
      const haversineMeters = (a, b) => {
        const R = 6371000;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(b.latitude - a.latitude);
        const dLng = toRad(b.longitude - a.longitude);
        const lat1 = toRad(a.latitude);
        const lat2 = toRad(b.latitude);
        const sinDLat = Math.sin(dLat / 2);
        const sinDLng = Math.sin(dLng / 2);
        const h = sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
        return R * c;
      };

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
        const targetAmb = await Ambulance.findById(ambulanceId).select('vehicleNumber currentLocation');
        console.log('[TRACE LOCATION UPDATE]', {
          vehicleNumber: targetAmb ? targetAmb.vehicleNumber : ambulanceId,
          oldCoordinates: targetAmb?.currentLocation?.coordinates,
          newCoordinates: [lng, lat],
          source: 'socketService.driver_location_update',
        });

        await Ambulance.findByIdAndUpdate(ambulanceId, {
          currentLocation: { type: 'Point', coordinates: [lng, lat] },
        });

        const payload = { ambulanceId, latitude: lat, longitude: lng, speed, heading, timestamp: new Date() };

        // Enrich payload with road distance & ETA when a booking is active
        if (bookingId) {
          const booking = await Booking.findById(bookingId).select('pickupLocation');
          if (booking && booking.pickupLocation && Array.isArray(booking.pickupLocation.coordinates)) {
            const origin = { latitude: lat, longitude: lng };
            const [destLng, destLat] = booking.pickupLocation.coordinates;
            const destination = { latitude: destLat, longitude: destLng };

            const now = Date.now();
            const entry = routeThrottleMap.get(ambulanceId) || {};
            const elapsed = now - (entry.lastRouteTimestamp || 0);
            const moved = entry.lastRoutedLocation ? haversineMeters(entry.lastRoutedLocation, origin) : Infinity;
            const shouldRoute = !entry.lastRouteTimestamp || (elapsed >= MIN_ROUTE_INTERVAL_MS && moved >= MOVEMENT_THRESHOLD_M && !entry.routingInProgress);

            if (shouldRoute) {
              entry.routingInProgress = true;
              routeThrottleMap.set(ambulanceId, entry);
              try {
                const route = await getRoadInfo(origin, destination);
                payload.roadDistanceKm = route.roadDistanceKm;
                payload.etaMinutes = route.durationMinutes;
                payload.etaFallback = false;
                entry.lastRouteTimestamp = Date.now();
                entry.lastRoutedLocation = origin;
              } catch (err) {
                const straightDistMeters = haversineMeters(origin, destination);
                const fallbackEta = calculateSmartETA({
                  distanceMeters: straightDistMeters,
                  currentSpeed: speed,
                  trafficLevel: 'clear',
                  roadType: 'main_road',
                  signalsCount: 0,
                  motionStatus: speed === 0 ? 'waiting' : 'moving',
                });
                payload.roadDistanceKm = null;
                payload.etaMinutes = fallbackEta;
                payload.etaFallback = true;
                entry.lastRouteTimestamp = Date.now();
                entry.lastRoutedLocation = origin;
                console.warn(`[ROUTE] Ambulance ${ambulanceId} routing failed – using fallback ETA`);
              } finally {
                entry.routingInProgress = false;
                routeThrottleMap.set(ambulanceId, entry);
              }
            }
          }
        }

        // Emit to booking room (if any)
        if (bookingId) {
          socket.to(`booking_${bookingId}`).emit('ambulance_location', payload);
        }

        // Emit to generic watchers
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

        const speeds = [20, 30, 45, 55, 65, 0];
        const motionStatuses = ['moving', 'moving', 'moving', 'waiting', 'stuck'];
        const trafficLevels = ['clear', 'clear', 'moderate', 'heavy'];
        const roadTypes = ['highway', 'main_road', 'local_street'];

        for (const amb of availableAmbulances) {
          const baseCoords = (amb.baseLocation?.coordinates?.length === 2 && (amb.baseLocation.coordinates[0] !== 0 || amb.baseLocation.coordinates[1] !== 0))
            ? amb.baseLocation.coordinates
            : amb.currentLocation?.coordinates;

          if (!baseCoords || !baseCoords[0] || !baseCoords[1]) continue;
          const [baseLng, baseLat] = baseCoords;

          // Bounded small movement around stable base location (max ~30-50m offset)
          const dLng = (Math.random() - 0.5) * 0.0004;
          const dLat = (Math.random() - 0.5) * 0.0004;
          const newLng = baseLng + dLng;
          const newLat = baseLat + dLat;

          const currentSpeed = speeds[Math.floor(Math.random() * speeds.length)];
          const motionStatus = currentSpeed === 0 ? 'waiting' : (currentSpeed < 25 ? 'stuck' : 'moving');
          const trafficLevel = currentSpeed === 0 ? 'heavy' : (currentSpeed < 25 ? 'moderate' : 'clear');
          const roadType = roadTypes[Math.floor(Math.random() * roadTypes.length)];
          const signalsCount = Math.floor(Math.random() * 4);

          // Update MongoDB
          console.log('[TRACE LOCATION UPDATE]', {
            vehicleNumber: amb.vehicleNumber,
            oldCoordinates: amb.currentLocation?.coordinates,
            newCoordinates: [newLng, newLat],
            source: 'socketService.startSimulator.availableAmbulances',
          });

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
            console.log('[TRACE LOCATION UPDATE]', {
              vehicleNumber: amb.vehicleNumber,
              oldCoordinates: amb.currentLocation?.coordinates,
              newCoordinates: [pickupLng, pickupLat],
              source: 'socketService.startSimulator.activeBooking.atLocation',
            });
            // Keep ambulance at pickup location
            amb.currentLocation.coordinates = [pickupLng, pickupLat];
            amb.set('motionStatus', 'at_location', { strict: false });
            await amb.save();

            simulatorRouteMap.delete(booking._id.toString());

            const payload = {
              ambulanceId: amb._id,
              bookingId: booking._id,
              latitude: pickupLat,
              longitude: pickupLng,
              speed: 0,
              motionStatus: 'at_location',
              trafficLevel: 'clear',
              eta: 0,
              timestamp: new Date(),
            };

            io.to(`booking_${booking._id}`).emit('ambulance_location', payload);
            console.log(`[Simulator] Booking ${booking._id?.toString().slice(-6)}: Ambulance reached pickup location`);
            continue;
          }

          // Move coordinates 8% closer per step (if not at destination)
          const step = 0.08;
          const newLng = ambLng + (pickupLng - ambLng) * step;
          const newLat = ambLat + (pickupLat - ambLat) * step;

          const currentSpeed = 35 + Math.floor(Math.random() * 20);
          const trafficLevel = Math.random() > 0.65 ? 'moderate' : 'clear';
          const motionStatus = 'moving';
          const signalsCount = 1;

          console.log('[TRACE LOCATION UPDATE]', {
            vehicleNumber: amb.vehicleNumber,
            oldCoordinates: amb.currentLocation?.coordinates,
            newCoordinates: [newLng, newLat],
            source: 'socketService.startSimulator.activeBooking.moving',
          });

          amb.currentLocation.coordinates = [newLng, newLat];
          amb.set('currentSpeed', currentSpeed, { strict: false });
          amb.set('motionStatus', motionStatus, { strict: false });
          amb.set('trafficLevel', trafficLevel, { strict: false });
          amb.set('signalsCount', signalsCount, { strict: false });
          await amb.save();

          // Calculate LIVE road distance + traffic-aware ETA.
// The ambulance position changes every 4 seconds,
// but Google Routes is queried at most once every 30 seconds.
let liveEta = null;
let liveRoadDistanceKm = null;

const bookingKey = booking._id.toString();
const now = Date.now();
const cachedRoute = simulatorRouteMap.get(bookingKey);

const shouldRefreshRoute =
  !cachedRoute ||
  now - cachedRoute.timestamp >= SIMULATOR_ROUTE_INTERVAL_MS;

if (shouldRefreshRoute) {
  try {
    const route = await getRoadInfo(
      {
        latitude: newLat,
        longitude: newLng,
      },
      {
        latitude: pickupLat,
        longitude: pickupLng,
      }
    );

    liveEta = route.durationMinutes;
    liveRoadDistanceKm = route.roadDistanceKm;

    simulatorRouteMap.set(bookingKey, {
      timestamp: now,
      eta: liveEta,
      roadDistanceKm: liveRoadDistanceKm,
    });

    console.log(
      `[Simulator Routes] Booking ${bookingKey.slice(-6)}: ` +
      `Road Distance = ${liveRoadDistanceKm} km, ` +
      `Traffic ETA = ${liveEta} min`
    );
  } catch (err) {
    console.warn(
      `[Simulator Routes] Google Routes failed for booking ${bookingKey.slice(-6)}:`,
      err.message
    );

    // Keep the last successful real Google Routes value.
    if (cachedRoute) {
      liveEta = cachedRoute.eta;
      liveRoadDistanceKm = cachedRoute.roadDistanceKm;
    }
  }
} else {
  // Reuse the most recent real Google Routes result
  // between routing requests.
  liveEta = cachedRoute.eta;
  liveRoadDistanceKm = cachedRoute.roadDistanceKm;
}

const payload = {
  ambulanceId: amb._id,
  bookingId: booking._id,
  latitude: newLat,
  longitude: newLng,
  speed: currentSpeed,
  motionStatus,
  trafficLevel,
  roadDistanceKm: liveRoadDistanceKm,
  eta: liveEta,
  etaFallback: false,
  timestamp: new Date(),
};

io.to(`booking_${booking._id}`).emit(
  'ambulance_location',
  payload
);
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
