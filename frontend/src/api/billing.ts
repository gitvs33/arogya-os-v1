import client from './client';

export const billingApi = {
  list: (params = {}) => client.get('/invoices/', { params }),
  create: (data: any) => client.post('/invoices/', data),
  get: (id: string) => client.get(`/invoices/${id}/`),
  dayEndReport: () => client.get('/invoices/day_end_report/'),
  issue: (id) => client.post(`/invoices/${id}/issue/`),
  markPaid: (id) => client.post(`/invoices/${id}/mark_paid/`),
  addLineItem: (id, data) => client.post(`/invoices/${id}/add_line_item/`, data),
  getDashboard: () => client.get('/billing/dashboard/'),
  getTransactions: (params = {}) => client.get('/billing/transactions/', { params }),
  getInsights: () => client.get('/billing/insights/'),
};
