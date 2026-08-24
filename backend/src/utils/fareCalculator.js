/**
 * Fare Calculator Utility for ABTS Billing System
 * Calculates total fare including base fare, distance charges, facility charges, and GST
 */

// Configurable pricing constants (can be moved to environment variables or database)
const PRICING_CONFIG = {
  BASE_FARE: 300, // Base fare in INR
  PRICE_PER_KM: 15, // Price per kilometer in INR
  
  // Facility charges (INR)
  FACILITY_CHARGES: {
    oxygen: 500,
    saline: 200,
    stretcher: 300,
    nurse: 800,
    doctor: 1500,
    ventilator: 2000,
    defibrillator: 1000,
  },
  
  // Other charges
  WAITING_CHARGE_PER_MINUTE: 10, // INR per minute
  GST_PERCENTAGE: 18, // 18% GST
};

/**
 * Calculate total fare for a completed ride
 * @param {Object} params - Fare calculation parameters
 * @param {Number} params.baseFare - Base fare from ambulance
 * @param {Number} params.pricePerKm - Price per km from ambulance
 * @param {Number} params.distanceKm - Actual ride distance in km
 * @param {Object} params.facilities - Selected facilities with their charges
 * @param {Number} params.waitingMinutes - Waiting time in minutes
 * @param {Number} params.tollCharge - Toll charges
 * @param {Number} params.gstPercentage - GST percentage (default 18%)
 * @returns {Object} Calculated fare breakdown
 */
function calculateFare(params) {
  const {
    baseFare = PRICING_CONFIG.BASE_FARE,
    pricePerKm = PRICING_CONFIG.PRICE_PER_KM,
    distanceKm = 0,
    facilities = {},
    waitingMinutes = 0,
    tollCharge = 0,
    gstPercentage = PRICING_CONFIG.GST_PERCENTAGE,
  } = params;

  // Calculate distance charge
  const distanceCharge = distanceKm * pricePerKm;

  // Calculate facility charges
  const facilityCharges = {
    oxygenCharge: facilities.oxygen ? PRICING_CONFIG.FACILITY_CHARGES.oxygen : 0,
    salineCharge: facilities.saline ? PRICING_CONFIG.FACILITY_CHARGES.saline : 0,
    stretcherCharge: facilities.stretcher ? PRICING_CONFIG.FACILITY_CHARGES.stretcher : 0,
    nurseCharge: facilities.nurse ? PRICING_CONFIG.FACILITY_CHARGES.nurse : 0,
    doctorCharge: facilities.doctor ? PRICING_CONFIG.FACILITY_CHARGES.doctor : 0,
    ventilatorCharge: facilities.ventilator ? PRICING_CONFIG.FACILITY_CHARGES.ventilator : 0,
    defibrillatorCharge: facilities.defibrillator ? PRICING_CONFIG.FACILITY_CHARGES.defibrillator : 0,
  };

  // Calculate total facility charges
  const totalFacilityCharges = Object.values(facilityCharges).reduce((sum, charge) => sum + charge, 0);

  // Calculate waiting charge
  const waitingCharge = waitingMinutes * PRICING_CONFIG.WAITING_CHARGE_PER_MINUTE;

  // Calculate subtotal (before GST)
  const subtotal = baseFare + distanceCharge + totalFacilityCharges + waitingCharge + tollCharge;

  // Calculate GST
  const gst = (subtotal * gstPercentage) / 100;

  // Calculate total amount
  const totalAmount = subtotal + gst;

  return {
    // Input parameters
    baseFare,
    pricePerKm,
    distanceKm,
    
    // Calculated charges
    distanceCharge,
    ...facilityCharges,
    waitingCharge,
    tollCharge,
    
    // Totals
    subtotal,
    gst,
    gstPercentage,
    totalAmount,
  };
}

/**
 * Calculate fare from booking data
 * @param {Object} booking - Booking document with populated fields
 * @returns {Object} Calculated fare breakdown
 */
function calculateFareFromBooking(booking) {
  const params = {
    baseFare: booking.fare?.base || PRICING_CONFIG.BASE_FARE,
    pricePerKm: booking.ambulance?.pricePerKm || PRICING_CONFIG.PRICE_PER_KM,
    distanceKm: booking.estimatedDistance || 0,
    facilities: booking.ambulance?.facilities || {},
    waitingMinutes: 0, // Can be added later if waiting time is tracked
    tollCharge: 0, // Can be added later if tolls are tracked
  };

  return calculateFare(params);
}

/**
 * Generate receipt number
 * @returns {String} Unique receipt number
 */
function generateReceiptNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `ABTS-${dateStr}-${random}`;
}

/**
 * Format currency amount
 * @param {Number} amount - Amount to format
 * @returns {String} Formatted currency string
 */
function formatCurrency(amount) {
  return `₹${amount.toFixed(2)}`;
}

module.exports = {
  calculateFare,
  calculateFareFromBooking,
  generateReceiptNumber,
  formatCurrency,
  PRICING_CONFIG,
};
