import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../api/alerts';

const ALERT_TYPES = ['', 'ALLERGY', 'LAB_RESULT', 'VITAL_SIGN', 'MEDICATION', 'FALL_RISK'];
const SEVERITIES = ['', 'CRITICAL', 'WARNING', 'INFO'];
const STATUSES = ['', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];

function SeverityBadge({ severity }) {
  const colors = {
    CRITICAL: 'bg-red-100 text-red-700 ring-red-600/20',
    WARNING: 'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
    INFO: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
        colors[severity] || 'bg-gray-100 text-gray-600 ring-gray-500/20'
      }`}
    >
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    ACTIVE: 'bg-red-50 text-red-700',
    ACKNOWLEDGED: 'bg-yellow-50 text-yellow-700',
    RESOLVED: 'bg-green-50 text-green-700',
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading alerts...</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
      {message || 'Error loading alerts. Please try again.'}
    </div>
  );
}

export default function Alerts() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'alerts',
      { alert_type: typeFilter, severity: severityFilter, status: statusFilter },
    ],
    queryFn: () =>
      alertsApi.list({
        alert_type: typeFilter,
        severity: severityFilter,
        status: statusFilter,
      }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id) => alertsApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const alerts = data?.data || [];

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Type"
          >
            <option value="">All Types</option>
            {ALERT_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="severity-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Severity
          </label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Severity"
          >
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Status"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Severity</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Message</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  No alerts found.
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {alert.alert_type?.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {alert.patient_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {alert.message}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(alert.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {alert.status === 'ACTIVE' && (
                        <button
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => resolveMutation.mutate(alert.id)}
                          disabled={resolveMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
