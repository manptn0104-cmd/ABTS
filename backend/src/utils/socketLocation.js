/**
 * Broadcast driver GPS to patients — keeps legacy events + new naming convention.
 */
const emitDriverLocation = (io, { bookingId, ambulanceId, payload }) => {
  const data = {
    ambulanceId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed ?? 0,
    heading: payload.heading ?? 0,
    accuracy: payload.accuracy ?? 0,
    timestamp: payload.timestamp || new Date(),
    eta: payload.eta ?? null,
  };

  if (bookingId) {
    io.to(`booking_${bookingId}`).emit('ambulance_location', data);
    io.to(`booking_${bookingId}`).emit(`booking:${bookingId}:location`, data);
  }

  if (ambulanceId) {
    io.to(`watch_ambulance_${ambulanceId}`).emit('ambulance_location', data);
  }
};

module.exports = { emitDriverLocation };
