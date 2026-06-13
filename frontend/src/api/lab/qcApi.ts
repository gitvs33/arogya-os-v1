import client from '../client';

export const labQcApi = {
  getQcAudit: (orderId: string) => client.get(`/lab-qc/`, { params: { order: orderId } }),
  addQcEntry: (orderId: string, data: any) => client.post(`/lab-orders/${orderId}/qc-entry/`, data),
};
