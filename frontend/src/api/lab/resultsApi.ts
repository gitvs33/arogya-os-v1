import client from '../client';

export const labResultsApi = {
  getResults: (orderId: string) => client.get(`/lab-parameter-results/`, { params: { order: orderId } }),
  submitResultsBulk: (orderId: string, data: any) => client.post(`/lab-orders/${orderId}/submit_results/`, data),
  updateResult: (resultId: string, data: any) => client.patch(`/lab-parameter-results/${resultId}/`, data),

  getResultTrend: (patientId: string, parameterId: string, months = 6) =>
    client.get('/lab-results/trend/', { params: { patient_id: patientId, parameter_id: parameterId, months } }),

  getHistory: (patientId: string, panelId: string, limit = 5) =>
    client.get('/lab-results/history/', { params: { patient_id: patientId, panel_id: panelId, limit } }),
};
