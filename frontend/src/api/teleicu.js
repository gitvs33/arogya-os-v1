import client from './client';

export const teleicuApi = {
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
};
