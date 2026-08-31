import api from './index';

export const createOrganization = (data) => api.post('/organizations', data);
export const getOrganizations = (params) => api.get('/organizations', { params });
export const getOrganizationById = (id) => api.get(`/organizations/${id}`);
export const updateOrganization = (id, data) => api.put(`/organizations/${id}`, data);
export const updateOrganizationStatus = (id, data) => api.patch(`/organizations/${id}/status`, data);
export const deleteOrganization = (id) => api.delete(`/organizations/${id}`);
export const restoreOrganization = (id) => api.patch(`/organizations/${id}/restore`);
