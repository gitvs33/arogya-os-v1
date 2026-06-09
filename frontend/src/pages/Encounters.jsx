import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { encountersApi } from '../api/encounters';

const ENCOUNTER_TYPES = ['', 'OPD', 'IPD', 'EMERGENCY'];
const STATUSES = ['', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function Encounters() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters', { search, status: statusFilter, encounter_type: typeFilter }],
    queryFn: () =>
      encountersApi.list({ search, status: statusFilter, encounter_type: typeFilter }),
  });

  const encounters = data?.data?.results || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Loading encounters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        Error loading encounters. Please try again.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Encounters</h1>
        <Link
          to="/encounters/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          + New Encounter
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            {ENCOUNTER_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Doctor</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {encounters.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No encounters found.
                </td>
              </tr>
            ) : (
              encounters.map((encounter) => (
                <tr
                  key={encounter.id}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/encounters/${encounter.id}`)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {encounter.patient_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{encounter.encounter_type}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        encounter.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : encounter.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : encounter.status === 'PLANNED'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {encounter.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{encounter.doctor}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{encounter.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{encounter.scheduled_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
