import client from './client';

export const alertsApi = {
  list: (params = {}) => client.get('/alerts/', { params }),
  acknowledge: (id) => client.post(`/alerts/${id}/acknowledge/`),
  resolve: (id) => client.post(`/alerts/${id}/resolve/`),
};
