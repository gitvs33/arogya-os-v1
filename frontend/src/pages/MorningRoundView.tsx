import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBedMap,
  createDailyRound,
  finaliseRound,
  listDailyRounds,
  type WardBedMap,
  type DailyRound,
} from '../api/ward';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════════════
   Morning Round View — Doctor's daily round screen
   ═══════════════════════════════════════════════════════════════════════════ */

interface RoundMedication {
  drug_name: string;
  dosage: string;
  frequency: string;
  route: string;
  quantity: number;
  instructions: string;
}

export default function MorningRoundView() {
  const [selectedEncounter, setSelectedEncounter] = useState<{
    id: string;
    patientName: string;
    bedNumber: string;
    wardName: string;
    diagnosis: string;
  } | null>(null);
  const [roundNotes, setRoundNotes] = useState('');
  const [medications, setMedications] = useState<RoundMedication[]>([
    { drug_name: '', dosage: '', frequency: '', route: 'Oral', quantity: 1, instructions: '' },
  ]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Get all occupied beds (patients currently admitted)
  const { data: bedMap, isLoading } = useQuery({
    queryKey: ['bed-map-morning-round'],
    queryFn: () => getBedMap(),
  });

  // Collect all occupied patients
  const occupiedPatients =
    bedMap?.flatMap((ward) =>
      ward.beds
        .filter((b) => b.status === 'occupied' && b.encounter)
        .map((b) => ({
          encounterId: b.encounter!.id,
          patientName: b.patient?.name || 'Unknown',
          bedNumber: b.bed_number,
          wardName: ward.name,
          diagnosis: b.encounter!.diagnosis || '',
          clinicalAcuity: b.encounter!.clinical_acuity || '',
          daysAdmitted: b.encounter!.days_admitted || 0,
        })),
    ) || [];

  // Create daily round mutation
  const createRoundMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      const round = await createDailyRound(encounterId, roundNotes);
      return round;
    },
    onSuccess: (round) => {
      setActiveRoundId(round.id);
      queryClient.invalidateQueries({ queryKey: ['daily-rounds'] });
    },
  });

  // Finalise round mutation
  const finaliseMutation = useMutation({
    mutationFn: async () => {
      if (!activeRoundId) throw new Error('No active round');
      const validMeds = medications.filter((m) => m.drug_name.trim());
      await finaliseRound(
        activeRoundId,
        validMeds.length > 0 ? { medications: validMeds } : undefined,
        roundNotes,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bed-map-morning-round'] });
      setSelectedEncounter(null);
      setActiveRoundId(null);
      setRoundNotes('');
      setMedications([{ drug_name: '', dosage: '', frequency: '', route: 'Oral', quantity: 1, instructions: '' }]);
    },
  });

  // Fetch existing rounds for context
  const { data: existingRounds } = useQuery({
    queryKey: ['daily-rounds', selectedEncounter?.id],
    queryFn: () => listDailyRounds({ encounter: selectedEncounter?.id }),
    enabled: !!selectedEncounter,
  });

  const addMedication = () => {
    setMedications([
      ...medications,
      { drug_name: '', dosage: '', frequency: '', route: 'Oral', quantity: 1, instructions: '' },
    ]);
  };

  const updateMedication = (index: number, field: keyof RoundMedication, value: string | number) => {
    const updated = [...medications];
    (updated[index] as any)[field] = value;
    setMedications(updated);
  };

  const removeMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const acuityColor = (acuity: string) => {
    switch ((acuity || '').toLowerCase()) {
      case 'critical':
        return 'text-red-600';
      case 'observation':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Morning Round</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conduct daily rounds — review patients, update orders, submit to pharmacy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Patient List ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Admitted Patients</h3>
              <p className="text-xs text-gray-400">{occupiedPatients.length} patients</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}
              {!isLoading && occupiedPatients.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No admitted patients</p>
              )}
              {occupiedPatients.map((p) => (
                <button
                  key={p.encounterId}
                  onClick={() => {
                    setSelectedEncounter({
                      id: p.encounterId,
                      patientName: p.patientName,
                      bedNumber: p.bedNumber,
                      wardName: p.wardName,
                      diagnosis: p.diagnosis,
                    });
                    setActiveRoundId(null);
                    setRoundNotes('');
                    setMedications([
                      { drug_name: '', dosage: '', frequency: '', route: 'Oral', quantity: 1, instructions: '' },
                    ]);
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedEncounter?.id === p.encounterId ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{p.patientName}</p>
                    <span className={`text-xs font-medium ${acuityColor(p.clinicalAcuity)}`}>
                      {p.clinicalAcuity || 'Stable'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{p.wardName}</span>
                    <span>·</span>
                    <span>Bed {p.bedNumber}</span>
                    <span>·</span>
                    <span>{p.daysAdmitted}d</span>
                  </div>
                  {p.diagnosis && <p className="text-xs text-gray-400 mt-1 truncate">{p.diagnosis}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Round Form ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!selectedEncounter ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-gray-400">Select a patient from the list to start a round</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Patient header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-lg">{selectedEncounter.patientName}</h3>
                <p className="text-sm text-gray-500">
                  {selectedEncounter.wardName} · Bed {selectedEncounter.bedNumber}
                </p>
                {selectedEncounter.diagnosis && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Diagnosis:</span> {selectedEncounter.diagnosis}
                  </p>
                )}
              </div>

              {/* Previous rounds context */}
              {existingRounds && existingRounds.length > 0 && (
                <div className="px-6 py-3 border-b border-gray-100 bg-blue-50">
                  <p className="text-xs font-medium text-blue-700">
                    Previous rounds: {existingRounds.length} completed
                  </p>
                </div>
              )}

              <div className="p-6 space-y-6">
                {/* Round Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doctor's Notes</label>
                  <textarea
                    value={roundNotes}
                    onChange={(e) => setRoundNotes(e.target.value)}
                    rows={3}
                    placeholder="Clinical notes for this round..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Medications */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Medications</label>
                    <button
                      onClick={addMedication}
                      className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                    >
                      + Add Medication
                    </button>
                  </div>

                  <div className="space-y-3">
                    {medications.map((med, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2 sm:col-span-4">
                            <input
                              type="text"
                              value={med.drug_name}
                              onChange={(e) => updateMedication(index, 'drug_name', e.target.value)}
                              placeholder="Drug name"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                            placeholder="Dosage (e.g. 500mg)"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                            placeholder="Frequency (e.g. TDS)"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={med.route}
                            onChange={(e) => updateMedication(index, 'route', e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="Oral">Oral</option>
                            <option value="IV">IV</option>
                            <option value="IM">IM</option>
                            <option value="Subcutaneous">Subcutaneous</option>
                            <option value="Topical">Topical</option>
                            <option value="Inhalation">Inhalation</option>
                          </select>
                          <input
                            type="number"
                            value={med.quantity}
                            onChange={(e) => updateMedication(index, 'quantity', +e.target.value)}
                            placeholder="Qty"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            min={1}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={med.instructions}
                            onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                            placeholder="Instructions (optional)"
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          {medications.length > 1 && (
                            <button
                              onClick={() => removeMedication(index)}
                              className="text-red-500 text-xs font-medium hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={async () => {
                      // Create round first if not created
                      if (!activeRoundId) {
                        await createRoundMutation.mutateAsync(selectedEncounter.id);
                      }
                      // Then finalise
                      finaliseMutation.mutate();
                    }}
                    disabled={finaliseMutation.isPending || createRoundMutation.isPending}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {finaliseMutation.isPending
                      ? 'Submitting...'
                      : 'Submit Round'}
                  </button>
                  <button
                    onClick={() => navigate(`/encounters/${selectedEncounter.id}`)}
                    className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Full Patient View
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
