import api from './index';

export const fetchMyDriver = () => api.get('/drivers/me');
export const uploadDriverDocuments = (driverId, formData) =>
  api.post(`/drivers/${driverId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updateDriverVerification = (driverId, data) =>
  api.patch(`/admin/drivers/${driverId}/verification`, data);
export const fetchDriverDocuments = (driverId) =>
  api.get(`/drivers/${driverId}/documents`);
