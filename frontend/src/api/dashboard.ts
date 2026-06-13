import client from './client';

export const dashboardApi = {
  /** 6 KPI cards for the top row */
  kpis: () => client.get('/dashboard/'),
  /** Live Activity Feed — recent encounters, registrations, invoices, alerts */
  activity: (params = {}) => client.get('/dashboard/activity/', { params }),
  /** Patient Flow (Today) — admissions, OPD visits, discharges */
  patientFlow: () => client.get('/dashboard/patient-flow/'),
  /** Department Overview — per-department patient counts */
  departmentOverview: () => client.get('/dashboard/department-overview/'),
  /** AI Insights — rule-based insights from current data */
  insights: () => client.get('/dashboard/insights/'),
};
