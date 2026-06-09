import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { patientsApi } from '../api/patients';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading patient...</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {message || 'Something went wrong. Please try again.'}
    </div>
  );
}

const TABS = [
  { key: 'encounters', label: 'Encounters' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'invoices', label: 'Invoices' },
];

export default function PatientDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('encounters');

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id).then((res) => res.data),
  });

  const { data: encounters, isLoading: loadingEncounters } = useQuery({
    queryKey: ['patient-encounters', id],
    queryFn: () => patientsApi.getEncounters(id).then((res) => res.data),
    enabled: activeTab === 'encounters',
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ['patient-alerts', id],
    queryFn: () => patientsApi.getAlerts(id).then((res) => res.data),
    enabled: activeTab === 'alerts',
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['patient-invoices', id],
    queryFn: () => patientsApi.getInvoices(id).then((res) => res.data),
    enabled: activeTab === 'invoices',
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!patient) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/patients"
        className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
      >
        &larr; Back to Patients
      </Link>

      {/* Patient Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
              {patient.first_name?.[0]}{patient.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.first_name} {patient.last_name}
              </h1>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-500">Phone:</span> {patient.phone}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-500">Email:</span>{' '}
                  {patient.email || '—'}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-500">DOB:</span>{' '}
                  {patient.date_of_birth || '—'} {patient.age ? `(Age: ${patient.age})` : ''}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-500">Gender:</span> {patient.gender}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-500">Address:</span>{' '}
                  {[patient.address, patient.city, patient.state, patient.pincode]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
                {patient.abha_id && (
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-gray-500">ABHA ID:</span> {patient.abha_id}
                  </p>
                )}
              </div>
            </div>
          </div>
          <Link
            to={`/encounters/new?patientId=${id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Start Encounter
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Encounters Tab */}
          {activeTab === 'encounters' && (
            <div>
              {loadingEncounters ? (
                <LoadingSpinner />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Doctor</th>
                      <th className="text-left px-4 py-3">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(encounters || []).map((enc) => (
                      <tr key={enc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{enc.date}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-50 text-blue-700">
                            {enc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{enc.doctor}</td>
                        <td className="px-4 py-3 text-gray-700">{enc.diagnosis || '—'}</td>
                      </tr>
                    ))}
                    {(!encounters || encounters.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          No encounters found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div>
              {loadingAlerts ? (
                <LoadingSpinner />
              ) : (
                <div className="space-y-3">
                  {(alerts || []).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.severity === 'high'
                          ? 'bg-red-50 border-red-200'
                          : alert.severity === 'medium'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${
                              alert.severity === 'high'
                                ? 'bg-red-100 text-red-700'
                                : alert.severity === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <p className="mt-2 text-sm text-gray-700">{alert.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {alert.created_at}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!alerts || alerts.length === 0) && (
                    <p className="text-center text-gray-400 py-8">No alerts found.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              {loadingInvoices ? (
                <LoadingSpinner />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                      <th className="text-left px-4 py-3">Invoice #</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Amount</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(invoices || []).map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-blue-600 font-medium">{inv.invoice_no}</td>
                        <td className="px-4 py-3 text-gray-700">{inv.date}</td>
                        <td className="px-4 py-3 text-gray-700">
                          ₹{inv.amount?.toLocaleString?.() || inv.amount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              inv.status === 'paid'
                                ? 'bg-green-50 text-green-700'
                                : inv.status === 'pending'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!invoices || invoices.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          No invoices found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
