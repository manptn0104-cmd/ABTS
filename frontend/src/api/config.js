import api from './index';

export const getAppConfig = () => api.get('/config');
