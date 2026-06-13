import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { FileText, Plus } from 'lucide-react';

export default function PatientNotes({ patientId }: { patientId: string }) {
  // Extract clinical notes from encounters
  const { data: encounters, isLoading } = useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: () => patientsApi.getEncounters(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = encounters || [];
  const notes = list.filter((e: any) => e.clinical_notes).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Clinical Notes</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <Plus size={16} /> Add Note
        </button>
      </div>
      
      <div className="p-6 space-y-6">
        {notes.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No clinical notes recorded.</div>
        ) : (
          notes.map((note: any) => (
            <div key={note.id} className="border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{note.encounter_type || 'OPD'} Consultation Note</h4>
                    <p className="text-sm text-gray-500 mt-0.5">By Dr. {note.doctor || 'Unassigned'} • {note.department}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-500">
                  {new Date(note.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-700 font-medium">
                {note.clinical_notes}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
