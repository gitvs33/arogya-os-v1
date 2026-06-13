import client from './client';

export const patientsApi = {
  list: (params = {}) => client.get('/patients/', { params }),
  get: (id) => client.get(`/patients/${id}/`),
  create: (data) => client.post('/patients/', data),
  update: (id, data) => client.patch(`/patients/${id}/`, data),
  delete: (id) => client.delete(`/patients/${id}/`),

  // Registration wizard
  finalize: (id) => client.post(`/patients/${id}/finalize/`),
  registerWithEncounter: (data) => client.post('/patients/register_with_encounter/', data),

  // Quick actions
  checkExists: (params) => client.get('/patients/check_exists/', { params }),
  verifyAadhaar: (aadhaarNumber) => client.post('/patients/verify_aadhaar/', { aadhaar_number: aadhaarNumber }),

  // Relationship endpoints
  getEncounters: (id) => client.get(`/patients/${id}/encounters/`),
  getAlerts: (id) => client.get(`/patients/${id}/alerts/`),
  getInvoices: (id) => client.get(`/patients/${id}/invoices/`),
  getTimeline: (id) => client.get(`/patients/${id}/timeline/`),
  getDiagnoses: (id) => client.get('/diagnoses/', { params: { patient: id } }),
  getOrders: (id) => client.get('/orders/', { params: { patient: id } }),
  getLabResults: (id) => client.get('/lab-results/', { params: { patient: id } }),
  getImaging: (id) => client.get('/imaging/', { params: { patient: id } }),
  getAllergies: (id) => client.get('/allergies/', { params: { patient: id } }),
  getDocuments: (id) => client.get('/documents/', { params: { patient: id } }),
  getCarePlans: (id) => client.get('/care-plans/', { params: { patient: id } }),
};

export const insuranceApi = {
  list: (params = {}) => client.get('/insurance/', { params }),
  get: (id) => client.get(`/insurance/${id}/`),
  create: (data) => client.post('/insurance/', data),
  update: (id, data) => client.patch(`/insurance/${id}/`, data),
  delete: (id) => client.delete(`/insurance/${id}/`),
};
