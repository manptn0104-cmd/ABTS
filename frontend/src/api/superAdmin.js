import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const SA = `${API_BASE_URL}/superadmin`;

async function saFetch(path, method = 'GET', body = null) {
  const token = await AsyncStorage.getItem('abts_token');
  const opts  = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SA}${path}`, opts);
  return res.json();
}

export const getDashboardStats     = ()              => saFetch('/stats');
export const getOrganizations      = (q = '')        => saFetch(`/organizations${q}`);
export const createOrganization    = (data)          => saFetch('/organizations', 'POST', data);
export const updateOrganization    = (id, data)      => saFetch(`/organizations/${id}`, 'PUT', data);
export const updateOrgStatus       = (id, status, notes) => saFetch(`/organizations/${id}/status`, 'PATCH', { status, notes });
export const deleteOrganization    = (id)            => saFetch(`/organizations/${id}`, 'DELETE');
export const getSubscriptions      = ()              => saFetch('/subscriptions');
export const createSubscription    = (data)          => saFetch('/subscriptions', 'POST', data);
export const updateSubscription    = (id, data)      => saFetch(`/subscriptions/${id}`, 'PUT', data);
export const deleteSubscription    = (id)            => saFetch(`/subscriptions/${id}`, 'DELETE');
export const assignSubscription    = (data)          => saFetch('/subscriptions/assign', 'POST', data);
export const getAmbulances         = (q = '')        => saFetch(`/ambulances${q}`);
export const updateAmbulanceStatus = (id, data)      => saFetch(`/ambulances/${id}/status`, 'PATCH', data);
export const getUsers              = (q = '')        => saFetch(`/users${q}`);
export const updateUserStatus      = (id, action)    => saFetch(`/users/${id}/status`, 'PATCH', { action });
export const getUserBookings       = (id)            => saFetch(`/users/${id}/bookings`);
export const getDrivers            = (q = '')        => saFetch(`/drivers${q}`);
export const updateDriverStatus    = (id, action)    => saFetch(`/drivers/${id}/status`, 'PATCH', { action });
export const getFeedback           = (q = '')        => saFetch(`/feedback${q}`);
export const getFeedbackAnalytics  = ()              => saFetch('/feedback/analytics');
export const updateFeedbackStatus  = (id, status)    => saFetch(`/feedback/${id}/status`, 'PATCH', { status });
export const getComplaints         = (q = '')        => saFetch(`/complaints${q}`);
export const updateComplaintAction = (id, data)      => saFetch(`/complaints/${id}/action`, 'PATCH', data);
export const getPayments           = (q = '')        => saFetch(`/payments${q}`);
export const sendNotification      = (data)          => saFetch('/notifications/send', 'POST', data);
export const getReports            = (q = '')        => saFetch(`/reports${q}`);
