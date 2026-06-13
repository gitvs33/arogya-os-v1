import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { CheckCircle2, Circle, Clock, Plus } from 'lucide-react';

export default function PatientCarePlan({ patientId }: { patientId: string }) {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['patient-care-plans', patientId],
    queryFn: () => patientsApi.getCarePlans(patientId).then((res) => res.data).catch(() => []),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(plans) ? plans : (plans?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Care Plan</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <Plus size={16} /> Create Plan
        </button>
      </div>
      
      <div className="p-6 space-y-6">
        {list.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No active care plans.</div>
        ) : (
          list.map((plan: any, i: number) => (
            <div key={plan.id || i} className="border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">{plan.title || plan.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  plan.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {plan.status || 'Active'}
                </span>
              </div>
              
              <div className="space-y-4">
                <h5 className="text-sm font-semibold text-gray-900">Goals & Tasks</h5>
                {(plan.tasks || []).map((task: any, j: number) => (
                  <div key={j} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    {task.completed ? (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : (
                      <Circle size={20} className="text-gray-300" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</p>
                      {task.due_date && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock size={12} /> Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {(!plan.tasks || plan.tasks.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No specific tasks defined.</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
