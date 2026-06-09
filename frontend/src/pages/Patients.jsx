import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { patientsApi } from '../api/patients';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading patients...</span>
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

export default function Patients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();

  const searchTimeout = useRef(null);

  // Debounce search input
  const onSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: () =>
      patientsApi
        .list({ search: debouncedSearch || undefined, page })
        .then((res) => res.data),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;

  const patients = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <Link
          to="/patients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium inline-flex items-center gap-2"
        >
          <span>+</span> New Patient
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={onSearchChange}
          placeholder="Search patients by name or phone..."
          className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Phone</th>
                <th className="text-left px-6 py-3">Gender</th>
                <th className="text-left px-6 py-3">Age</th>
                <th className="text-left px-6 py-3">City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <td className="px-6 py-4">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="text-blue-600 font-medium hover:text-blue-800"
                    >
                      {patient.first_name} {patient.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{patient.phone}</td>
                  <td className="px-6 py-4 text-gray-700">{patient.gender}</td>
                  <td className="px-6 py-4 text-gray-700">{patient.age}</td>
                  <td className="px-6 py-4 text-gray-700">{patient.city}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    {debouncedSearch
                      ? 'No patients match your search.'
                      : 'No patients found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
