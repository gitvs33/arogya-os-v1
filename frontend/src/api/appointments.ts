import client from './client';

export const appointmentsApi = {
  list: (params = {}) => client.get('/appointments/', { params }),
  get: (id) => client.get(`/appointments/${id}/`),
  create: (data) => client.post('/appointments/', data),
  update: (id, data) => client.patch(`/appointments/${id}/`, data),

  // Lifecycle actions
  checkIn: (id) => client.post(`/appointments/${id}/check_in/`),
  start: (id) => client.post(`/appointments/${id}/start/`),
  cancel: (id, reason = '') => client.post(`/appointments/${id}/cancel/`, { reason }),
  reschedule: (id, data) => client.patch(`/appointments/${id}/reschedule/`, data),

  // Queries
  upcoming: () => client.get('/appointments/upcoming/'),
  doctorAvailability: (doctorId, date) =>
    client.get(`/appointments/doctors/${doctorId}/availability/`, { params: { date } }),
};
