import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encountersApi } from '../api/encounters';
import { ddiApi } from '../api/ddi';
import { labCatalogApi } from '../api/lab/catalogApi';
import DrugAutocomplete from '../components/DrugAutocomplete';
import LabPanelSelector from '../components/LabPanelSelector';
import DDIWarningModal from '../components/DDIWarningModal';
import CareScribeModal from '../components/CareScribeModal';

export default function EncounterDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [error, setError] = useState('');
  const [ddiInteractions, setDdiInteractions] = useState(null);
  const [ddiLoading, setDdiLoading] = useState(false);
  const [ddiMedicationData, setDdiMedicationData] = useState(null);
  const [drugDdiMap, setDrugDdiMap] = useState({});
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'timeline' | 'lab' | 'billing'
  const [showCareScribe, setShowCareScribe] = useState(false);

  // Lab order form state
  const [showLabOrderForm, setShowLabOrderForm] = useState(false);
  const [labPanelId, setLabPanelId] = useState('');
  const [labPriority, setLabPriority] = useState('ROUTINE');

  // Billing accrual
  const [accrued, setAccrued] = useState(null);
  const [showBilling, setShowBilling] = useState(false);

  // Copy previous day
  const [copying, setCopying] = useState(false);

  // Vitals form state
  const [vitals, setVitals] = useState({
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    oxygen_saturation: '',
  });

  // Medication form state
  const [medication, setMedication] = useState({
    drug_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: 1,
    unit_price: 0,
  });

  // Clinical note editing
  const [editingNote, setEditingNote] = useState(false);
  const [noteForm, setNoteForm] = useState({
    chief_complaint: '',
    clinical_notes: '',
    diagnosis: '',
    follow_up_date: '',
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

  const addVitalsMutation = useMutation<any, Error, any>({
    mutationFn: (vitalsData) => encountersApi.addVitals(id, vitalsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowVitalsForm(false);
      setVitals({ systolic_bp: '', diastolic_bp: '', heart_rate: '', temperature: '', oxygen_saturation: '' });
    },
    onError: () => setError('Failed to save vitals.'),
  });

  const addMedicationMutation = useMutation<any, Error, any>({
    mutationFn: (medData) => encountersApi.addMedication(id, medData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowMedicationForm(false);
      setMedication({ drug_name: '', dosage: '', frequency: '', duration: '', quantity: 1, unit_price: 0 });
    },
    onError: () => setError('Failed to add medication.'),
  });

  const updateEncounterMutation = useMutation({
    mutationFn: (formData: any) => encountersApi.update(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setEditingNote(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.detail || 'Failed to update clinical note.'),
  });

  const addLabOrderMutation = useMutation<any, Error, any>({
    mutationFn: (data) => encountersApi.addLabOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowLabOrderForm(false);
      setLabPanelId('');
      setLabPriority('ROUTINE');
    },
    onError: () => setError('Failed to add lab order.'),
  });

  const generateInvoiceMutation = useMutation<any, Error, void>({
    mutationFn: () => encountersApi.generateInvoice(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setAccrued((prev) => ({
        ...prev,
        existing_invoice: { id: res.data.id, invoice_number: res.data.invoice_number, status: res.data.status, total: res.data.total },
      }));
    },
    onError: () => setError('Failed to generate invoice.'),
  });

  const completeMutation = useMutation<any, Error, any>({
    mutationFn: (completeData) => encountersApi.complete(id, completeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowCompleteForm(false);
    },
    onError: () => setError('Failed to complete encounter.'),
  });

  const { data: prescriptionsData } = useQuery({
    queryKey: ['encounter-prescriptions', id],
    queryFn: () => encountersApi.prescriptions(id),
    enabled: !!id,
  });
  const prescriptions = prescriptionsData?.data || [];
  const draftPrescription = prescriptions.find(p => p.status === 'DRAFT');

  const submitPrescriptionMutation = useMutation<any, Error, any>({
    mutationFn: (prescriptionId) => encountersApi.submitPrescription(id, prescriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter-prescriptions', id] });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setError('');
    },
    onError: () => setError('Failed to submit orders.'),
  });

  const handleVitalsSubmit = (e) => {
    e.preventDefault();
    addVitalsMutation.mutate({
      systolic_bp: Number(vitals.systolic_bp),
      diastolic_bp: Number(vitals.diastolic_bp),
      heart_rate: Number(vitals.heart_rate),
      temperature: Number(vitals.temperature),
      oxygen_saturation: Number(vitals.oxygen_saturation),
    });
  };

  const handleLabOrderSubmit = (e) => {
    e.preventDefault();
    addLabOrderMutation.mutate({ test_panel: labPanelId, priority: labPriority });
  };

  const handleCopyPreviousOrders = async () => {
    setCopying(true);
    try {
      await encountersApi.copyPreviousOrders(id);
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
    } catch {
      setError('Failed to copy previous orders.');
    }
    setCopying(false);
  };

  useEffect(() => {
    if (activeTab === 'billing' && id) {
      encountersApi.accruedItems(id).then((res) => setAccrued(res.data)).catch(() => {});
    }
  }, [activeTab, id]);

  const handleMedicationSubmit = (e) => {
    e.preventDefault();
    // Collect all drug names from existing medications + the new one
    const existingDrugs = (encounter.medications || []).map((m) => m.drug_name);
    const allDrugs = [...new Set([...existingDrugs, medication.drug_name])];

    if (allDrugs.length < 2) {
      // No other drugs to check against, submit directly
      addMedicationMutation.mutate(medication);
      return;
    }

    setDdiLoading(true);
    ddiApi
      .check({ drugs: allDrugs })
      .then((res) => {
        const interactions = res.data?.interactions || [];
        if (interactions.length > 0) {
          setDdiInteractions(interactions);
          setDdiMedicationData(medication);
        } else {
          addMedicationMutation.mutate(medication);
        }
      })
      .catch(() => {
        // If DDI check fails, proceed anyway
        addMedicationMutation.mutate(medication);
      })
      .finally(() => setDdiLoading(false));
  };

  const handleDDIProceed = () => {
    if (ddiMedicationData) {
      addMedicationMutation.mutate(ddiMedicationData, {
        onSuccess: (res) => {
          const addedMedId = res.data?.id;
          if (addedMedId && ddiInteractions) {
            setDrugDdiMap((prev) => ({
              ...prev,
              [addedMedId]: ddiInteractions,
            }));
          }
        },
      });
    }
    setDdiInteractions(null);
    setDdiMedicationData(null);
  };

  const handleDDICancel = () => {
    setDdiInteractions(null);
    setDdiMedicationData(null);
  };

  const getInteractionIcons = useCallback(
    (medId, drugName) => {
      const interactions = drugDdiMap[medId];
      if (!interactions || interactions.length === 0) return null;

      const hasContraindicated = interactions.some((i) => i.severity === 'contraindicated');
      const hasMajor = interactions.some((i) => i.severity === 'major');

      const icon = hasContraindicated ? '🚫' : hasMajor ? '🔴' : '⚠️';
      const severityLabel = hasContraindicated
        ? 'Contraindicated'
        : hasMajor
        ? 'Major'
        : 'Interaction';

      // Build a human-readable summary of which drug combinations interact
      const summary = interactions
        .map((i) => `${i.drug_a} ↔ ${i.drug_b} (${i.severity})`)
        .join('; ');

      return { icon, label: `${severityLabel}: ${summary}` };
    },
    [drugDdiMap]
  );

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
            encounter.status === 'COMPLETED'
              ? 'bg-green-100 text-green-700'
              : encounter.status === 'IN_PROGRESS'
              ? 'bg-blue-100 text-blue-700'
              : encounter.status === 'PLANNED'
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

      {ddiInteractions && (
        <DDIWarningModal
          interactions={ddiInteractions}
          drugName={ddiMedicationData?.drug_name}
          onProceed={handleDDIProceed}
          onCancel={handleDDICancel}
          isPending={addMedicationMutation.isPending}
        />
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6 flex items-center justify-between">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'lab'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lab Orders
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'billing'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Billing
          </button>
        </nav>
        <div className="flex items-center gap-2">
          {(encounter.encounter_type === 'IPD' || encounter.encounter_type === 'TELEICU') && (
            <button
              onClick={handleCopyPreviousOrders}
              disabled={copying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              title="Copy yesterday's orders to today"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copying ? 'Copying...' : 'Copy Previous Day'}
            </button>
          )}
          <button
            onClick={() => setShowCareScribe(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Care Scribe
          </button>
        </div>
      </div>

      <CareScribeModal
        encounterId={id || ''}
        isOpen={showCareScribe}
        onClose={() => setShowCareScribe(false)}
        onNoteConfirmed={() => queryClient.invalidateQueries({ queryKey: ['encounter', id] })}
      />

      {activeTab === 'details' && (
        <>
          {/* Clinical Note — Inline Editing */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Clinical Note</h2>
              <button
                onClick={() => {
                  if (!editingNote) {
                    // Populate form from encounter data
                    setNoteForm({
                      chief_complaint: encounter.chief_complaint || '',
                      clinical_notes: encounter.clinical_notes || '',
                      diagnosis: encounter.diagnosis || '',
                      follow_up_date: encounter.follow_up_date ? encounter.follow_up_date.split('T')[0] : '',
                    });
                  }
                  setEditingNote(!editingNote);
                }}
                className={`text-sm font-medium ${editingNote ? 'text-gray-500' : 'text-blue-600 hover:text-blue-700'}`}
              >
                {editingNote ? 'Cancel' : encounter.clinical_notes ? 'Edit Note' : '+ Add Clinical Note'}
              </button>
            </div>

            {editingNote ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const payload: any = {};
                  if (noteForm.chief_complaint) payload.chief_complaint = noteForm.chief_complaint;
                  if (noteForm.clinical_notes) payload.clinical_notes = noteForm.clinical_notes;
                  if (noteForm.diagnosis) payload.diagnosis = noteForm.diagnosis;
                  if (noteForm.follow_up_date) payload.follow_up_date = noteForm.follow_up_date;
                  updateEncounterMutation.mutate(payload);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaints / Symptoms</label>
                  <textarea rows={2} value={noteForm.chief_complaint}
                    onChange={(e) => setNoteForm(p => ({ ...p, chief_complaint: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="e.g. Fever with cough x 3 days, headache, body ache" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes (HPI, exam, findings)</label>
                  <textarea rows={5} value={noteForm.clinical_notes}
                    onChange={(e) => setNoteForm(p => ({ ...p, clinical_notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono"
                    placeholder="Write your clinical notes here...&#10;&#10;You can use this format:&#10;- **HPI**: Patient presents with...&#10;- **Past History**: ...&#10;- **Physical Exam**: ...&#10;- **Assessment**: ...&#10;- **Plan**: ..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis / Impression</label>
                    <textarea rows={2} value={noteForm.diagnosis}
                      onChange={(e) => setNoteForm(p => ({ ...p, diagnosis: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="e.g. URTI, Acute Gastroenteritis" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                    <input type="date" value={noteForm.follow_up_date}
                      onChange={(e) => setNoteForm(p => ({ ...p, follow_up_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={updateEncounterMutation.isPending}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {updateEncounterMutation.isPending ? 'Saving...' : 'Save Clinical Note'}
                  </button>
                  <button type="button" onClick={() => setEditingNote(false)}
                    className="text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <span className="ml-2 text-gray-900">{encounter.scheduled_date}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Follow-up:</span>
                    <span className="ml-2 text-gray-900">{encounter.follow_up_date ? new Date(encounter.follow_up_date).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                </div>
                {encounter.chief_complaint && (
                  <div>
                    <span className="text-gray-500 font-medium">Chief Complaints:</span>
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">{encounter.chief_complaint}</p>
                  </div>
                )}
                {encounter.clinical_notes && (
                  <div>
                    <span className="text-gray-500 font-medium">Clinical Notes:</span>
                    <div className="mt-1 text-gray-900 whitespace-pre-wrap font-mono text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {encounter.clinical_notes}
                    </div>
                  </div>
                )}
                {encounter.diagnosis && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <span className="text-blue-700 font-medium">Diagnosis:</span>
                    <p className="mt-1 text-blue-900">{encounter.diagnosis}</p>
                  </div>
                )}
                {!encounter.chief_complaint && !encounter.clinical_notes && !encounter.diagnosis && (
                  <p className="text-gray-400 italic">No clinical notes recorded yet. Click "+ Add Clinical Note" above.</p>
                )}
              </div>
            )}
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
                    <input id="spo2" type="number" value={vitals.oxygen_saturation}
                      onChange={(e) => setVitals((p) => ({ ...p, oxygen_saturation: e.target.value }))}
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
                      <td className="px-3 py-2">{v.oxygen_saturation}%</td>
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
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                  <div className="md:col-span-2">
                    <label htmlFor="drug-name" className="block text-xs font-medium text-gray-600 mb-1">Drug Name</label>
                    <DrugAutocomplete
                      value={medication.drug_name}
                      onChange={(val) => setMedication((p) => ({ ...p, drug_name: val }))}
                      disabled={addMedicationMutation.isPending}
                    />
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
                  <div>
                    <label htmlFor="qty" className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                    <input id="qty" type="number" min="1" step="1" value={medication.quantity}
                      onChange={(e) => setMedication((p) => ({ ...p, quantity: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="unit-price" className="block text-xs font-medium text-gray-600 mb-1">Unit Price (₹)</label>
                    <input id="unit-price" type="number" min="0" step="1" value={medication.unit_price}
                      onChange={(e) => setMedication((p) => ({ ...p, unit_price: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={addMedicationMutation.isPending || ddiLoading}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {ddiLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Checking interactions...
                      </span>
                    ) : (
                      'Add Medication'
                    )}
                  </button>
                  {drugDdiMap && Object.keys(drugDdiMap).length > 0 && (
                    <span className="text-xs text-gray-400">
                      DDI check enabled
                    </span>
                  )}
                </div>
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
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Price</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Interactions</th>
                  </tr>
                </thead>
                <tbody>
                  {encounter.medications.map((m) => {
                    const ddiInfo = getInteractionIcons(m.id, m.drug_name);
                    return (
                      <tr key={m.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{m.drug_name}</td>
                        <td className="px-3 py-2 text-gray-600">{m.dosage}</td>
                        <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                        <td className="px-3 py-2 text-gray-600">{m.duration}</td>
                        <td className="px-3 py-2 text-gray-600">{m.quantity}</td>
                        <td className="px-3 py-2 text-gray-600">₹{m.unit_price}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {ddiInfo ? (
                            <span
                              className="inline-flex items-center cursor-help text-sm"
                              title={ddiInfo.label}
                            >
                              {ddiInfo.icon}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No medications prescribed yet.</p>
            )}
          </div>

          {/* Complete Encounter Section */}
          {encounter.status !== 'COMPLETED' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {!showCompleteForm ? (
                <div className="flex gap-2">
                  {draftPrescription && (draftPrescription.medications.length > 0 || draftPrescription.lab_orders.length > 0) && (
                    <button
                      onClick={() => submitPrescriptionMutation.mutate(draftPrescription.id)}
                      disabled={submitPrescriptionMutation.isPending}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50"
                    >
                      {submitPrescriptionMutation.isPending ? 'Submitting...' : 'Submit Orders'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowCompleteForm(true)}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                  >
                    Complete Encounter
                  </button>
                  {encounter.status === 'COMPLETED' ? (
                    <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium border border-green-200">
                      Completed
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-200">
                      {encounter.status}
                    </span>
                  )}
                </div>
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
        </>
      )}

      {activeTab === 'timeline' && (
        /* ── Timeline Tab ─────────────────────────────────────────────── */
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinical Timeline</h2>
          {(() => {
            const entries = [
              // Vitals
              ...(encounter.vitals || []).map((v) => ({
                id: `v-${v.id}`,
                type: 'vital',
                timestamp: v.recorded_at,
                title: 'Vitals Recorded',
                detail: `BP ${v.systolic_bp}/${v.diastolic_bp} · HR ${v.heart_rate} bpm · Temp ${v.temperature}°F · SpO₂ ${v.oxygen_saturation}%`,
              })),
              // Medications
              ...(encounter.medications || []).map((m) => ({
                id: `m-${m.id}`,
                type: 'medication',
                timestamp: m.prescribed_at || m.created_at,
                title: `Medication Prescribed: ${m.drug_name}`,
                detail: `${m.dosage} · ${m.frequency} · ${m.duration}`,
              })),
              // Completion notes (if encounter is completed)
              ...(encounter.completed_at
                ? [
                    {
                      id: 'complete',
                      type: 'completion',
                      timestamp: encounter.completed_at,
                      title: 'Encounter Completed',
                      detail: encounter.diagnosis
                        ? `Diagnosis: ${encounter.diagnosis}`
                        : 'No diagnosis recorded',
                    },
                  ]
                : []),
              // Clinical notes (if any)
              ...(encounter.clinical_notes || []).map((n) => ({
                id: `n-${n.id}`,
                type: 'note',
                timestamp: n.created_at,
                title: n.author ? `Note by ${n.author}` : 'Clinical Note',
                detail: n.note || n.content || '',
              })),
              // Diagnosis / notes from the encounter body
              ...(encounter.diagnosis
                ? [
                    {
                      id: 'diagnosis',
                      type: 'diagnosis',
                      timestamp: encounter.updated_at,
                      title: 'Diagnosis',
                      detail: encounter.diagnosis,
                    },
                  ]
                : []),
              ...(encounter.notes
                ? [
                    {
                      id: 'notes',
                      type: 'note',
                      timestamp: encounter.updated_at,
                      title: 'Clinical Notes',
                      detail: encounter.notes,
                    },
                  ]
                : []),
            ]
              // Sort newest-first; entries without timestamps go last
              .sort((a, b) => {
                if (!a.timestamp) return 1;
                if (!b.timestamp) return -1;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              });

            if (entries.length === 0) {
              return (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-500 text-sm">
                    No timeline entries yet. Add vitals, medications, or complete the encounter to build the timeline.
                  </p>
                </div>
              );
            }

            return (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {entries.map((entry, idx) => {
                    const iconMap = {
                      vital: '🩺',
                      medication: '💊',
                      note: '📝',
                      diagnosis: '📋',
                      completion: '✅',
                    };

                    return (
                      <div key={entry.id || idx} className="relative pl-10">
                        {/* Timeline dot */}
                        <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-500 -translate-x-1/2" />

                        {/* Icon */}
                        <span className="absolute left-8 top-0 text-base">
                          {iconMap[entry.type] || '📌'}
                        </span>

                        {/* Content card */}
                        <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {entry.title}
                            </h4>
                            {entry.timestamp && (
                              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {entry.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'lab' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Lab Orders</h2>
            <button
              onClick={() => setShowLabOrderForm(!showLabOrderForm)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showLabOrderForm ? 'Cancel' : '+ Order Lab Test'}
            </button>
          </div>

          {showLabOrderForm && (
            <form onSubmit={handleLabOrderSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Panel</label>
                  <LabPanelSelector value={labPanelId} onChange={setLabPanelId} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={labPriority} onChange={(e) => setLabPriority(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={addLabOrderMutation.isPending}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                {addLabOrderMutation.isPending ? 'Ordering...' : 'Place Order'}
              </button>
            </form>
          )}

          {encounter.lab_orders && encounter.lab_orders.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Test</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Priority</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Ordered</th>
                </tr>
              </thead>
              <tbody>
                {(encounter.lab_orders || []).map((lo) => (
                  <tr key={lo.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{lo.test_name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        lo.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        lo.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{lo.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{lo.priority}</td>
                    <td className="px-3 py-2 text-gray-500">{new Date(lo.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">No lab orders yet.</p>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
            {!accrued?.existing_invoice && encounter.status !== 'COMPLETED' && (
              <button
                onClick={() => generateInvoiceMutation.mutate()}
                disabled={generateInvoiceMutation.isPending}
                className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {generateInvoiceMutation.isPending ? 'Generating...' : 'Generate Invoice'}
              </button>
            )}
          </div>

          {accrued ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Medications</p>
                  <p className="text-xl font-bold text-blue-700">₹{accrued.medications_total.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Lab Tests</p>
                  <p className="text-xl font-bold text-purple-700">₹{accrued.lab_total.toFixed(2)}</p>
                </div>
                {accrued.bed_charges && (
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-xs text-orange-600 font-medium">Bed Charges</p>
                    <p className="text-xl font-bold text-orange-700">₹{accrued.bed_charges.total.toFixed(2)}</p>
                  </div>
                )}
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Grand Total</p>
                  <p className="text-xl font-bold text-green-700">₹{accrued.grand_total.toFixed(2)}</p>
                </div>
              </div>

              {/* Daily Breakdown */}
              {accrued.days && accrued.days.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Daily Accrual</h3>
                  {accrued.days.map((day) => (
                    <div key={day.date} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{day.date}</span>
                        <span className="text-sm font-semibold">₹{day.day_total.toFixed(2)}</span>
                      </div>
                      {day.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                          <span>{item.type === 'medication' ? item.drug_name : item.test_name}</span>
                          <span>₹{(item.total || item.price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-semibold">
                    <span>Running Total</span>
                    <span>₹{accrued.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No chargeable items yet.</p>
              )}

              {/* Existing Invoice */}
              {accrued.existing_invoice && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    Invoice {accrued.existing_invoice.invoice_number} — {accrued.existing_invoice.status}
                  </p>
                  <p className="text-sm text-green-600">Total: ₹{accrued.existing_invoice.total.toFixed(2)}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading billing data...</p>
          )}
        </div>
      )}
    </div>
  );
}
