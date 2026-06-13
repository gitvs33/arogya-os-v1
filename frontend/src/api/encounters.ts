import client from './client';

export const encountersApi = {
  list: (params = {}) => client.get('/encounters/', { params }),
  listFilterOptions: () => client.get('/encounters/filter_options/'),
  get: (id) => client.get(`/encounters/${id}/`),
  create: (data) => client.post('/encounters/', data),
  update: (id, data) => client.patch(`/encounters/${id}/`, data),
  addVitals: (id, data) => client.post(`/encounters/${id}/add_vitals/`, data),
  addMedication: (id, data) => client.post(`/encounters/${id}/add_medication/`, data),
  addLabOrder: (id, data) => client.post(`/encounters/${id}/add_lab_order/`, data),
  copyPreviousOrders: (id) => client.post(`/encounters/${id}/copy_previous_orders/`),
  accruedItems: (id) => client.get(`/encounters/${id}/accrued_items/`),
  generateInvoice: (id) => client.post(`/encounters/${id}/generate_invoice/`),
  extractOrders: (id, data) => client.post(`/encounters/${id}/extract_orders/`, data),
  complete: (id, data) => client.post(`/encounters/${id}/complete/`, data),
  prescriptions: (id) => client.get(`/encounters/${id}/prescriptions/`),
  submitPrescription: (id, prescriptionId) => client.post(`/encounters/${id}/submit_prescription/`, { prescription_id: prescriptionId }),
};

export interface ExtractionResult {
  extracted: boolean;
  medications: ExtractedMedication[];
  lab_orders: ExtractedLabTest[];
  note_text?: string;
  created_medication_count?: number;
  created_lab_order_count?: number;
  created_medication_ids?: string[];
  created_lab_order_ids?: string[];
}

export interface ExtractedMedication {
  matched: boolean;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  unit_price: number;
  inventory_item_id: string | null;
  inventory_stock: number;
  created?: string;
}

export interface ExtractedLabTest {
  matched: boolean;
  test_name: string;
  test_panel_id: string | null;
  price: number;
  created?: string;
}
