import api from './index';

export const fetchAmbulances = (params) => api.get('/ambulances', { params });
export const fetchAmbulance  = (id)     => api.get(`/ambulances/${id}`);
export const fetchMyAmbulance = ()      => api.get('/ambulances/mine');
export const updateAmbulanceLocation = (id, data) => api.put(`/ambulances/${id}/location`, data);
export const toggleAmbulanceAvailability = (id) => api.put(`/ambulances/${id}/availability`);
export const registerAmbulance = (data) => api.post('/ambulances', data);
export const uploadAmbulanceDocuments = (id, formData) => api.post(`/ambulances/${id}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
