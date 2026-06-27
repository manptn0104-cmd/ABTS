/**
 * simulationService.js
 * Handles ambulance movement simulation for dev/demo purposes.
 * Only active when NODE_ENV !== 'production'.
 */
const { getIO } = require('./socketService');
const Ambulance  = require('../models/Ambulance');

// Map to track and clear simulator timers to prevent memory leaks
const simulationTimers = new Map();

/**
 * Clear any active simulation for a booking (call on cancel/complete/reject).
 */
const clearSimulation = (bookingId) => {
  const timers = simulationTimers.get(bookingId.toString());
  if (timers) {
    timers.forEach(clearTimeout);
    simulationTimers.delete(bookingId.toString());
  }
};

/**
 * Start ambulance movement simulation toward pickup when trip begins.
 * Only runs outside production.
 */
const startMovementSimulation = async (booking) => {
  if (process.env.NODE_ENV === 'production') return;

  const bookingIdStr = booking._id.toString();
  const userId       = booking.user.toString();
  const ambulanceId  = booking.ambulance._id
    ? booking.ambulance._id.toString()
    : booking.ambulance.toString();

  const pickupCoords = booking.pickupLocation?.coordinates; // [lng, lat]
  const amb          = await Ambulance.findById(ambulanceId);

  if (!amb?.currentLocation?.coordinates || !pickupCoords) return;

  const io = getIO();
  const [startLng, startLat]   = amb.currentLocation.coordinates;
  const [pickupLng, pickupLat] = pickupCoords;
  const STEPS = 10;

  for (let i = 0; i <= STEPS; i++) {
    const frac    = i / STEPS;
    const stepLat = startLat + (pickupLat - startLat) * frac;
    const stepLng = startLng + (pickupLng - startLng) * frac;
    const etaMin  = Math.round((STEPS - i) * 0.4);

    const timerId = setTimeout(() => {
      io.to(`booking_${bookingIdStr}`).emit('ambulance_location', {
        ambulanceId,
        latitude:  stepLat,
        longitude: stepLng,
        eta:       etaMin,
      });
      io.to(`user_${userId}`).emit('ambulance_location', {
        ambulanceId,
        latitude:  stepLat,
        longitude: stepLng,
        eta:       etaMin,
      });
    }, i * 3000);

    if (!simulationTimers.has(bookingIdStr)) simulationTimers.set(bookingIdStr, []);
    simulationTimers.get(bookingIdStr).push(timerId);
  }
};

module.exports = { startMovementSimulation, clearSimulation };
