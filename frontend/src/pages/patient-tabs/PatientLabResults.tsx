import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { FlaskConical, Download } from 'lucide-react';

export default function PatientLabResults({ patientId }: { patientId: string }) {
  const { data: labs, isLoading } = useQuery({
    queryKey: ['patient-labs', patientId],
    queryFn: () => patientsApi.getLabResults(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(labs) ? labs : (labs?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Lab Results</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Test Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Result</th>
              <th className="px-6 py-4">Ref. Range</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Resulted At</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No lab results found.</td>
              </tr>
            ) : (
              list.map((lab: any) => {
                const isAbnormal = lab.result_value && lab.reference_range && 
                  (parseFloat(lab.result_value) < parseFloat(lab.reference_range.split('-')[0]) || 
                   parseFloat(lab.result_value) > parseFloat(lab.reference_range.split('-')[1]));
                
                return (
                  <tr key={lab.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      <div className="flex items-center gap-2">
                        <FlaskConical size={16} className="text-yellow-600" />
                        {lab.test_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{lab.category}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
                        {lab.result_value || '—'} {lab.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{lab.reference_range || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        lab.status === 'FINAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{lab.resulted_at ? new Date(lab.resulted_at).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#0A6253] hover:text-teal-700 font-medium text-xs flex items-center gap-1 justify-end w-full">
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
