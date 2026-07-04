import api from './index';

export const registerUser    = (data) => api.post('/auth/register', data);
export const loginUser       = (data) => api.post('/auth/login', data);
export const getMe           = ()     => api.get('/auth/me');
export const updateProfile   = (data) => api.put('/auth/profile', data);
export const changePassword  = (data) => api.put('/auth/change-password', data);
export const sendOtp         = (data) => api.post('/auth/send-otp', data);
export const verifyOtp       = (data) => api.post('/auth/verify-otp', data);
