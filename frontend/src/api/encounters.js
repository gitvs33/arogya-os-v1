import client from './client';

export const encountersApi = {
  list: (params = {}) => client.get('/encounters/', { params }),
  get: (id) => client.get(`/encounters/${id}/`),
  create: (data) => client.post('/encounters/', data),
  addVitals: (id, data) => client.post(`/encounters/${id}/add_vitals/`, data),
  addMedication: (id, data) => client.post(`/encounters/${id}/add_medication/`, data),
  complete: (id, data) => client.post(`/encounters/${id}/complete/`, data),
};
