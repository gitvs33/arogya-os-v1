import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';
import { encountersApi } from '../api/encounters';

export default function NewEncounter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [formData, setFormData] = useState({
    encounter_type: '',
    department: '',
    chief_complaint: '',
    scheduled_date: '',
  });
  const [error, setError] = useState('');

  // Enable query when searching or when we need to pre-select a patient
  const shouldFetch = Boolean(search.length > 0 || (preselectedPatientId && !initialLoadDone));

  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', search],
    queryFn: () => patientsApi.list({ search }),
    enabled: shouldFetch,
  });

  const patients = patientsData?.data || [];

  // Pre-select patient from URL parameter once patients are loaded
  useEffect(() => {
    if (preselectedPatientId && patients.length > 0 && !initialLoadDone) {
      const patient = patients.find((p) => String(p.id) === preselectedPatientId);
      if (patient) {
        setSelectedPatient(patient);
        setSearch(patient.name);
        setShowDropdown(false);
      }
      setInitialLoadDone(true);
    }
  }, [preselectedPatientId, patients, initialLoadDone]);

  const createMutation = useMutation({
    mutationFn: (data) => encountersApi.create(data),
    onSuccess: (response) => {
      navigate(`/encounters/${response.data.id}`);
    },
    onError: () => {
      setError('Failed to create encounter. Please try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPatient) {
      setError('Please select a patient.');
      return;
    }

    createMutation.mutate({
      patient_id: selectedPatient.id,
      ...formData,
    });
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSearch(patient.name);
    setShowDropdown(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Encounter</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        {/* Patient Search */}
        <div className="relative">
          <label htmlFor="patient-search" className="block text-sm font-medium text-gray-700 mb-1">
            Patient
          </label>
          <input
            id="patient-search"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedPatient(null);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by patient name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Search patient"
          />
          {showDropdown && search.length > 0 && patients.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handlePatientSelect(patient)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    selectedPatient?.id === patient.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {patient.name} - {patient.phone}
                </button>
              ))}
            </div>
          )}
          {selectedPatient && (
            <p className="mt-1 text-xs text-green-600">
              Selected: {selectedPatient.name}
            </p>
          )}
        </div>

        {/* Encounter Type */}
        <div>
          <label htmlFor="encounter-type" className="block text-sm font-medium text-gray-700 mb-1">
            Encounter Type
          </label>
          <select
            id="encounter-type"
            value={formData.encounter_type}
            onChange={(e) => handleFieldChange('encounter_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            required
          >
            <option value="">Select type...</option>
            <option value="OPD">OPD</option>
            <option value="IPD">IPD</option>
            <option value="EMERGENCY">EMERGENCY</option>
          </select>
        </div>

        {/* Department */}
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <input
            id="department"
            type="text"
            value={formData.department}
            onChange={(e) => handleFieldChange('department', e.target.value)}
            placeholder="e.g. General Medicine, Cardiology"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>

        {/* Chief Complaint */}
        <div>
          <label htmlFor="complaint" className="block text-sm font-medium text-gray-700 mb-1">
            Chief Complaint
          </label>
          <textarea
            id="complaint"
            value={formData.chief_complaint}
            onChange={(e) => handleFieldChange('chief_complaint', e.target.value)}
            rows={3}
            placeholder="Describe the patient's chief complaint..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
          />
        </div>

        {/* Scheduled Date */}
        <div>
          <label htmlFor="scheduled-date" className="block text-sm font-medium text-gray-700 mb-1">
            Scheduled Date
          </label>
          <input
            id="scheduled-date"
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => handleFieldChange('scheduled_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Encounter'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/encounters')}
            className="text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
