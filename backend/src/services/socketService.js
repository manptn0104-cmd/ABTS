const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Ambulance = require('../models/Ambulance');
const Location = require('../models/Location');
const Booking = require('../models/Booking');
const polyline = require('@mapbox/polyline');
const { getRoutePolyline, getDetailedRoutePolyline } = require('./routingService');
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
// One route stored for each booking
const simulatorRouteMap = new Map();
// bookingId -> { points, currentIndex }
// const SIMULATOR_ROUTE_INTERVAL_MS = 30 * 1000;

// ── Route-following helpers (points are [lat, lng]) ──────────────────────────
const haversineM = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Compass bearing in degrees (0 = north, 90 = east).
const bearingDeg = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const buildRouteState = (points) => {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  }
  return { points, cum, total: cum[cum.length - 1], traveled: 0 };
};

// Point located `dist` metres along the route, plus the index of the segment it is on.
const pointAt = (state, dist) => {
  const d = Math.max(0, Math.min(state.total, dist));
  let i = 1;
  while (i < state.cum.length - 1 && state.cum[i] < d) i++;
  const seg = state.cum[i] - state.cum[i - 1];
  const t = seg > 0 ? (d - state.cum[i - 1]) / seg : 0;
  const a = state.points[i - 1];
  const b = state.points[i];
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index: i };
};

// Route vertices between two distances, including interpolated end points.
const sliceRoute = (state, fromDist, toDist) => {
  const start = pointAt(state, fromDist);
  const end = pointAt(state, toDist);
  const out = [start.point];
  for (let i = start.index; i < end.index; i++) out.push(state.points[i]);
  out.push(end.point);
  return out;
};

