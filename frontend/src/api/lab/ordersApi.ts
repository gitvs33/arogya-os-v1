import client from '../client';

export const labOrdersApi = {
  listOrders: (params = {}) => client.get('/lab-orders/', { params }),
  getOrder: (id: string) => client.get(`/lab-orders/${id}/`),
  createOrder: (data: any) => client.post('/lab-orders/', data),
  updateOrder: (id: string, data: any) => client.patch(`/lab-orders/${id}/`, data),

  collectSample: (id: string) => client.post(`/lab-orders/${id}/collect_sample/`),
  receiveInLab: (id: string) => client.post(`/lab-orders/${id}/receive_in_lab/`),
  submitResults: (id: string) => client.post(`/lab-orders/${id}/submit_results/`),
  approveReport: (id: string) => client.post(`/lab-orders/${id}/approve_report/`),
  repeatTest: (id: string) => client.post(`/lab-orders/${id}/repeat_test/`),
  addNote: (id: string, note: string) => client.post(`/lab-orders/${id}/add_note/`, { note }),

  getDocuments: (orderId: string) => client.get(`/lab-documents/`, { params: { order: orderId } }),
  uploadDocument: (orderId: string, formData: FormData) => {
    formData.append('order', orderId);
    return client.post(`/lab-documents/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadReport: (orderId: string) => client.get(`/lab-orders/${orderId}/download_report/`, { responseType: 'blob' }),

  printLabels: (orderIds: string[]) => client.post('/lab-orders/print_labels/', { order_ids: orderIds }, { responseType: 'blob' }),

  exportReport: (params = {}) => client.get('/lab-orders/reports/', { params, responseType: 'blob' }),
};
