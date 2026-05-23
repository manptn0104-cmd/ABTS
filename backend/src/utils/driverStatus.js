const DRIVER_STATUSES = ['offline', 'online', 'busy', 'on_trip', 'inactive'];

const STATUS_FROM_BOOKING = {
  confirmed: 'busy',
  in_progress: 'on_trip',
  completed: 'online',
  rejected: 'online',
  cancelled: 'online',
};

const mapBookingStatusToDriver = (bookingStatus) =>
  STATUS_FROM_BOOKING[bookingStatus] || null;

module.exports = {
  DRIVER_STATUSES,
  STATUS_FROM_BOOKING,
  mapBookingStatusToDriver,
};
