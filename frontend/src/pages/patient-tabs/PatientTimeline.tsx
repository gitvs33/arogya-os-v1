import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { 
  Activity, Heart, Stethoscope, FlaskConical, Pill, Image, FileText, Calendar
} from 'lucide-react';

export default function PatientTimeline({ patientId }: { patientId: string }) {
  const { data: timelineEvents, isLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () => patientsApi.getTimeline(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const events = Array.isArray(timelineEvents) 
    ? timelineEvents 
    : (timelineEvents?.results || timelineEvents?.data || timelineEvents?.events || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-gray-900">Unified Clinical Timeline</h3>
        <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white">
          <option>All Events</option>
          <option>Encounters</option>
          <option>Vitals</option>
          <option>Lab Results</option>
          <option>Medications</option>
        </select>
      </div>

      <div className="relative border-l-2 border-gray-100 ml-[120px] pl-8 pb-4 space-y-10">
        {events.length === 0 ? (
          <div className="text-gray-500 text-sm py-4">No events found in timeline.</div>
        ) : (
          events.map((ev: any, i: number) => {
            const dateObj = new Date(ev.timestamp);
            const isNewDay = i === 0 || new Date(events[i-1].timestamp).toDateString() !== dateObj.toDateString();
            
            let Icon = Activity;
            let color = 'blue';
            
            switch(ev.type?.toLowerCase()) {
              case 'encounter': Icon = Stethoscope; color = 'emerald'; break;
              case 'vitals': Icon = Heart; color = 'red'; break;
              case 'lab': Icon = FlaskConical; color = 'yellow'; break;
              case 'medication': Icon = Pill; color = 'purple'; break;
              case 'imaging': Icon = Image; color = 'orange'; break;
              case 'diagnosis': Icon = FileText; color = 'blue'; break;
              default: Icon = Calendar; color = 'gray'; break;
            }

            return (
              <div key={ev.id || i} className="relative">
                <div className={`absolute -left-[41px] w-10 h-10 rounded-full bg-${color}-50 border-4 border-white flex items-center justify-center text-${color}-600 shadow-sm z-10`}>
                  <Icon size={16} />
                </div>
                
                <div className="absolute -left-[140px] top-1 text-sm font-semibold text-gray-700 w-[80px] text-right">
                  {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                {isNewDay && (
                  <div className="absolute -top-[30px] left-[-4px] bg-white text-sm font-bold text-gray-900 px-2 py-1">
                    {dateObj.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-5 ml-2 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-${color}-100 text-${color}-700 mb-2`}>
                        {ev.type}
                      </span>
                      <h4 className="text-base font-bold text-gray-900">{ev.title}</h4>
                      {ev.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{ev.description}</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
