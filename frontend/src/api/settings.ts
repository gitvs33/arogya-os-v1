import client from './client';

export const settingsApi = {
  // General & Hospital Profile
  getHospitalProfile: () => client.get('/settings/hospital-profile/'),
  updateHospitalProfile: (data: any) => client.patch('/settings/hospital-profile/', data),

  // Module Specific Settings
  getBillingSettings: () => client.get('/settings/billing/'),
  updateBillingSettings: (data: any) => client.patch('/settings/billing/', data),
  
  getPharmacySettings: () => client.get('/settings/pharmacy/'),
  updatePharmacySettings: (data: any) => client.patch('/settings/pharmacy/', data),
  
  getLaboratorySettings: () => client.get('/settings/laboratory/'),
  updateLaboratorySettings: (data: any) => client.patch('/settings/laboratory/', data),
  
  getTeleICUSettings: () => client.get('/settings/teleicu/'),
  updateTeleICUSettings: (data: any) => client.patch('/settings/teleicu/', data),

  // Notifications
  getNotifications: () => client.get('/settings/notifications/'),
  updateNotifications: (data: any) => client.patch('/settings/notifications/', data),

  // Integrations & Webhooks
  getIntegrations: () => client.get('/settings/integrations/'),
  updateIntegrations: (data: any) => client.patch('/settings/integrations/', data),
  
  getWebhooks: () => client.get('/settings/webhooks/'),
  createWebhook: (data: any) => client.post('/settings/webhooks/', data),
  deleteWebhook: (id: string) => client.delete(`/settings/webhooks/${id}/`),

  // Data Management
  getDataPolicies: () => client.get('/settings/data-policies/'),
  updateDataPolicies: (data: any) => client.patch('/settings/data-policies/', data),

  // Localization
  getLocalization: () => client.get('/settings/localization/'),
  updateLocalization: (data: any) => client.patch('/settings/localization/', data),

  // Templates
  getTemplates: () => client.get('/settings/templates/'),
  createTemplate: (data: any) => client.post('/settings/templates/', data),
  updateTemplate: (id: string, data: any) => client.patch(`/settings/templates/${id}/`, data),
  deleteTemplate: (id: string) => client.delete(`/settings/templates/${id}/`),
};
