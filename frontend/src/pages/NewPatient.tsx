import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';
import client from '../api/client';
import { 
  User, Calendar, ChevronDown, Phone, FileText, ClipboardList, 
  HeartPulse, Search, ShieldCheck, ArrowLeft, ArrowRight, 
  Lightbulb, HeadphonesIcon, Bell, MessageSquare, HelpCircle 
} from 'lucide-react';

export default function NewPatient() {
  const { id } = useParams();
  const location = useLocation();
  const initialVisitType = location.state?.visitType || 'OPD Consultation';
  const isEditing = !!id;

  const [activeStep, setActiveStep] = useState(1);
  const [isVisitDropdownOpen, setIsVisitDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVisitDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: 'Male',
    bloodGroup: '',
    maritalStatus: '',
    nationality: 'Indian',
    aadhaar: '',
    pan: '',
    idType: '',
    idNumber: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    emergencyAltPhone: '',
    complaint: '',
    visitType: initialVisitType,
    department: '',
    referredBy: '',
    allergies: '',
    chronic: '',
    medications: ''
  });
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: patientData } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id).then(res => res.data),
    enabled: isEditing,
  });

  const { data: deptRes } = useQuery({
    queryKey: ['public-departments'],
    queryFn: () => client.get('/admin/departments/')
  });
  const departments = deptRes?.data?.results || deptRes?.data || [];

  useEffect(() => {
    if (patientData) {
      setFormData(prev => ({
        ...prev,
        fullName: patientData.full_name || `${patientData.first_name} ${patientData.last_name}`,
        dob: patientData.date_of_birth || '',
        gender: patientData.gender === 'M' ? 'Male' : patientData.gender === 'F' ? 'Female' : 'Other',
        bloodGroup: patientData.blood_group || '',
        maritalStatus: Object.keys(MARITAL_CODE).find(k => MARITAL_CODE[k] === patientData.marital_status) || patientData.marital_status || '',
        nationality: patientData.nationality || 'Indian',
        aadhaar: patientData.aadhaar_number || '',
        pan: patientData.pan_number || '',
        idType: Object.keys(ID_TYPE_CODE).find(k => ID_TYPE_CODE[k] === patientData.identification_type) || patientData.identification_type || '',
        idNumber: patientData.identification_number || '',
        emergencyName: patientData.emergency_contact_name || '',
        emergencyRelation: patientData.emergency_contact_relationship || '',
        emergencyPhone: patientData.emergency_contact_phone || '',
        emergencyAltPhone: patientData.emergency_contact_alternate_phone || '',
      }));
    }
  }, [patientData]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) {
        return patientsApi.update(id, data.patient).then(res => res.data);
      }
      return patientsApi.registerWithEncounter(data).then(res => res.data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
      navigate(`/patients/${isEditing ? id : data.patient.id}`);
    },
    onError: (err: any) => {
      console.error(err);
      alert(`Failed to ${isEditing ? 'update' : 'register'} patient: ` + (err.response?.data?.detail || err.message));
    }
  });

  // ── Map frontend visit types to backend enum values ────────────────
  const ENCOUNTER_TYPE_MAP: Record<string, string> = {
    'OPD Consultation': 'OPD',
    'Emergency': 'EMERGENCY',
    'Inpatient': 'IPD',
    'Telemedicine': 'TELEICU',
    'Home Care': 'HOME',
  };

  // ── Map frontend display values to backend codes ──────────────────
  const STATUS_CODE: Record<string, string> = { 'Draft': 'DRAFT', 'Completed': 'COMPLETED' };
  const MARITAL_CODE: Record<string, string> = { 'Single': 'SINGLE', 'Married': 'MARRIED', 'Divorced': 'DIVORCED', 'Widowed': 'WIDOWED', 'Other': 'OTHER' };
  const ID_TYPE_CODE: Record<string, string> = { 'Voter ID': 'VOTER_ID', 'Passport': 'PASSPORT', 'Aadhaar': 'AADHAAR', 'PAN': 'PAN', 'Driving License': 'DRIVING_LICENSE', 'Other': 'OTHER' };

  const handleSubmit = (status: 'Draft' | 'Completed') => {
    const parts = formData.fullName.trim().split(' ');
    const first_name = parts[0] || '';
    const last_name = parts.slice(1).join(' ') || '';

    const payload = {
      patient: {
        first_name,
        last_name,
        date_of_birth: formData.dob || undefined,
        gender: formData.gender ? formData.gender[0] : undefined,
        blood_group: formData.bloodGroup || undefined,
        marital_status: MARITAL_CODE[formData.maritalStatus] || formData.maritalStatus || undefined,
        nationality: formData.nationality || undefined,
        aadhaar_number: formData.aadhaar || undefined,
        pan_number: formData.pan || undefined,
        identification_type: ID_TYPE_CODE[formData.idType] || formData.idType || undefined,
        identification_number: formData.idNumber || undefined,
        emergency_contact_name: formData.emergencyName || undefined,
        emergency_contact_relationship: formData.emergencyRelation || undefined,
        emergency_contact_phone: formData.emergencyPhone || undefined,
        emergency_contact_alternate_phone: formData.emergencyAltPhone || undefined,
        registration_status: STATUS_CODE[status] || status
      },
      encounter: formData.complaint ? {
        chief_complaint: formData.complaint,
        encounter_type: ENCOUNTER_TYPE_MAP[formData.visitType] || 'OPD',
        department: formData.department || undefined,
        clinical_notes: `Allergies: ${formData.allergies}\nChronic: ${formData.chronic}\nMeds: ${formData.medications}`.trim()
      } : undefined
    };

    // Remove empty encounter if undefined, or if we are editing (no new encounter generated here)
    if (!payload.encounter || isEditing) delete payload.encounter;

    mutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Patient' : 'Patient Registration'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isEditing ? 'Update patient details' : 'Register a new patient to the system'}</p>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-3 relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsVisitDropdownOpen(!isVisitDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-[#0A6253] text-[#0A6253] bg-emerald-50 hover:bg-emerald-100 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <ClipboardList size={16} /> {formData.visitType} <ChevronDown size={16} className={`transition-transform ${isVisitDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isVisitDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                {['OPD Consultation', 'Emergency', 'Inpatient', 'Telemedicine', 'Home Care'].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, visitType: type }));
                      setIsVisitDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                      formData.visitType === type 
                        ? 'bg-emerald-50 text-[#0A6253]' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-[#0A6253]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── WIZARD PROGRESS BAR ── */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4 w-full">
          <StepIndicator num={1} label="Patient Details" active={activeStep === 1} completed={activeStep > 1} />
          <div className="flex-1 h-px bg-gray-200" />
          <StepIndicator num={2} label="Contact & Address" active={activeStep === 2} completed={activeStep > 2} />
          <div className="flex-1 h-px bg-gray-200" />
          <StepIndicator num={3} label="Additional Details" active={activeStep === 3} completed={activeStep > 3} />
          <div className="flex-1 h-px bg-gray-200" />
          <StepIndicator num={4} label="Insurance (Optional)" active={activeStep === 4} completed={activeStep > 4} />
          <div className="flex-1 h-px bg-gray-200" />
          <StepIndicator num={5} label="Review & Confirm" active={activeStep === 5} completed={activeStep > 5} />
        </div>
        <Link to={isEditing ? `/patients/${id}` : "/patients"} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 px-4 py-2 rounded-lg bg-white ml-8 flex-shrink-0">
          <ArrowLeft size={16} /> {isEditing ? 'Cancel Edit' : 'Back to Patients'}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT MAIN CONTENT (FORMS) ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Row 1: Basic Info & Emergency Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            
            {/* Basic Information Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                <User size={18} className="text-[#0A6253]" /> Basic Information
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputGroup label="Full Name" name="fullName" required icon={<User size={14} />} placeholder="Enter full name" value={formData.fullName} onChange={handleChange} />
                <InputGroup label="Date of Birth" name="dob" required type="date" value={formData.dob} onChange={handleChange} />
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Gender <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  <GenderOption label="Male" active={formData.gender === 'Male'} onClick={() => setFormData({...formData, gender: 'Male'})} />
                  <GenderOption label="Female" active={formData.gender === 'Female'} onClick={() => setFormData({...formData, gender: 'Female'})} />
                  <GenderOption label="Other" active={formData.gender === 'Other'} onClick={() => setFormData({...formData, gender: 'Other'})} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <SelectGroup label="Blood Group" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}>
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="O+">O+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                </SelectGroup>
                <SelectGroup label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange}>
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </SelectGroup>
                <SelectGroup label="Nationality" name="nationality" value={formData.nationality} onChange={handleChange}>
                  <option value="Indian">Indian</option>
                  <option value="Other">Other</option>
                </SelectGroup>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputGroup label="Aadhaar Number (Optional)" name="aadhaar" placeholder="Enter 12 digit Aadhaar number" value={formData.aadhaar} onChange={handleChange} />
                <InputGroup label="PAN (Optional)" name="pan" placeholder="Enter PAN number" value={formData.pan} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectGroup label="Identification Type" name="idType" value={formData.idType} onChange={handleChange}>
                  <option value="">Select ID type</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Passport">Passport</option>
                </SelectGroup>
                <InputGroup label="Identification Number" name="idNumber" placeholder="Enter ID number" value={formData.idNumber} onChange={handleChange} />
              </div>
            </div>

            {/* Emergency Contact Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Phone size={18} className="text-[#0A6253]" /> Emergency Contact
              </h2>
              
              <div className="flex-1 space-y-4">
                <InputGroup label="Contact Person Name" name="emergencyName" required icon={<User size={14} />} placeholder="Enter contact person name" value={formData.emergencyName} onChange={handleChange} />
                
                <SelectGroup label="Relationship" name="emergencyRelation" required value={formData.emergencyRelation} onChange={handleChange}>
                  <option value="">Select relationship</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Friend">Friend</option>
                </SelectGroup>

                <PhoneInputGroup label="Phone Number" name="emergencyPhone" required placeholder="Enter 10 digit mobile number" value={formData.emergencyPhone} onChange={handleChange} />
                <PhoneInputGroup label="Alternate Number (Optional)" name="emergencyAltPhone" placeholder="Enter alternate number" value={formData.emergencyAltPhone} onChange={handleChange} />
              </div>
            </div>

          </div>

          {/* Row 2: Clinical Info & Medical History (Hidden during edit since these belong to Encounters) */}
          {!isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              
              {/* Clinical Information */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                  <FileText size={18} className="text-[#0A6253]" /> Clinical Information
                </h2>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Primary Complaint <span className="text-red-500">*</span></label>
                    <textarea 
                      name="complaint" 
                      rows={3} 
                      placeholder="Enter patient's primary complaint" 
                      value={formData.complaint} 
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <SelectGroup label="Visit Type" name="visitType" required value={formData.visitType} onChange={handleChange}>
                      <option value="OPD Consultation">OPD Consultation</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Inpatient">Inpatient</option>
                      <option value="Telemedicine">Telemedicine</option>
                      <option value="Home Care">Home Care</option>
                    </SelectGroup>
                    <SelectGroup label="Department" name="department" required value={formData.department} onChange={handleChange}>
                      <option value="">Select department</option>
                      {departments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </SelectGroup>
                  </div>

                  <InputGroup label="Referred By (Optional)" name="referredBy" icon={<User size={14} />} placeholder="Enter doctor name" value={formData.referredBy} onChange={handleChange} />
                </div>
              </div>

              {/* Medical History */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                  <HeartPulse size={18} className="text-[#0A6253]" /> Recent Medical History <span className="text-gray-400 font-normal">(Optional)</span>
                </h2>
                
                <div className="flex-1 space-y-4 flex flex-col">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Known Allergies</label>
                    <textarea name="allergies" rows={2} placeholder="Enter known allergies (if any)" value={formData.allergies} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] resize-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Chronic Conditions</label>
                    <textarea name="chronic" rows={2} placeholder="Enter chronic conditions (if any)" value={formData.chronic} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] resize-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Current Medications</label>
                    <textarea name="medications" rows={2} placeholder="Enter current medications (if any)" value={formData.medications} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] resize-none" />
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Summary Card */}
          <div className="bg-[#F8FDFB] rounded-xl border border-emerald-100 p-6">
            <h2 className="text-sm font-bold text-[#0A6253] flex items-center gap-2 mb-4">
              <ClipboardList size={16} /> Registration Summary
            </h2>
            <div className="bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border border-emerald-50">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                <User size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-sm truncate">{formData.fullName || 'New Patient'}</h3>
                <p className="text-xs text-gray-500">{formData.visitType}</p>
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">
                Step 1 of 5
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-[#0A6253] hover:text-[#0A6253] group transition-colors shadow-sm">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-gray-400 group-hover:text-[#0A6253] transition-colors" /> Search Existing Patient
                </div>
                <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0A6253] transition-colors" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-[#0A6253] hover:text-[#0A6253] group transition-colors shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-gray-400 group-hover:text-[#0A6253] transition-colors" /> Verify Aadhaar (eKYC)
                </div>
                <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0A6253] transition-colors" />
              </button>
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-[#FFF9F2] border border-orange-100 rounded-xl p-5">
            <h3 className="font-bold text-orange-800 mb-3 text-sm flex items-center gap-2">
              <Lightbulb size={16} className="text-orange-500" /> Tips
            </h3>
            <ul className="text-xs text-orange-900/80 space-y-2 list-disc pl-4 marker:text-orange-300">
              <li>Fields marked with <span className="text-red-500 font-bold">*</span> are mandatory</li>
              <li>Aadhaar helps in faster verification</li>
              <li>You can add insurance details in next step</li>
            </ul>
          </div>

          {/* Support Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex items-center gap-4 mt-auto">
            <div className="w-10 h-10 bg-emerald-50 text-[#0A6253] rounded-full flex items-center justify-center">
              <HeadphonesIcon size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Need Help?</h4>
              <p className="text-[10px] text-gray-500 mt-0.5">Open support ticket or chat with our team</p>
            </div>
            <div className="ml-auto opacity-20">
              <ClipboardList size={32} className="text-[#0A6253]" />
            </div>
          </div>

        </div>

      </div>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="sticky bottom-[-24px] -mx-6 -mb-6 mt-8 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 px-8 flex justify-between items-center z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        <Link to="/patients" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
          Cancel
        </Link>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleSubmit('Draft')}
            disabled={mutation.isPending}
            className="px-6 py-2 border border-[#0A6253] text-[#0A6253] rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button 
            onClick={() => handleSubmit('Completed')}
            disabled={mutation.isPending}
            className="px-6 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#084d41] shadow-md disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : (isEditing ? 'Update Patient' : 'Register Patient')} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

// ── HELPER COMPONENTS ──

function StepIndicator({ num, label, active, completed }: any) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : completed ? 'opacity-70' : 'opacity-40 grayscale'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${active || completed ? 'bg-[#0A6253]' : 'bg-gray-400'}`}>
        {num}
      </div>
      <span className={`text-xs font-bold ${active ? 'text-[#0A6253]' : 'text-gray-600'}`}>{label}</span>
    </div>
  );
}

function InputGroup({ label, name, required, icon, placeholder, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        <input 
          type={type} 
          name={name} 
          required={required} 
          placeholder={placeholder} 
          value={value}
          onChange={onChange}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] transition-colors`}
        />
      </div>
    </div>
  );
}

function SelectGroup({ label, name, required, children, value, onChange }: any) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select 
          name={name}
          required={required}
          value={value}
          onChange={onChange}
          className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] transition-colors appearance-none"
        >
          {children}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

function PhoneInputGroup({ label, name, required, placeholder, value, onChange }: any) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex bg-gray-50 border border-gray-200 rounded-lg focus-within:bg-white focus-within:border-[#0A6253] focus-within:ring-1 focus-within:ring-[#0A6253] overflow-hidden transition-colors">
        <div className="flex items-center gap-1 pl-3 pr-2 border-r border-gray-200 bg-white">
          <User size={14} className="text-emerald-600" />
          <span className="text-sm font-medium text-gray-600">+91 <ChevronDown size={12} className="inline ml-1 opacity-50" /></span>
        </div>
        <input 
          type="tel" 
          name={name}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full px-3 py-2 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}

function GenderOption({ label, active, onClick }: any) {
  return (
    <button 
      type="button" 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2 border rounded-lg text-sm font-semibold transition-colors ${
        active ? 'border-[#0A6253] bg-emerald-50 text-[#0A6253]' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      <User size={14} className={active ? 'text-[#0A6253]' : 'text-gray-400'} /> {label}
    </button>
  );
}
