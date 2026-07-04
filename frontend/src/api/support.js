import api from './index';

export const sendSupportMessage = (data) =>
  api.post('/support', data);

export const getSupportMessages = () =>
  api.get('/support');