import api from './index';

export const fetchAmbulances = (params) => api.get('/ambulances', { params });
export const fetchAmbulance  = (id)     => api.get(`/ambulances/${id}`);
export const fetchMyAmbulance = ()      => api.get('/ambulances/mine');
export const updateAmbulanceLocation = (id, data) => api.put(`/ambulances/${id}/location`, data);
export const toggleAmbulanceAvailability = (id) => api.put(`/ambulances/${id}/availability`);
