import api from './index';

export const getNearbyBikeAmbulances = (params) =>
  api.get('/bike-ambulances/nearby', { params });

export const getBikeRecommendation = (params) =>
  api.get('/bike-ambulances/recommendation', { params });

export const assignBikeAmbulance = (data) =>
  api.post('/bike-ambulances/assign', data);

export const updateBikeStatus = (bikeBookingId, data) =>
  api.put(`/bike-ambulances/${bikeBookingId}/status`, data);

export const getMyBikeBookings = () =>
  api.get('/bike-ambulances/my-bookings');

export const getEmergencyConfig = () =>
  api.get('/bike-ambulances/emergency-config');

export const updateEmergencyConfig = (config) =>
  api.put('/bike-ambulances/emergency-config', config);

export const listAllBikeAmbulances = () =>
  api.get('/bike-ambulances');
