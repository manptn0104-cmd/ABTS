import { AMBULANCE_TYPES, BOOKING_STATUS, FACILITIES } from './constants';

/**
 * Format distance: metres → "1.2 km" or "350 m"
 */
export const formatDistance = (metres) => {
  if (!metres && metres !== 0) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
};

/**
 * Format ETA in minutes → "5 min" or "1 hr 20 min"
 */
export const formatETA = (minutes) => {
  if (!minutes && minutes !== 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

/**
 * Format currency (INR)
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
};

/**
 * Get ambulance type config (label + color)
 */
export const getAmbulanceType = (type) =>
  AMBULANCE_TYPES.find((t) => t.value === type) || AMBULANCE_TYPES[0];

/**
 * Get booking status config (label + color + bg)
 */
export const getBookingStatus = (status) =>
  BOOKING_STATUS[status] || { label: status, color: '#757575', bg: '#F5F5F5' };

/**
 * Get available facilities list from facility object
 */
export const getAvailableFacilities = (facilitiesObj) =>
  FACILITIES.filter((f) => facilitiesObj?.[f.key]);

/**
 * Calculate Haversine distance between two lat/lng points (returns km)
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Estimate ETA in minutes given distance in km at a default speed
 */
export const estimateETA = (distanceKm, speedKmh = 40) =>
  Math.round((distanceKm / speedKmh) * 60);

/**
 * Truncate text
 */
export const truncate = (text, maxLen = 40) => {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
};

/**
 * Format date/time
 */
export const formatDateTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const formatTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
