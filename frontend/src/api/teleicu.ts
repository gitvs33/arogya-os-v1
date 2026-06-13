import client from './client';

export const teleicuApi = {
  // ── Monitoring lifecycle ──
  /** Fetch all currently monitored patients with their latest vitals. */
  getMonitoredPatients: () => client.get('/teleicu/monitored_patients/'),
  /** Start real-time monitoring for a patient. */
  startMonitoring: (patientId) =>
    client.post('/teleicu/start_monitoring/', { patient_id: patientId }),
  /** Stop real-time monitoring for a patient. */
  stopMonitoring: (patientId) =>
    client.post('/teleicu/stop_monitoring/', { patient_id: patientId }),
  /** Search patients (for adding new ones to monitor). */
  searchPatients: (query) => client.get('/patients/', { params: { search: query } }),

  // ── Dashboard ──
  /** Get top-level KPIs for the TeleICU dashboard. */
  getDashboardStats: () => client.get('/teleicu/dashboard-stats/'),

  // ── Vitals trend ──
  /** Get aggregated time-series vitals for trend charts. */
  getVitalsTrend: (patientId: string, period = '1H', encounterId?: string) =>
    client.get(`/teleicu/vitals-trend/${patientId}/`, {
      params: { period, encounter_id: encounterId },
    }),

  // ── Cameras ──
  /** Get active camera feed URLs for the video grid. */
  getCameras: (ward) =>
    client.get('/teleicu/cameras/', { params: ward ? { ward } : {} }),

  // ── Alerts ──
  /** Get critical alerts feed. */
  getAlerts: (status = 'ACTIVE', limit = 20) =>
    client.get('/teleicu/alerts/', { params: { status, limit } }),

  // ── Timeline ──
  /** Get unified activity log. */
  getTimeline: (patientId = null, limit = 50) =>
    client.get('/teleicu/timeline/', {
      params: { patient_id: patientId, limit },
    }),

  // ── Wards ──
  getWards: (params = {}) => client.get('/teleicu/wards/', { params }),
  getWard: (id) => client.get(`/teleicu/wards/${id}/`),
  createWard: (data) => client.post('/teleicu/wards/', data),
  updateWard: (id, data) => client.patch(`/teleicu/wards/${id}/`, data),

  // ── Beds ──
  getBeds: (params = {}) => client.get('/teleicu/beds/', { params }),
  getBed: (id) => client.get(`/teleicu/beds/${id}/`),
  createBed: (data) => client.post('/teleicu/beds/', data),
  updateBed: (id, data) => client.patch(`/teleicu/beds/${id}/`, data),

  // ── Sessions ──
  getSessions: (params = {}) => client.get('/teleicu/sessions/', { params }),
  getSession: (id) => client.get(`/teleicu/sessions/${id}/`),
  createSession: (data) => client.post('/teleicu/sessions/', data),
  updateSession: (id, data) => client.patch(`/teleicu/sessions/${id}/`, data),
  dischargeSession: (id) => client.post(`/teleicu/sessions/${id}/discharge/`),

  // ── Consults ──
  getConsults: (params = {}) => client.get('/teleicu/consults/', { params }),
  getConsult: (id) => client.get(`/teleicu/consults/${id}/`),
  createConsult: (data) => client.post('/teleicu/consults/', data),
  updateConsult: (id, data) => client.patch(`/teleicu/consults/${id}/`, data),
  startCall: (id) => client.post(`/teleicu/consults/${id}/start_call/`),
  endCall: (id) => client.post(`/teleicu/consults/${id}/end_call/`),

  // ── Activity Log ──
  getActivityLog: (params = {}) => client.get('/teleicu/activity-log/', { params }),
};
