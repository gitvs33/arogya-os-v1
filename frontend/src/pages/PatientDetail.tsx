import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { patientsApi } from '../api/patients';
import { encountersApi } from '../api/encounters';
import { 
  User, Search, Bell, MessageSquare, HelpCircle, MoreVertical, Plus, 
  Edit, Activity, Heart, Droplet, Thermometer, Wind, Scale, 
  Stethoscope, FileText, FlaskConical, Pill, Calendar, Video, ShieldAlert,
  ChevronDown, LayoutGrid
} from 'lucide-react';

import PatientOverview from './patient-tabs/PatientOverview';
import PatientTimeline from './patient-tabs/PatientTimeline';
import PatientDiagnoses from './patient-tabs/PatientDiagnoses';
import PatientMedications from './patient-tabs/PatientMedications';
import PatientOrders from './patient-tabs/PatientOrders';
import PatientLabResults from './patient-tabs/PatientLabResults';
import PatientImaging from './patient-tabs/PatientImaging';
import PatientBilling from './patient-tabs/PatientBilling';
import PatientNotes from './patient-tabs/PatientNotes';
import PatientDocuments from './patient-tabs/PatientDocuments';
import PatientCarePlan from './patient-tabs/PatientCarePlan';

export default function PatientDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  const [showNewEncounterModal, setShowNewEncounterModal] = useState(false);
  const [newEncounterForm, setNewEncounterForm] = useState({ visitType: 'OPD', department: '', complaint: '' });

  // Real Data
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id).then((res) => res.data),
  });

  const { data: encounters, refetch: refetchEncounters } = useQuery({
    queryKey: ['patient-encounters', id],
    queryFn: () => patientsApi.getEncounters(id).then((res) => res.data),
  });

  const createEncounterMutation = useMutation({
    mutationFn: (data: any) => encountersApi.create(data).then(res => res.data),
    onSuccess: () => {
      refetchEncounters();
      setShowNewEncounterModal(false);
      setNewEncounterForm({ visitType: 'OPD', department: '', complaint: '' });
    },
    onError: (err: any) => {
      alert("Failed to create encounter: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleCreateEncounter = (e: React.FormEvent) => {
    e.preventDefault();
    createEncounterMutation.mutate({
      patient: id,
      encounter_type: newEncounterForm.visitType,
      department: newEncounterForm.department,
      chief_complaint: newEncounterForm.complaint,
    });
  };

  // Since the backend doesn't have these models yet (as per gap analysis), 
  // we mock them to match the visual design perfectly.
  const mockAllergies: any[] = [];
  const mockRiskIndicators: any[] = [];
  const mockDiagnoses: any[] = [];
  const mockMedications: any[] = [];
  const mockOrders: any[] = [];

  // Extract all data from encounters to build the timeline and widgets
  const allEncounters = encounters || [];
  
  // Latest Vitals
  const allVitals = allEncounters.flatMap((e: any) => e.vitals || []);
  allVitals.sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  const latestVitals = allVitals[0];

  // Active Medications
  const activeMedications = allEncounters.flatMap((e: any) => e.medications || []).filter((m: any) => m.is_active !== false);

  // Active Diagnoses (from encounter text fields for now)
  const activeDiagnoses = allEncounters
    .filter((e: any) => e.diagnosis)
    .map((e: any) => ({ name: e.diagnosis, code: 'Clinical', duration: new Date(e.created_at).toLocaleDateString() }));

  // Build Unified Timeline
  const timelineEvents: any[] = [];
  allEncounters.forEach((e: any) => {
    timelineEvents.push({
      type: 'ENCOUNTER',
      time: new Date(e.created_at),
      title: `${e.encounter_type || 'OPD'} Consultation`,
      subtitle: `${e.doctor || 'Unassigned'} (${e.department || 'General'})`,
      desc: e.chief_complaint || 'Routine checkup',
      icon: 'Stethoscope',
      color: 'emerald'
    });
    
    if (e.vitals && e.vitals.length > 0) {
      e.vitals.forEach((v: any) => {
        timelineEvents.push({
          type: 'VITALS',
          time: new Date(v.recorded_at),
          title: 'Vitals Recorded',
          subtitle: `BP: ${v.blood_pressure || '-'}, HR: ${v.heart_rate || '-'}, SpO₂: ${v.oxygen_saturation || '-'}%, Temp: ${v.temperature || '-'}`,
          icon: 'Activity',
          color: 'blue'
        });
      });
    }

    if (e.medications && e.medications.length > 0) {
      const medNames = e.medications.map((m: any) => m.name).join(', ');
      timelineEvents.push({
        type: 'MEDICATION',
        time: new Date(e.created_at), // Assuming prescribed at encounter time
        title: 'Medication Prescribed',
        subtitle: medNames,
        icon: 'Pill',
        color: 'purple'
      });
    }
  });

  timelineEvents.sort((a, b) => b.time.getTime() - a.time.getTime());

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  if (!patient) return null;

  return (
    <div className="flex flex-col gap-6 min-h-screen pb-10">
      
      {/* ── TOP NAV / BREADCRUMB AREA ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/encounters" className="text-gray-500 hover:text-gray-900 font-semibold">EMR</Link>
          <span className="text-gray-400">&gt;</span>
          <span className="text-gray-900 font-medium">Patient Summary</span>
        </div>
        
        {/* Search Bar - Moved to Layout usually, but mock here based on design */}
        <div className="flex-1 max-w-xl mx-8 relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by patient name, MRN, encounter ID..." 
            className="w-full pl-9 pr-12 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
          <div className="absolute right-3 top-2.5 text-xs text-gray-400 border border-gray-200 rounded px-1">Ctrl + K</div>
        </div>
      </div>

      {/* ── HEADER CARD ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            {patient.profile_picture ? (
              <img src={patient.profile_picture} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-2xl">
                {patient.first_name?.[0] || 'P'}
              </div>
            )}
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{patient.full_name || `${patient.first_name} ${patient.last_name}`}</h1>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span>MRN: <span className="font-semibold text-gray-900">{patient.hospital_patient_id || 'N/A'}</span></span>
                <span className="text-gray-300">•</span>
                <span>{patient.age || '45'} Y / {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</span>
              </div>
              
              <div className="flex items-center gap-4 mt-2">
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{patient.blood_group || 'A+'} Blood Group</span>
                {mockAllergies.length > 0 && (
                  <span className="flex items-center gap-1 text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded text-xs font-medium">
                    <ShieldAlert size={12} /> {mockAllergies.length} Allergies
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-12">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Phone</span>
              <span className="text-sm font-semibold text-gray-900 mt-1">{patient.phone || '+91 98765 43210'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Visit Type</span>
              <span className="text-sm font-semibold text-gray-900 mt-1">OPD Consultation</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Doctor</span>
              <span className="text-sm font-semibold text-gray-900 mt-1">Dr. Ananya Rao</span>
              <span className="text-xs text-gray-500">Cardiology</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Encounter ID</span>
              <span className="text-sm font-semibold text-gray-900 mt-1">ENC-2026-0620-00145</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Date & Time</span>
              <span className="text-sm font-semibold text-gray-900 mt-1">20 Jun 2026, 10:24 AM</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Link 
                to={`/patients/${id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit size={16} /> Edit Patient
              </Link>
              <button 
                onClick={() => setShowNewEncounterModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#0A6253] text-[#0A6253] rounded-lg text-sm font-semibold hover:bg-teal-50"
              >
                <Plus size={16} /> New Encounter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="border-b border-gray-200 flex gap-8">
        {['Overview', 'Timeline', 'Clinical Notes', 'Diagnoses', 'Medications', 'Orders', 'Lab Results', 'Imaging', 'Documents', 'Billing', 'Care Plan'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`pb-3 text-sm font-medium ${activeTab === tab.toLowerCase() ? 'text-[#0A6253] border-b-2 border-[#0A6253]' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="mt-2">
        {activeTab === 'overview' && (
          <PatientOverview 
            patient={patient}
            latestVitals={latestVitals}
            activeMedications={activeMedications}
            activeDiagnoses={activeDiagnoses}
            timelineEvents={timelineEvents}
            mockRiskIndicators={mockRiskIndicators}
            mockOrders={mockOrders}
            mockAllergies={mockAllergies}
          />
        )}
        {activeTab === 'timeline' && <PatientTimeline patientId={id!} />}
        {activeTab === 'clinical notes' && <PatientNotes patientId={id!} />}
        {activeTab === 'diagnoses' && <PatientDiagnoses patientId={id!} />}
        {activeTab === 'medications' && <PatientMedications patientId={id!} />}
        {activeTab === 'orders' && <PatientOrders patientId={id!} />}
        {activeTab === 'lab results' && <PatientLabResults patientId={id!} />}
        {activeTab === 'imaging' && <PatientImaging patientId={id!} />}
        {activeTab === 'documents' && <PatientDocuments patientId={id!} />}
        {activeTab === 'billing' && <PatientBilling patientId={id!} />}
        {activeTab === 'care plan' && <PatientCarePlan patientId={id!} />}
      </div>

      {showNewEncounterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Encounter</h2>
              <button onClick={() => setShowNewEncounterModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateEncounter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Visit Type</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253]"
                  value={newEncounterForm.visitType}
                  onChange={e => setNewEncounterForm({...newEncounterForm, visitType: e.target.value})}
                  required
                >
                  <option value="OPD">OPD Consultation</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="IPD">Inpatient</option>
                  <option value="TELEICU">Telemedicine (TeleICU)</option>
                  <option value="HOME">Home Care</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253]"
                  value={newEncounterForm.department}
                  onChange={e => setNewEncounterForm({...newEncounterForm, department: e.target.value})}
                  required
                >
                  <option value="">Select department</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Neurology">Neurology</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Chief Complaint</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] resize-none"
                  rows={3}
                  value={newEncounterForm.complaint}
                  onChange={e => setNewEncounterForm({...newEncounterForm, complaint: e.target.value})}
                  required
                  placeholder="E.g., Chest pain, fever..."
                ></textarea>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewEncounterModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createEncounterMutation.isPending}
                  className="px-4 py-2 bg-[#0A6253] text-white text-sm font-semibold rounded-lg hover:bg-[#084d41] disabled:opacity-50"
                >
                  {createEncounterMutation.isPending ? 'Saving...' : 'Create Encounter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
