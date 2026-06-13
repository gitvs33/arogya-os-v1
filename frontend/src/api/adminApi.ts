import client from './client';

export const adminApi = {
  getKPIs: () => client.get('/admin/kpis/'),
  getSystemOverviewChart: (period: string) => client.get(`/admin/system-overview-chart/?period=${period}`),
  getModuleStatus: () => client.get('/admin/module-status/'),
  getSystemAlerts: () => client.get('/admin/system-alerts/'),
  getUserActivity: () => client.get('/admin/user-activity/'),
  getAuditSummary: () => client.get('/admin/audit-summary/'),
  getSecurityOverview: () => client.get('/admin/security-overview/'),
  getRecentActivities: () => client.get('/admin/recent-activities/'),
  getDatabaseStorage: () => client.get('/admin/database-storage/'),
  getLicenseInfo: () => client.get('/admin/license-info/'),
  getSystemInfo: () => client.get('/admin/system-info/'),

  // Users
  getUsers: (params = {}) => client.get('/admin/users/', { params }),
  createUser: (data: any) => client.post('/admin/users/', data),
  updateUser: (id: number | string, data: any) => client.patch(`/admin/users/${id}/`, data),
  deactivateUser: (id: number | string) => client.post(`/admin/users/${id}/toggle_active/`),
  deleteUser: (id: number | string) => client.delete(`/admin/users/${id}/`),

  // Roles & Permissions
  getRoles: () => client.get('/admin/roles/'),
  createRole: (data: any) => client.post('/admin/roles/', data),
  updateRole: (id: number | string, data: any) => client.patch(`/admin/roles/${id}/`, data),
  deleteRole: (id: number | string) => client.delete(`/admin/roles/${id}/`),
  getPermissionMetadata: () => client.get('/admin/permission-metadata/'),

  // Activity Log (audit logs)
  getActivityLog: () => client.get('/admin/audit-logs/'),

  // Admin Stats (dashboard summary)
  getAdminStats: () => client.get('/admin/stats/'),
};
