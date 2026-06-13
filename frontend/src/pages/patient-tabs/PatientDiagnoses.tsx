import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { Plus, MoreVertical } from 'lucide-react';

export default function PatientDiagnoses({ patientId }: { patientId: string }) {
  const { data: diagnoses, isLoading } = useQuery({
    queryKey: ['patient-diagnoses', patientId],
    queryFn: () => patientsApi.getDiagnoses(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(diagnoses) ? diagnoses : (diagnoses?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Diagnoses / Problems List</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <Plus size={16} /> Add Diagnosis
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">ICD-10</th>
              <th className="px-6 py-4">Condition</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Onset Date</th>
              <th className="px-6 py-4">Resolved Date</th>
              <th className="px-6 py-4">Notes</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No diagnoses recorded.</td>
              </tr>
            ) : (
              list.map((d: any) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-gray-600 bg-gray-50/50">{d.icd10_code || '—'}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{d.condition_name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      d.status === 'ACTIVE' ? 'bg-red-50 text-red-700 border border-red-100' :
                      d.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{d.onset_date ? new Date(d.onset_date).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{d.resolved_date ? new Date(d.resolved_date).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{d.notes || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-700"><MoreVertical size={16} /></button>
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
