import client from './client';

export const patientsApi = {
  list: (params = {}) => client.get('/patients/', { params }),
  get: (id) => client.get(`/patients/${id}/`),
  create: (data) => client.post('/patients/', data),
  update: (id, data) => client.patch(`/patients/${id}/`, data),
  getEncounters: (id) => client.get(`/patients/${id}/encounters/`),
  getAlerts: (id) => client.get(`/patients/${id}/alerts/`),
  getInvoices: (id) => client.get(`/patients/${id}/invoices/`),
};
