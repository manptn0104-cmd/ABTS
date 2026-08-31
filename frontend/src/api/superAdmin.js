import api from './index';

export const getSuperAdminOverview = () => api.get('/super-admin/overview');
export const getAuditLogs = (params) => api.get('/super-admin/audit-logs', { params });
export const listAdmins = () => api.get('/super-admin/admins');
export const createAdmin = (data) => api.post('/super-admin/admins', data);
export const deleteAdmin = (id) => api.delete(`/super-admin/admins/${id}`);
export const suspendAdmin = (id, data) => api.patch(`/super-admin/admins/${id}/suspend`, data);
