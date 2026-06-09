import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { encountersApi } from '../api/encounters';

export default function Prescriptions() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters'],
    queryFn: () => encountersApi.list({}),
  });

  // Aggregate all medications from all encounters
  const prescriptions = useMemo(() => {
    const all = [];
    const responseData = data?.data || {};
    const encs = Array.isArray(responseData) ? responseData : (responseData.results || []);
    encs.forEach((encounter) => {
      if (encounter.medications && encounter.medications.length > 0) {
        encounter.medications.forEach((med) => {
          all.push({
            ...med,
            patient_name: encounter.patient_name,
            encounter_id: encounter.id,
          });
        });
      }
    });
    return all;
  }, [data?.data]);

  // Filter by patient name
  const filteredPrescriptions = useMemo(() => {
    if (!search.trim()) return prescriptions;
    const q = search.toLowerCase();
    return prescriptions.filter((p) => p.patient_name.toLowerCase().includes(q));
  }, [prescriptions, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Loading prescriptions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        Error loading prescriptions. Please try again.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Prescriptions</h1>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="max-w-md">
          <label htmlFor="prescription-search" className="block text-sm font-medium text-gray-700 mb-1">
            Search by Patient
          </label>
          <input
            id="prescription-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Search prescriptions by patient"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Drug</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Dosage</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Frequency</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Duration</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrescriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No prescriptions found.
                </td>
              </tr>
            ) : (
              filteredPrescriptions.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.patient_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{p.drug_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.dosage}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.frequency}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.duration}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.status}
                    </span>
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
