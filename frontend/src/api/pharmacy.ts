import client from './client';

export const pharmacyApi = {
  // Drug catalogue
  listDrugs: (params = {}) => client.get('/pharmacy/drugs/', { params }),
  getDrug: (id) => client.get(`/pharmacy/drugs/${id}/`),
  createDrug: (data) => client.post('/pharmacy/drugs/', data),
  updateDrug: (id, data) => client.patch(`/pharmacy/drugs/${id}/`, data),

  // Inventory
  listInventory: (params = {}) => client.get('/pharmacy/inventory/', { params }),
  getInventory: (id) => client.get(`/pharmacy/inventory/${id}/`),
  createInventory: (data) => client.post('/pharmacy/inventory/', data),
  updateInventory: (id, data) => client.patch(`/pharmacy/inventory/${id}/`, data),
  lowStock: () => client.get('/pharmacy/inventory/low_stock/'),
  expiring: () => client.get('/pharmacy/inventory/expiring/'),

  // Dispensations
  listDispensations: (params = {}) => client.get('/pharmacy/dispensations/', { params }),
  getDispensation: (id) => client.get(`/pharmacy/dispensations/${id}/`),
  createDispensation: (data) => client.post('/pharmacy/dispensations/', data),
  dispense: (id) => client.post(`/pharmacy/dispensations/${id}/dispense/`),
  cancelDispensation: (id) => client.post(`/pharmacy/dispensations/${id}/cancel/`),

  // ── Prescription-based Pharmacy Queue ───────────────────────────────
  getQueue: () => client.get('/pharmacy/queue/'),
  markInProgress: (prescriptionId) =>
    client.post('/pharmacy/queue/mark-in-progress/', { prescription_id: prescriptionId }),
  dispenseMedication: (medicationId) =>
    client.post('/pharmacy/queue/dispense-medication/', { medication_id: medicationId }),
  dispensePrescription: (prescriptionId) =>
    client.post('/pharmacy/queue/dispense-prescription/', { prescription_id: prescriptionId }),
};
