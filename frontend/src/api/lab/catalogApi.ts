import client from '../client';

export const labCatalogApi = {
  listPanels: (params: Record<string, any> = {}) => client.get('/lab-panels/', { params }),
  getPanel: (id: string) => client.get(`/lab-panels/${id}/`),
};
