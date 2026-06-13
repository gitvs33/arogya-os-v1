import client from '../client';

export const labDashboardApi = {
  getDashboardStats: () => client.get('/lab-orders/dashboard_stats/'),
  
  getAlerts: (params = {}) => client.get('/lab-alerts/', { params }),
  acknowledgeAlert: (id: string) => client.post(`/lab-alerts/${id}/acknowledge/`),
};
