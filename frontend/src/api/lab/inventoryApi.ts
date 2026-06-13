import client from '../client';

export const labInventoryApi = {
  getInventory: (params = {}) => client.get('/lab-inventory/', { params }),
  updateInventory: (id: string, data: any) => client.patch(`/lab-inventory/${id}/`, data),
  getLowStock: () => client.get('/lab-inventory/low-stock/'),
};
