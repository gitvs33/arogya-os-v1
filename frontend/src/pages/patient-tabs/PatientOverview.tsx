import React from 'react';
import { 
  User, HelpCircle, LayoutGrid, FileText, Edit, Activity, Heart, Droplet, 
  Thermometer, Wind, Scale, Stethoscope, FlaskConical, Pill, ChevronDown, 
  Plus, ShieldAlert, MoreVertical
} from 'lucide-react';

export default function PatientOverview({ 
  patient, 
  latestVitals, 
  activeMedications, 
  activeDiagnoses, 
  timelineEvents,
  mockRiskIndicators,
  mockOrders,
  mockAllergies
}: any) {
  return (
    <div className="grid grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN (Snapshot, Vitals, Risks) */}
      <div className="col-span-3 flex flex-col gap-6">
        
        {/* Patient Snapshot */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Patient Snapshot</h3>
            <button className="text-xs text-[#0A6253] font-semibold flex items-center gap-1 hover:underline"><Edit size={12} /> Edit</button>
          </div>
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-3">
              <span className="text-gray-500 flex items-center gap-2"><User size={14} /> Age / DOB</span>
              <span className="col-span-2 font-medium text-gray-900">{patient.age || '45'} Y / {new Date(patient.date_of_birth || '1980-08-12').toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500 flex items-center gap-2"><User size={14} /> Gender</span>
              <span className="col-span-2 font-medium text-gray-900">{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500 flex items-center gap-2"><HelpCircle size={14} /> Phone</span>
              <span className="col-span-2 font-medium text-gray-900">{patient.phone || '+91 98765 43210'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500 flex items-center gap-2"><LayoutGrid size={14} /> Address</span>
              <span className="col-span-2 font-medium text-gray-900">{[patient.address, patient.city, patient.state].filter(Boolean).join(', ') || 'B-302, Green Park, Delhi, India'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500 flex items-center gap-2"><FileText size={14} /> Insurance</span>
              <div className="col-span-2 flex flex-col">
                <span className="font-medium text-gray-900">{patient.insurance_provider || 'Care Health TPA'}</span>
                <span className="text-xs text-gray-500">TPA ID: {patient.insurance_id || '1234567890'}</span>
              </div>
            </div>
          </div>
          <button className="w-full text-center text-xs font-semibold text-[#0A6253] mt-4 hover:underline">View More ⌄</button>
        </div>

        {/* Vital Signs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Vital Signs (Latest)</h3>
            <span className="text-xs text-gray-500">{latestVitals ? new Date(latestVitals.recorded_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No vitals recorded'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <div className="text-red-500 mb-1"><Activity size={16} /></div>
              <span className="text-xs text-gray-500">BP</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.blood_pressure || '--'}</span>
              <span className="text-[10px] text-gray-400">mmHg</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-orange-500 mb-1"><Heart size={16} /></div>
              <span className="text-xs text-gray-500">HR</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.heart_rate || '--'}</span>
              <span className="text-[10px] text-gray-400">bpm</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-blue-500 mb-1"><Droplet size={16} /></div>
              <span className="text-xs text-gray-500">SpO₂</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.oxygen_saturation || '--'}</span>
              <span className="text-[10px] text-gray-400">%</span>
            </div>
            <div className="flex flex-col items-center mt-2">
              <div className="text-pink-500 mb-1"><Thermometer size={16} /></div>
              <span className="text-xs text-gray-500">Temp.</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.temperature || '--'}</span>
              <span className="text-[10px] text-gray-400">°F</span>
            </div>
            <div className="flex flex-col items-center mt-2">
              <div className="text-emerald-500 mb-1"><Wind size={16} /></div>
              <span className="text-xs text-gray-500">RR</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.respiratory_rate || '--'}</span>
              <span className="text-[10px] text-gray-400">/min</span>
            </div>
            <div className="flex flex-col items-center mt-2">
              <div className="text-yellow-600 mb-1"><Scale size={16} /></div>
              <span className="text-xs text-gray-500">Weight</span>
              <span className="font-bold text-gray-900 text-lg">{latestVitals?.weight || '--'}</span>
              <span className="text-[10px] text-gray-400">kg</span>
            </div>
          </div>
        </div>

        {/* Risk Indicators */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Risk Indicators</h3>
            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-red-100">High Risk</span>
          </div>
          <div className="flex flex-col gap-3">
            {mockRiskIndicators.map((risk: any, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 text-red-500"><Heart size={16} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">{risk.condition}</span>
                  <span className="text-xs text-gray-500">{risk.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MIDDLE COLUMN (Timeline) */}
      <div className="col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-900">Clinical Timeline</h3>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            All Events <ChevronDown size={14} />
          </button>
        </div>

        <div className="relative border-l-2 border-gray-100 ml-[80px] pl-6 pb-4 space-y-8">
          {timelineEvents.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">No events found.</div>
          ) : (
            timelineEvents.slice(0, 10).map((ev: any, i: number) => (
              <div key={i} className="relative">
                <div className={`absolute -left-[35px] w-8 h-8 rounded-full bg-${ev.color}-50 border-2 border-white flex items-center justify-center text-${ev.color}-600`}>
                  {ev.icon === 'Activity' && <Activity size={14} />}
                  {ev.icon === 'Heart' && <Heart size={14} />}
                  {ev.icon === 'Stethoscope' && <Stethoscope size={14} />}
                  {ev.icon === 'FlaskConical' && <FlaskConical size={14} />}
                  {ev.icon === 'Pill' && <Pill size={14} />}
                </div>
                <div className="absolute -left-[95px] top-1 text-xs font-medium text-gray-500">
                  {ev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                {(i === 0 || timelineEvents[i-1].time.toDateString() !== ev.time.toDateString()) && (
                  <div className="absolute -top-[24px] left-[-4px] bg-white text-xs font-bold text-gray-900 px-2 py-1">
                    {ev.time.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                <div className="flex justify-between items-start mt-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{ev.title}</h4>
                    <p className="text-xs text-gray-600 mt-1">{ev.subtitle}</p>
                    {ev.desc && <p className="text-xs text-gray-500 mt-1 max-w-sm truncate">{ev.desc}</p>}
                  </div>
                  <button className="text-xs text-[#0A6253] font-semibold hover:underline">View</button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {timelineEvents.length > 10 && (
          <div className="w-full flex justify-center mt-6">
            <button className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 px-6 py-2 rounded-full hover:bg-gray-50 transition-colors shadow-sm">Load more</button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN (Diagnoses, Meds, Orders, Allergies) */}
      <div className="col-span-4 flex flex-col gap-6">
        
        {/* Active Diagnoses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Active Diagnoses</h3>
            <button className="text-xs text-[#0A6253] font-semibold flex items-center gap-1 hover:underline"><Plus size={12} /> Add</button>
          </div>
          <div className="flex flex-col gap-3">
            {activeDiagnoses.length === 0 ? <span className="text-xs text-gray-500">No active diagnoses.</span> : activeDiagnoses.slice(0, 3).map((diag: any, i: number) => (
              <div key={i} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-mono">{diag.code}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{diag.name}</p>
                  <p className="text-xs text-[#0A6253] mt-1 font-medium">{diag.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Medications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Active Medications</h3>
            <button className="text-xs text-[#0A6253] font-semibold hover:underline">View all</button>
          </div>
          <div className="flex flex-col gap-3">
            {activeMedications.length === 0 ? <span className="text-xs text-gray-500">No active medications.</span> : activeMedications.slice(0, 4).map((med: any, i: number) => (
              <div key={i} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="mt-0.5 text-blue-500 bg-blue-50 p-1.5 rounded-full"><Pill size={14} /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{med.drug_name || med.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{med.dosage || 'Standard'} • {med.frequency || 'As directed'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Ongoing</span>
                  <button className="text-gray-400 hover:text-gray-700"><MoreVertical size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Recent Orders</h3>
            <button className="text-xs text-[#0A6253] font-semibold hover:underline">View all</button>
          </div>
          <div className="flex flex-col gap-2">
            {mockOrders.length === 0 ? <span className="text-xs text-gray-500">No orders.</span> : mockOrders.slice(0, 4).map((order: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-900">{order.order_name || order.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">{new Date(order.ordered_at || order.date).toLocaleDateString()}</span>
                  <span className="text-xs font-semibold text-emerald-600 w-16 text-right">{order.status || 'Completed'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Allergies</h3>
            <button className="text-xs text-[#0A6253] font-semibold flex items-center gap-1 hover:underline"><Plus size={12} /> Add</button>
          </div>
          <div className="flex flex-col gap-2">
            {mockAllergies.length === 0 ? <span className="text-xs text-gray-500">No known allergies.</span> : mockAllergies.map((allergy: any, i: number) => (
              <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                <div className="text-red-500 mt-0.5"><ShieldAlert size={16} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{allergy.allergen}</span>
                  <span className="text-xs text-gray-600 mt-0.5">{allergy.reaction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
