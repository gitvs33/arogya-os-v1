import client from './client';

export const adminApi = {
  // Users
  getUsers: (params?: any) => client.get('/admin/users/', { params }),

  // Departments
  listDepartments: (params?: any) => client.get('/admin/departments/', { params }),
  createDepartment: (data: any) => client.post('/admin/departments/', data),
  updateDepartment: (id: string, data: any) => client.patch(`/admin/departments/${id}/`, data),
  deleteDepartment: (id: string) => client.delete(`/admin/departments/${id}/`),

  // Ward Setup
  listWards: (params?: any) => client.get('/admin/ward-setup/', { params }),
  createWard: (data: any) => client.post('/admin/ward-setup/', data),
  getWard: (id: string) => client.get(`/admin/ward-setup/${id}/`),
  updateWard: (id: string, data: any) => client.patch(`/admin/ward-setup/${id}/`, data),
  listBeds: (wardId: string) => client.get(`/admin/ward-setup/${wardId}/beds/`),
  bulkCreateBeds: (wardId: string, count: number) => client.post(`/admin/ward-setup/${wardId}/bulk_create_beds/`, { count }),
  updateBedStatus: (wardId: string, bedId: string, status: string) => client.post(`/admin/ward-setup/${wardId}/update_bed_status/`, { bed_id: bedId, status }),
  deleteWard: (id: string) => client.delete(`/admin/ward-setup/${id}/`),
  deleteBed: (wardId: string, bedId: string) => client.post(`/admin/ward-setup/${wardId}/delete_bed/`, { bed_id: bedId }),

  // Lab Panels Setup
  listLabPanels: (params?: any) => client.get('/admin/lab-panels/', { params }),
  createLabPanel: (data: any) => client.post('/admin/lab-panels/', data),
  getLabPanel: (id: string) => client.get(`/admin/lab-panels/${id}/`),
  updateLabPanel: (id: string, data: any) => client.patch(`/admin/lab-panels/${id}/`, data),
  listLabParameters: (panelId: string) => client.get(`/admin/lab-panels/${panelId}/parameters/`),
  addLabParameter: (panelId: string, data: any) => client.post(`/admin/lab-panels/${panelId}/add_parameter/`, data),

  // Master Data
  listMasterData: (category: string) => client.get('/admin/master-data/', { params: { category } }),
  createMasterData: (data: any) => client.post('/admin/master-data/', data),
  updateMasterData: (id: string, data: any) => client.patch(`/admin/master-data/${id}/`, data),
  deleteMasterData: (id: string) => client.delete(`/admin/master-data/${id}/`),
};
