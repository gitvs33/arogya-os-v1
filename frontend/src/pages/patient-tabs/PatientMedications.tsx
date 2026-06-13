import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { Pill, Plus, MoreVertical } from 'lucide-react';

export default function PatientMedications({ patientId }: { patientId: string }) {
  // Medications are returned as part of encounters.
  const { data: encounters, isLoading } = useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: () => patientsApi.getEncounters(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const allEncounters = encounters || [];
  const medications = allEncounters.flatMap((e: any) => e.medications || []);
  
  // Sort by prescribed_at descending
  medications.sort((a: any, b: any) => new Date(b.prescribed_at).getTime() - new Date(a.prescribed_at).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Medications</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <Plus size={16} /> Prescribe
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Medication</th>
              <th className="px-6 py-4">Dosage</th>
              <th className="px-6 py-4">Frequency</th>
              <th className="px-6 py-4">Duration</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Prescribed On</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {medications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No medications recorded.</td>
              </tr>
            ) : (
              medications.map((med: any) => (
                <tr key={med.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-full">
                        <Pill size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span>{med.drug_name || med.name}</span>
                        {med.generic_name && <span className="text-xs text-gray-500 font-normal">{med.generic_name}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{med.dosage || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{med.frequency || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{med.duration || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      med.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {med.is_active !== false ? 'Active' : 'Stopped'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{med.prescribed_at ? new Date(med.prescribed_at).toLocaleDateString() : '—'}</td>
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
