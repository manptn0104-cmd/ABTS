import api from './index';

export const createReview = (reviewData) => api.post('/reviews', reviewData);
export const getDriverReviews = (driverId, params) => api.get(`/reviews/driver/${driverId}`, { params });
export const getAmbulanceReviews = (ambulanceId, params) => api.get(`/reviews/ambulance/${ambulanceId}`, { params });
export const getReview = (id) => api.get(`/reviews/${id}`);
