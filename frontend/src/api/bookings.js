import api from './index';

export const createBooking          = (data)           => api.post('/bookings', data);
export const fetchMyBookings        = (params)         => api.get('/bookings', { params });
export const fetchBooking           = (id)             => api.get(`/bookings/${id}`);
export const fetchAmbulanceBookings = (ambulanceId, params) => api.get(`/bookings/ambulance/${ambulanceId}`, { params });
export const cancelBooking          = (id)             => api.put(`/bookings/${id}/cancel`);
export const updateBookingStatus    = (id, data)       => api.put(`/bookings/${id}/status`, data);
export const rateBooking            = (id, data)       => api.post(`/bookings/${id}/rate`, data);
export const fetchLatestLocation    = (ambulanceId)    => api.get(`/tracking/${ambulanceId}/location`);
