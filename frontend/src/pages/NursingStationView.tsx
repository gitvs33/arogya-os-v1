import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNursingStation,
  recordVitalsFromNursingStation,
  listWards,
  type NursingStationData,
} from '../api/ward';
import { createNursingNote } from '../api/ward';

/* ═══════════════════════════════════════════════════════════════════════════
   Nursing Station View
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NursingStationView() {
  const [selectedWardId, setSelectedWardId] = useState<string | undefined>(undefined);
  const [vitalsModal, setVitalsModal] = useState<{
    encounterId: string;
    patientName: string;
  } | null>(null);
  const [noteModal, setNoteModal] = useState<{
    encounterId: string;
    patientName: string;
  } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [vitalsData, setVitalsData] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 72,
    temperature: 37.0,
    oxygen_saturation: 98,
    respiratory_rate: 16,
  });
  const queryClient = useQueryClient();

  const { data: wards } = useQuery({
    queryKey: ['wards'],
    queryFn: listWards,
  });

  const { data: station, isLoading, error, refetch } = useQuery({
    queryKey: ['nursing-station', selectedWardId],
    queryFn: () => getNursingStation(selectedWardId),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const recordVitalsMutation = useMutation({
    mutationFn: () =>
      vitalsModal
        ? recordVitalsFromNursingStation(vitalsModal.encounterId, vitalsData)
        : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-station'] });
      setVitalsModal(null);
      setVitalsData({ systolic_bp: 120, diastolic_bp: 80, heart_rate: 72, temperature: 37.0, oxygen_saturation: 98, respiratory_rate: 16 });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: () =>
      noteModal ? createNursingNote(noteModal.encounterId, noteText) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-station'] });
      setNoteModal(null);
      setNoteText('');
    },
  });

  const severityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'WARNING':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'INFO':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nursing Station</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pending tasks, vitals due, and alerts — auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Refresh Now
        </button>
      </div>

      {/* Ward filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedWardId(undefined)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            !selectedWardId ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Wards
        </button>
        {wards?.map((ward) => (
          <button
            key={ward.id}
            onClick={() => setSelectedWardId(ward.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedWardId === ward.id ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {ward.name}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading nursing station...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load. Please try again.</div>}

      {station && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Pending Medications ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm lg:col-span-1">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Pending Medications</h3>
              <p className="text-xs text-gray-400">{station.pending_medications.length} pending</p>
            </div>
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {station.pending_medications.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">All medications administered ✓</p>
              )}
              {station.pending_medications.map((med, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-emerald-200 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">{med.bed_number}</span>
                    <span className="text-xs text-gray-400">{med.frequency}</span>
                  </div>
                  <p className="font-medium text-gray-900">{med.drug_name}</p>
                  <p className="text-sm text-gray-600">{med.dosage} · {med.route}</p>
                  <p className="text-xs text-gray-400 mt-1">{med.patient_name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Vitals Due ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm lg:col-span-1">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Vitals Due</h3>
              <p className="text-xs text-gray-400">{station.vitals_due.length} patients due</p>
            </div>
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {station.vitals_due.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">All vitals up to date ✓</p>
              )}
              {station.vitals_due.map((v, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-emerald-200 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{v.patient_name}</p>
                      <p className="text-xs text-gray-500">Bed {v.bed_number}</p>
                      <p className="text-xs text-red-500 mt-1">{v.last_recorded}</p>
                    </div>
                    <button
                      onClick={() =>
                        setVitalsModal({ encounterId: v.encounter_id, patientName: v.patient_name })
                      }
                      className="px-3 py-1.5 text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-md text-xs font-medium hover:bg-[#D1EAE0] transition-colors"
                    >
                      Record
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Alerts ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm lg:col-span-1">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Alerts</h3>
              <p className="text-xs text-gray-400">{station.alerts.length} active</p>
            </div>
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {station.alerts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No active alerts ✓</p>
              )}
              {station.alerts.map((a, i) => (
                <div key={i} className={`border rounded-lg p-3 ${severityColor(a.severity)}`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-medium">{a.bed_number}</span>
                    <span className="text-[10px] font-bold uppercase">{a.severity}</span>
                  </div>
                  <p className="text-sm font-medium">{a.patient_name}</p>
                  <p className="text-xs mt-1">{a.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Actions Bar ───────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const firstDue = station.vitals_due[0];
                    if (firstDue)
                      setVitalsModal({ encounterId: firstDue.encounter_id, patientName: firstDue.patient_name });
                  }}
                  className="px-4 py-2 text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-lg text-sm font-medium hover:bg-[#D1EAE0] transition-colors"
                >
                  Record Vitals
                </button>
                <button
                  onClick={() => {
                    const firstDue = station.vitals_due[0];
                    if (firstDue) setNoteModal({ encounterId: firstDue.encounter_id, patientName: firstDue.patient_name });
                  }}
                  className="px-4 py-2 text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-lg text-sm font-medium hover:bg-[#D1EAE0] transition-colors"
                >
                  Add Nursing Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Vitals Modal ──────────────────────────────────────────────── */}
      {vitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setVitalsModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Record Vitals</h3>
            <p className="text-sm text-gray-500 mb-4">{vitalsModal.patientName}</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Systolic BP</label>
                <input
                  type="number"
                  value={vitalsData.systolic_bp}
                  onChange={(e) => setVitalsData({ ...vitalsData, systolic_bp: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Diastolic BP</label>
                <input
                  type="number"
                  value={vitalsData.diastolic_bp}
                  onChange={(e) => setVitalsData({ ...vitalsData, diastolic_bp: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heart Rate</label>
                <input
                  type="number"
                  value={vitalsData.heart_rate}
                  onChange={(e) => setVitalsData({ ...vitalsData, heart_rate: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitalsData.temperature}
                  onChange={(e) => setVitalsData({ ...vitalsData, temperature: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SpO2 (%)</label>
                <input
                  type="number"
                  value={vitalsData.oxygen_saturation}
                  onChange={(e) => setVitalsData({ ...vitalsData, oxygen_saturation: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Respiratory Rate</label>
                <input
                  type="number"
                  value={vitalsData.respiratory_rate}
                  onChange={(e) => setVitalsData({ ...vitalsData, respiratory_rate: +e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => recordVitalsMutation.mutate()}
                disabled={recordVitalsMutation.isPending}
                className="flex-1 py-2.5 text-white bg-[#0A6253] rounded-lg text-sm font-medium hover:bg-[#084d41] transition-colors disabled:opacity-50"
              >
                {recordVitalsMutation.isPending ? 'Saving...' : 'Save Vitals'}
              </button>
              <button
                onClick={() => setVitalsModal(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Nursing Note Modal ────────────────────────────────────────── */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Add Nursing Note</h3>
            <p className="text-sm text-gray-500 mb-4">{noteModal.patientName}</p>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              placeholder="Type nursing note here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => addNoteMutation.mutate()}
                disabled={!noteText.trim() || addNoteMutation.isPending}
                className="flex-1 py-2.5 text-white bg-[#0A6253] rounded-lg text-sm font-medium hover:bg-[#084d41] transition-colors disabled:opacity-50"
              >
                {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
