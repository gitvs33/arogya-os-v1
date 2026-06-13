import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { FileCode, Download, UploadCloud, File, FileImage } from 'lucide-react';

export default function PatientDocuments({ patientId }: { patientId: string }) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => patientsApi.getDocuments(patientId).then((res) => res.data).catch(() => []),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(documents) ? documents : (documents?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Documents</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <UploadCloud size={16} /> Upload
        </button>
      </div>
      
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-8">No documents uploaded.</div>
        ) : (
          list.map((doc: any, i: number) => (
            <div key={doc.id || i} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-gray-100 text-gray-500 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  {doc.file_type === 'pdf' ? <FileCode size={24} /> : 
                   doc.file_type === 'image' ? <FileImage size={24} /> : 
                   <File size={24} />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-bold text-gray-900 text-sm truncate">{doc.title || doc.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{doc.category || 'General'}</p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Today'}</span>
                <button className="text-[#0A6253] hover:text-teal-700 font-medium text-xs flex items-center gap-1">
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
