import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encountersApi } from '../api/encounters';

export default function EncounterDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [error, setError] = useState('');

  // Vitals form state
  const [vitals, setVitals] = useState({
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    SpO2: '',
  });

  // Medication form state
  const [medication, setMedication] = useState({
    drug_name: '',
    dosage: '',
    frequency: '',
    duration: '',
  });

  // Complete encounter state
  const [completion, setCompletion] = useState({
    diagnosis: '',
    notes: '',
  });

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['encounter', id],
    queryFn: () => encountersApi.get(id),
    enabled: !!id,
  });

  const encounter = data?.data;

  const addVitalsMutation = useMutation({
    mutationFn: (vitalsData) => encountersApi.addVitals(id, vitalsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowVitalsForm(false);
      setVitals({ systolic_bp: '', diastolic_bp: '', heart_rate: '', temperature: '', SpO2: '' });
    },
    onError: () => setError('Failed to save vitals.'),
  });

  const addMedicationMutation = useMutation({
    mutationFn: (medData) => encountersApi.addMedication(id, medData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowMedicationForm(false);
      setMedication({ drug_name: '', dosage: '', frequency: '', duration: '' });
    },
    onError: () => setError('Failed to add medication.'),
  });

  const completeMutation = useMutation({
    mutationFn: (completeData) => encountersApi.complete(id, completeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowCompleteForm(false);
    },
    onError: () => setError('Failed to complete encounter.'),
  });

  const handleVitalsSubmit = (e) => {
    e.preventDefault();
    addVitalsMutation.mutate({
      systolic_bp: Number(vitals.systolic_bp),
      diastolic_bp: Number(vitals.diastolic_bp),
      heart_rate: Number(vitals.heart_rate),
      temperature: Number(vitals.temperature),
      SpO2: Number(vitals.SpO2),
    });
  };

  const handleMedicationSubmit = (e) => {
    e.preventDefault();
    addMedicationMutation.mutate(medication);
  };

  const handleCompleteSubmit = (e) => {
    e.preventDefault();
    completeMutation.mutate(completion);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Loading encounter...</div>
      </div>
    );
  }

  if (fetchError || !encounter) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        Error loading encounter. Please try again.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{encounter.patient_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {encounter.encounter_type} · {encounter.doctor} · {encounter.department}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            encounter.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : encounter.status === 'in-progress'
              ? 'bg-blue-100 text-blue-700'
              : encounter.status === 'pending'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {encounter.status}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Encounter Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Encounter Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Date:</span>
            <span className="ml-2 text-gray-900">{encounter.scheduled_date}</span>
          </div>
          <div>
            <span className="text-gray-500">Chief Complaint:</span>
            <span className="ml-2 text-gray-900">{encounter.chief_complaint}</span>
          </div>
        </div>
      </div>

      {/* Vitals Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Vitals</h2>
          <button
            onClick={() => setShowVitalsForm(!showVitalsForm)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showVitalsForm ? 'Cancel' : '+ Add Vitals'}
          </button>
        </div>

        {showVitalsForm && (
          <form onSubmit={handleVitalsSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div>
                <label htmlFor="systolic" className="block text-xs font-medium text-gray-600 mb-1">Systolic BP</label>
                <input id="systolic" type="number" value={vitals.systolic_bp}
                  onChange={(e) => setVitals((p) => ({ ...p, systolic_bp: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="diastolic" className="block text-xs font-medium text-gray-600 mb-1">Diastolic BP</label>
                <input id="diastolic" type="number" value={vitals.diastolic_bp}
                  onChange={(e) => setVitals((p) => ({ ...p, diastolic_bp: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="heart-rate" className="block text-xs font-medium text-gray-600 mb-1">Heart Rate</label>
                <input id="heart-rate" type="number" value={vitals.heart_rate}
                  onChange={(e) => setVitals((p) => ({ ...p, heart_rate: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="temperature" className="block text-xs font-medium text-gray-600 mb-1">Temperature</label>
                <input id="temperature" type="number" step="0.1" value={vitals.temperature}
                  onChange={(e) => setVitals((p) => ({ ...p, temperature: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="spo2" className="block text-xs font-medium text-gray-600 mb-1">SpO2</label>
                <input id="spo2" type="number" value={vitals.SpO2}
                  onChange={(e) => setVitals((p) => ({ ...p, SpO2: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={addVitalsMutation.isPending}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {addVitalsMutation.isPending ? 'Saving...' : 'Save Vitals'}
            </button>
          </form>
        )}

        {/* Vitals Table */}
        {encounter.vitals && encounter.vitals.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">BP</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Heart Rate</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Temp</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">SpO2</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {encounter.vitals.map((v) => (
                <tr key={v.id} className="border-b border-gray-100">
                  <td className="px-3 py-2">{v.systolic_bp}/{v.diastolic_bp}</td>
                  <td className="px-3 py-2">{v.heart_rate} bpm</td>
                  <td className="px-3 py-2">{v.temperature}°F</td>
                  <td className="px-3 py-2">{v.SpO2}%</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(v.recorded_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No vitals recorded yet.</p>
        )}
      </div>

      {/* Medications Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Medications</h2>
          <button
            onClick={() => setShowMedicationForm(!showMedicationForm)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showMedicationForm ? 'Cancel' : '+ Add Medication'}
          </button>
        </div>

        {showMedicationForm && (
          <form onSubmit={handleMedicationSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label htmlFor="drug-name" className="block text-xs font-medium text-gray-600 mb-1">Drug Name</label>
                <input id="drug-name" type="text" value={medication.drug_name}
                  onChange={(e) => setMedication((p) => ({ ...p, drug_name: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="dosage" className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                <input id="dosage" type="text" value={medication.dosage}
                  onChange={(e) => setMedication((p) => ({ ...p, dosage: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="frequency" className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <input id="frequency" type="text" value={medication.frequency}
                  onChange={(e) => setMedication((p) => ({ ...p, frequency: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label htmlFor="duration" className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                <input id="duration" type="text" value={medication.duration}
                  onChange={(e) => setMedication((p) => ({ ...p, duration: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={addMedicationMutation.isPending}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {addMedicationMutation.isPending ? 'Adding...' : 'Add Medication'}
            </button>
          </form>
        )}

        {/* Medications Table */}
        {encounter.medications && encounter.medications.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Drug</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Dosage</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Duration</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {encounter.medications.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{m.drug_name}</td>
                  <td className="px-3 py-2 text-gray-600">{m.dosage}</td>
                  <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                  <td className="px-3 py-2 text-gray-600">{m.duration}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No medications prescribed yet.</p>
        )}
      </div>

      {/* Complete Encounter Section */}
      {encounter.status !== 'completed' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {!showCompleteForm ? (
            <button
              onClick={() => setShowCompleteForm(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              Complete Encounter
            </button>
          ) : (
            <form onSubmit={handleCompleteSubmit}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Complete Encounter</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <textarea id="diagnosis" rows={3} value={completion.diagnosis}
                    onChange={(e) => setCompletion((p) => ({ ...p, diagnosis: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                    placeholder="Enter diagnosis..." />
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea id="notes" rows={3} value={completion.notes}
                    onChange={(e) => setCompletion((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                    placeholder="Additional notes..." />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={completeMutation.isPending}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50">
                    {completeMutation.isPending ? 'Completing...' : 'Confirm Complete'}
                  </button>
                  <button type="button" onClick={() => setShowCompleteForm(false)}
                    className="text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
