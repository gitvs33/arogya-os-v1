import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { Image as ImageIcon, Download } from 'lucide-react';

export default function PatientImaging({ patientId }: { patientId: string }) {
  const { data: imaging, isLoading } = useQuery({
    queryKey: ['patient-imaging', patientId],
    queryFn: () => patientsApi.getImaging(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(imaging) ? imaging : (imaging?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Imaging Results</h3>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {list.length === 0 ? (
          <div className="col-span-2 text-center text-gray-500 py-8">No imaging results found.</div>
        ) : (
          list.map((img: any) => (
            <div key={img.id} className="border border-gray-200 rounded-lg p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{img.title}</h4>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-0.5">{img.modality}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  img.status === 'FINAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {img.status}
                </span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Impression:</p>
                <p className="text-gray-600 line-clamp-3">{img.impression || 'No impression recorded.'}</p>
              </div>

              <div className="flex justify-between items-center mt-2 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">Resulted: {img.resulted_at ? new Date(img.resulted_at).toLocaleDateString() : '—'}</span>
                <button className="text-[#0A6253] hover:text-teal-700 font-medium text-xs flex items-center gap-1">
                  <Download size={14} /> View Report
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
