import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { patientsApi } from '../api/patients';
import { 
  Users, Search, Plus, ChevronRight, ChevronLeft, 
  Filter, MoreVertical, ShieldAlert, Phone, MapPin 
} from 'lucide-react';

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <div className="animate-spin h-10 w-10 border-4 border-[#0A6253]/20 border-t-[#0A6253] rounded-full" />
      <span className="text-sm font-medium text-gray-500">Loading patient records...</span>
    </div>
  );
}

function ErrorAlert({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 px-6 py-4 rounded-xl shadow-sm">
      <ShieldAlert className="text-red-500" size={24} />
      <div>
        <h4 className="text-sm font-bold">Failed to load patients</h4>
        <p className="text-xs text-red-600/80 mt-0.5">{message || 'Something went wrong. Please try again.'}</p>
      </div>
    </div>
  );
}

export default function Patients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const patients = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-6 relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Patients <span className="text-sm font-medium bg-emerald-50 text-[#0A6253] px-2.5 py-1 rounded-full border border-emerald-100">{total} total</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage and view patient directory</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 hover:text-[#0A6253] transition-colors shadow-sm">
            <Filter size={16} /> Filters
          </button>
          <Link
            to="/patients/new"
            className="px-5 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-[#084d41] transition-colors shadow-md flex items-center gap-2"
          >
            <Plus size={18} /> Register Patient
          </Link>
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={onSearchChange}
            placeholder="Search patients by name, phone, or ID..."
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-lg text-sm outline-none focus:bg-white focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] transition-all"
          />
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      {error ? (
        <ErrorAlert message={(error as Error).message} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Patient Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Demographics</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Blood Group</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6}><LoadingSpinner /></td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                          <Users size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">No patients found</h3>
                        <p className="text-xs text-gray-500 max-w-sm">
                          {debouncedSearch 
                            ? `We couldn't find any patients matching "${debouncedSearch}". Try a different search term.` 
                            : 'There are no patients registered in the system yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patients.map((patient: any) => (
                    <tr
                      key={patient.id}
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      className="hover:bg-[#F8FDFB] group transition-colors cursor-pointer"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#0A6253] font-bold text-sm">
                            {patient.full_name ? patient.full_name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm group-hover:text-[#0A6253] transition-colors">
                              {patient.full_name || 'Unknown Patient'}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">ID: {patient.id?.toString().padStart(6, '0')}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" /> {patient.phone || 'N/A'}</div>
                          <div className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-400" /> {patient.city || 'Location Unknown'}</div>
                        </div>
                      </td>

                      {/* Demographics */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">{patient.gender || 'U'} <span className="text-gray-400 mx-1">•</span> {patient.age ? `${patient.age} yrs` : 'N/A'}</div>
                      </td>

                      {/* Blood Group */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {patient.blood_group ? (
                          <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded border border-red-100">
                            {patient.blood_group}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${patient.is_active !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <span className="text-xs font-medium text-gray-700">{patient.is_active !== false ? 'Active' : 'Inactive'}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400 group-hover:text-[#0A6253]">
                        <ChevronRight size={20} className="ml-auto" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          {!isLoading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Showing <strong className="text-gray-900">{(page - 1) * 10 + 1}</strong> to <strong className="text-gray-900">{Math.min(page * 10, total)}</strong> of <strong className="text-gray-900">{total}</strong> patients
              </span>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setPage((p) => Math.max(1, p - 1)); }}
                  disabled={page === 1}
                  className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-[#0A6253] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPage((p) => p + 1); }}
                  disabled={page >= totalPages}
                  className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-[#0A6253] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