// Remaining route from the current position, thinned to at most `max` points.
const remainingRoute = (state, max) => {
  const here = pointAt(state, state.traveled);
  const rest = [here.point, ...state.points.slice(here.index)];
  if (rest.length <= max) return rest;
  const stride = Math.ceil(rest.length / max);
  const thin = rest.filter((_, i) => i % stride === 0);
  const last = rest[rest.length - 1];
  if (thin[thin.length - 1] !== last) thin.push(last);
  return thin;
};

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
          const validCoords = (c) => c?.length === 2 && (c[0] !== 0 || c[1] !== 0);
          // Idle ambulances stay where they last were (e.g. the drop-off), not snapped back to base.
          const baseCoords = validCoords(amb.currentLocation?.coordinates)
            ? amb.currentLocation.coordinates
            : amb.baseLocation?.coordinates;

          if (!baseCoords || !baseCoords[0] || !baseCoords[1]) continue;
          const [baseLng, baseLat] = baseCoords;

          const dLng = (Math.random() - 0.5) * 0.0003;
          const dLat = (Math.random() - 0.5) * 0.0003;
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

          // The ambulance only moves during the two driving legs of the trip.
          const stage = booking.tripStage || (booking.status === 'in_progress' ? 'en_route_to_pickup' : 'assigned');
          let destination;
          if (stage === 'en_route_to_pickup') destination = booking.pickupLocation?.coordinates;
          else if (stage === 'en_route_to_hospital') destination = booking.dropLocation?.coordinates;
          if (!destination || destination.length < 2) continue;

          let [ambLng, ambLat] = amb.currentLocation.coordinates;
          const [pickupLng, pickupLat] = destination;

          // Calculate current distance to check if reached pickup
          const dLatCheck = (pickupLat - ambLat) * Math.PI / 180;
          const dLonCheck = (pickupLng - ambLng) * Math.PI / 180;
          const aCheck = Math.sin(dLatCheck/2) * Math.sin(dLatCheck/2) +
                        Math.cos(ambLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                        Math.sin(dLonCheck/2) * Math.sin(dLonCheck/2);
          const cCheck = 2 * Math.atan2(Math.sqrt(aCheck), Math.sqrt(1-aCheck));
          const currentDistanceMeters = 6371000 * cCheck;

          // Stop movement simulation once the ambulance has reached the destination
          if (currentDistanceMeters < 8) {
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

            simulatorRouteMap.delete(`${booking._id}_${stage}`);

            const payload = {
              ambulanceId: amb._id,
              bookingId: booking._id,
              latitude: pickupLat,
              longitude: pickupLng,
              speed: 0,
              motionStatus: 'at_location',
              stage,
              path: [[pickupLat, pickupLng]],
              route: [],
              trafficLevel: 'clear',
              eta: 0,
              timestamp: new Date(),
            };

            io.to(`booking_${booking._id}`).emit('ambulance_location', payload);
            console.log(`[Simulator] Booking ${booking._id?.toString().slice(-6)}: Ambulance reached pickup location`);
            continue;
          }

          // Move coordinates 8% closer per step (if not at destination)

const bookingKey = `${booking._id}_${stage}`;

let routeState = simulatorRouteMap.get(bookingKey);

          // Generate the road route once per leg (pickup / drop-off)
          if (!routeState) {
            const raw = await getDetailedRoutePolyline(
              { latitude: ambLat, longitude: ambLng },
              { latitude: pickupLat, longitude: pickupLng }
            );
            routeState = buildRouteState([[ambLat, ambLng], ...raw, [pickupLat, pickupLng]]);
            simulatorRouteMap.set(bookingKey, routeState);
          }

          const currentSpeed = 40 + Math.floor(Math.random() * 15);
          // Distance covered in one 4s simulator tick at the current speed.
          const stepMeters = (currentSpeed / 3.6) * 4;
          const fromDist = routeState.traveled;
          const toDist = Math.min(routeState.total, fromDist + stepMeters);
          routeState.traveled = toDist;

          const tickPath = sliceRoute(routeState, fromDist, toDist);
          const [newLat, newLng] = tickPath[tickPath.length - 1];
          const lastSeg = tickPath.length > 1
            ? [tickPath[tickPath.length - 2], tickPath[tickPath.length - 1]]
            : [[ambLat, ambLng], [newLat, newLng]];
          const heading = bearingDeg(lastSeg[0], lastSeg[1]);
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

          // Remaining road distance and ETA from the real route length.
const remainingMeters = Math.max(0, routeState.total - routeState.traveled);

const liveEta = Math.max(0, Math.ceil(remainingMeters / (currentSpeed / 3.6) / 60));

const liveRoadDistanceKm = Number((remainingMeters / 1000).toFixed(2));

const payload = {
  ambulanceId: amb._id,
  bookingId: booking._id,
  latitude: newLat,
  longitude: newLng,
  heading,
  // Vertices travelled during this tick; the client animates along them.
  path: tickPath,
  // Remaining road ahead of the vehicle (downsampled), drawn as the live route.
  route: remainingRoute(routeState, 250),
  stage,
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

// Sends the ambulance's current position (and, on driving legs, the route ahead)
// to the booking room right after a stage change, so the tracking screen does not
// wait for the next simulator tick.
const emitStageLocation = async (booking) => {
  try {
    const amb = booking.ambulance;
    const coords = amb?.currentLocation?.coordinates;
    if (!coords || !io) return;
    const [lng, lat] = coords;
    const stage = booking.tripStage;

    let destination;
    if (stage === 'en_route_to_pickup') destination = booking.pickupLocation?.coordinates;
    else if (stage === 'en_route_to_hospital') destination = booking.dropLocation?.coordinates;

    const payload = {
      ambulanceId: amb._id,
      bookingId: booking._id,
      latitude: lat,
      longitude: lng,
      stage,
      path: [[lat, lng]],
      route: [],
      speed: 0,
      motionStatus: 'waiting',
      trafficLevel: 'clear',
      eta: 0,
      timestamp: new Date(),
    };

    if (destination && destination.length >= 2) {
      const [dLng, dLat] = destination;
      const bookingKey = `${booking._id}_${stage}`;
      let routeState = simulatorRouteMap.get(bookingKey);
      if (!routeState) {
        const raw = await getDetailedRoutePolyline(
          { latitude: lat, longitude: lng },
          { latitude: dLat, longitude: dLng }
        );
        routeState = buildRouteState([[lat, lng], ...raw, [dLat, dLng]]);
        simulatorRouteMap.set(bookingKey, routeState);
      }
      payload.route = remainingRoute(routeState, 250);
      payload.heading = payload.route.length > 1 ? bearingDeg(payload.route[0], payload.route[1]) : 0;
      payload.roadDistanceKm = Number(((routeState.total - routeState.traveled) / 1000).toFixed(2));
      payload.eta = Math.max(1, Math.ceil((routeState.total - routeState.traveled) / (45 / 3.6) / 60));
      payload.motionStatus = 'moving';
    }

    io.to(`booking_${booking._id}`).emit('ambulance_location', payload);
  } catch (err) {
    console.error('[emitStageLocation] failed:', err.message);
  }
};

module.exports = { initializeSocket, getIO, emitStageLocation };
