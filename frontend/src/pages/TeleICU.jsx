import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teleicuApi } from '../api/teleicu';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAlertWebSocket } from '../hooks/useAlertWebSocket';
import VideoCall from '../components/VideoCall';
import AlertToast from '../components/AlertToast';

// ── Helpers ─────────────────────────────────────────────────────────────

function getTeleicuWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/teleicu/`;
}

/**
 * Derive a monitoring status from vitals.
 * Returns 'critical' | 'warning' | 'stable'.
 */
function computeStatus(vitals) {
  if (!vitals) return 'stable';

  const { systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation } = vitals;

  // Critical ranges
  if (
    (systolic_bp != null && systolic_bp < 80) ||
    (systolic_bp != null && systolic_bp > 200) ||
    (diastolic_bp != null && diastolic_bp > 120) ||
    (heart_rate != null && heart_rate > 140) ||
    (heart_rate != null && heart_rate < 40) ||
    (oxygen_saturation != null && oxygen_saturation < 88) ||
    (temperature != null && temperature > 105) ||
    (temperature != null && temperature < 94)
  ) {
    return 'critical';
  }

  // Warning ranges
  if (
    (systolic_bp != null && (systolic_bp < 90 || systolic_bp > 160)) ||
    (diastolic_bp != null && (diastolic_bp < 60 || diastolic_bp > 100)) ||
    (heart_rate != null && (heart_rate < 50 || heart_rate > 110)) ||
    (oxygen_saturation != null && oxygen_saturation < 92) ||
    (temperature != null && (temperature < 96 || temperature > 101))
  ) {
    return 'warning';
  }

  return 'stable';
}

const STATUS_STYLES = {
  critical: { bg: 'bg-red-50 border-red-300', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Critical' },
  warning: { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'Warning' },
  stable: { bg: 'bg-white border-gray-200', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'Stable' },
};

// ── Sub-component: Monitoring Card ─────────────────────────────────────

function PatientCard({ patient, onStopMonitoring }) {
  const vitals = patient.vitals || {};
  const status = patient.status || computeStatus(vitals);
  const styles = STATUS_STYLES[status] || STATUS_STYLES.stable;

  return (
    <div className={`rounded-lg border p-5 ${styles.bg} transition-colors`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{patient.name}</h3>
          {patient.bed && (
            <p className="text-xs text-gray-500 mt-0.5">{patient.bed}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${styles.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {styles.label}
        </span>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        <VitalRow
          label="BP"
          value={
            vitals.systolic_bp != null && vitals.diastolic_bp != null
              ? `${vitals.systolic_bp}/${vitals.diastolic_bp}`
              : '—'
          }
          unit="mmHg"
        />
        <VitalRow
          label="HR"
          value={vitals.heart_rate != null ? vitals.heart_rate : '—'}
          unit="bpm"
        />
        <VitalRow
          label="Temp"
          value={vitals.temperature != null ? vitals.temperature : '—'}
          unit="°F"
        />
        <VitalRow
          label="SpO₂"
          value={vitals.oxygen_saturation != null ? vitals.oxygen_saturation : '—'}
          unit="%"
        />
      </div>

      {/* Action */}
      <button
        onClick={() => onStopMonitoring(patient.id)}
        className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
      >
        Stop Monitoring
      </button>
    </div>
  );
}

function VitalRow({ label, value, unit }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">
        {value}{' '}
        <span className="text-xs font-normal text-gray-400">{unit}</span>
      </span>
    </div>
  );
}

// ── Sub-component: Search Section ───────────────────────────────────────

function AddPatientSection({ onStartMonitoring, searchResults, onSearch }) {
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Patient to Monitor</h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient name or ID…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Search results */}
      {searchResults && searchResults.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {searchResults.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">ID: {p.id}</p>
              </div>
              <button
                onClick={() => onStartMonitoring(p.id)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Start Monitoring
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchResults && searchResults.length === 0 && query && (
        <p className="mt-2 text-sm text-gray-500">No patients found.</p>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────

export default function TeleICU() {
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [error, setError] = useState('');

  // Alert toast state
  const { latestAlert, clearAlert } = useAlertWebSocket();
  const [toastAlert, setToastAlert] = useState(null);

  // ── Fetch monitored patients ───────────────────────────────────────────

  const {
    data: monitoredData,
    isLoading,
    refetch: refetchMonitored,
  } = useQuery({
    queryKey: ['teleicu-monitored'],
    queryFn: () => teleicuApi.getMonitoredPatients(),
  });

  // Sync initial data
  useEffect(() => {
    if (monitoredData?.data) {
      const list = Array.isArray(monitoredData.data)
        ? monitoredData.data
        : monitoredData.data.results || [];
      setPatients(list);
    }
  }, [monitoredData]);

  // ── WebSocket for real-time vitals ──────────────────────────────────────

  const token = sessionStorage.getItem('medos_token');
  const { isConnected: wsConnected, lastMessage: vitalsMsg } = useWebSocket(
    token ? getTeleicuWsUrl() : null,
  );

  // Handle incoming vitals updates
  useEffect(() => {
    if (!vitalsMsg?.data) return;

    let data;
    try {
      data = JSON.parse(vitalsMsg.data);
    } catch {
      return;
    }

    switch (data.type) {
      case 'vitals_update':
        setPatients((prev) =>
          prev.map((p) =>
            p.id === data.patient_id
              ? { ...p, vitals: data.vitals, status: data.status || computeStatus(data.vitals) }
              : p,
          ),
        );
        break;

      case 'patient_added':
        if (data.patient) {
          setPatients((prev) => {
            if (prev.some((p) => p.id === data.patient.id)) return prev;
            return [...prev, data.patient];
          });
        }
        break;

      case 'patient_removed':
        setPatients((prev) => prev.filter((p) => p.id !== data.patient_id));
        break;

      case 'initial_state':
        if (Array.isArray(data.patients)) {
          setPatients(data.patients);
        }
        break;

      default:
        break;
    }
  }, [vitalsMsg]);

  // ── Alert toast integration ─────────────────────────────────────────────

  useEffect(() => {
    if (latestAlert) {
      setToastAlert(latestAlert);
    }
  }, [latestAlert]);

  const handleDismissToast = useCallback(() => {
    setToastAlert(null);
    clearAlert();
  }, [clearAlert]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleStartMonitoring = async (patientId) => {
    setError('');
    try {
      await teleicuApi.startMonitoring(patientId);
      setSearchResults(null);
      // Add to local list optimistically
      setPatients((prev) => {
        if (prev.some((p) => p.id === patientId)) return prev;
        // Try to pull from search results
        const found = searchResults?.find((p) => p.id === patientId);
        return found ? [...prev, { ...found, vitals: {}, status: 'stable' }] : prev;
      });
      refetchMonitored();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start monitoring.');
    }
  };

  const handleStopMonitoring = async (patientId) => {
    setError('');
    try {
      await teleicuApi.stopMonitoring(patientId);
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to stop monitoring.');
    }
  };

  const handleSearch = async (query) => {
    setError('');
    try {
      const res = await teleicuApi.searchPatients(query);
      const list = res.data?.results || res.data || [];
      setSearchResults(list);
    } catch (err) {
      setError('Search failed. Try again.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TeleICU Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time patient monitoring &amp; video consultation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WS connection indicator */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
              wsConnected
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {wsConnected ? 'Live' : 'Disconnected'}
          </span>

          {/* Patient count */}
          <span className="text-sm text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1.5">
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Monitored patients grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          <span className="ml-3 text-gray-500">Loading monitored patients…</span>
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🫀</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Patients Monitored</h3>
          <p className="text-sm text-gray-500 mb-4">
            Search for a patient below to start monitoring their vitals in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onStopMonitoring={handleStopMonitoring}
            />
          ))}
        </div>
      )}

      {/* Add patient section */}
      <AddPatientSection
        onStartMonitoring={handleStartMonitoring}
        searchResults={searchResults}
        onSearch={handleSearch}
      />

      {/* Video call widget */}
      <VideoCall roomName="teleicu" />

      {/* Alert toast */}
      {toastAlert && (
        <AlertToast alert={toastAlert} onDismiss={handleDismissToast} />
      )}
    </div>
  );
}
