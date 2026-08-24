import api from './index';

/**
 * Billing API Client
 * All bill-related API calls for ABTS
 */
// Get bill using Booking ID
export const getBillByBooking = (bookingId) =>
  api.get(`/bills/booking/${bookingId}`);
// Generate bill for a completed booking (admin or driver)
export const generateBill = (bookingId) => api.post(`/bills/generate/${bookingId}`);

// Get bill by ID
export const getBill = (billId) => api.get(`/bills/${billId}`);

// Get all bills for logged-in user (patient)
export const getMyBills = (params) => api.get('/bills/user/my-bills', { params });

// Get all bills for logged-in driver
export const getDriverBills = (params) => api.get('/bills/driver/my-bills', { params });

// Download receipt as PDF (returns receipt data for frontend PDF generation)
export const downloadReceipt = (billId) => api.get(`/bills/${billId}/pdf`);

// Get revenue statistics (admin only)
export const getRevenueStats = (params) => api.get('/bills/stats/revenue', { params });
