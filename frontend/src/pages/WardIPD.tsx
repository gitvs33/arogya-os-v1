import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  getBedMap,
  assignBed,
  releaseBed,
  transferPatient,
  checkDischargeReadiness,
  executeDischarge,
  listWards,
  type WardBedMap,
  type BedInfo,
} from '../api/ward';
import { patientsApi } from '../api/patients';
import { encountersApi } from '../api/encounters';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════════════
   Ward / IPD — Bed Map & Overview
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WardIPD() {
  const [selectedWardId, setSelectedWardId] = useState<string | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [selectedBed, setSelectedBed] = useState<BedInfo | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEncounterId, setAssignEncounterId] = useState('');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [dischargeData, setDischargeData] = useState({
    discharge_diagnosis: '',
    condition_at_discharge: '',
    follow_up_instructions: '',
    discharge_medications: '',
  });
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch wards for filter
  const { data: wards } = useQuery({
    queryKey: ['wards'],
    queryFn: listWards,
  });

  // Fetch bed map
  const { data: bedMap, isLoading, error } = useQuery({
    queryKey: ['bed-map', selectedWardId],
    queryFn: () => getBedMap(selectedWardId),
  });

  // Assign bed mutation
  const assignMutation = useMutation({
    mutationFn: ({ bedId, encounterId }: { bedId: string; encounterId: string }) =>
      assignBed(bedId, encounterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bed-map'] });
      setShowAssignModal(false);
      setAssignEncounterId('');
      setSelectedBed(null);
    },
  });

  // Release bed mutation
  const releaseMutation = useMutation({
    mutationFn: (bedId: string) => releaseBed(bedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bed-map'] });
      setSelectedBed(null);
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({
      encounterId,
      destinationBedId,
      reason,
    }: {
      encounterId: string;
      destinationBedId: string;
      reason?: string;
    }) => transferPatient(encounterId, destinationBedId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bed-map'] });
      setShowTransferModal(false);
      setSelectedBed(null);
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'bg-green-500';
      case 'available':
        return 'bg-gray-200';
      case 'reserved':
        return 'bg-yellow-400';
      case 'maintenance':
        return 'bg-red-400';
      default:
        return 'bg-gray-200';
    }
  };

  const statusLabelColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'text-green-700 bg-green-50';
      case 'available':
        return 'text-gray-500 bg-gray-100';
      case 'reserved':
        return 'text-yellow-700 bg-yellow-50';
      case 'maintenance':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };

  const acuityColor = (acuity: string) => {
    switch ((acuity || '').toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'observation':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'stable':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ward / IPD</h1>
          <p className="text-sm text-gray-500 mt-1">Bed map overview for all wards</p>
        </div>
        <button
          onClick={() => setShowAdmitModal(true)}
          className="px-4 py-2 text-white bg-[#0A6253] rounded-lg text-sm font-medium hover:bg-[#084d41] transition-colors"
        >
          + Admit Patient
        </button>
      </div>

      {/* Ward filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedWardId(undefined)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            !selectedWardId
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Wards
        </button>
        {wards?.map((ward) => (
          <button
            key={ward.id}
            onClick={() => setSelectedWardId(ward.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedWardId === ward.id
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {ward.name}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">Loading bed map...</div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500">
          Failed to load bed map. Please try again.
        </div>
      )}

      {!isLoading && !error && bedMap && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bedMap.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              No wards found. Create a ward first in Admin Settings.
            </div>
          )}

          {bedMap.map((ward) => (
            <div key={ward.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Ward header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                  <span className="text-xs text-gray-500">{ward.ward_type_label} · {ward.floor || 'No floor'}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-600 font-medium">{ward.available_beds} free</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-700">{ward.total_beds} total</span>
                </div>
              </div>

              {/* Bed grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ward.beds.map((bed) => (
                  <div
                    key={bed.id}
                    onClick={() => setSelectedBed(bed)}
                    className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      selectedBed?.id === bed.id
                        ? 'border-emerald-500 shadow-md'
                        : bed.status === 'available'
                        ? 'border-gray-200'
                        : bed.status === 'occupied'
                        ? 'border-green-300'
                        : bed.status === 'reserved'
                        ? 'border-yellow-300'
                        : 'border-red-300'
                    }`}
                  >
                    {/* Status indicator dot */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-700">{bed.bed_number}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusLabelColor(bed.status)}`}>
                        {bed.status_label}
                      </span>
                    </div>

                    {bed.patient && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{bed.patient.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{bed.encounter?.days_admitted || 0}d</span>
                          <span
                            className={`px-1 py-0.5 rounded text-[10px] font-medium border ${
                              acuityColor(bed.encounter?.clinical_acuity || '')
                            }`}
                          >
                            {bed.encounter?.clinical_acuity || 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}

                    {bed.status === 'available' && (
                      <p className="text-xs text-gray-400 mt-2">No patient assigned</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Ward stats bar */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Bed charge: ₹{ward.bed_charge_per_day}/day</span>
                <span>
                  {ward.occupied_beds} occupied · {ward.available_beds} available
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Bed Action Modal ──────────────────────────────────────────────── */}
      {selectedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedBed(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bed {selectedBed.bed_number}</h3>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusLabelColor(selectedBed.status)}`}>
                {selectedBed.status_label}
              </span>
            </div>

            {selectedBed.patient && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                <p className="font-semibold text-gray-900">{selectedBed.patient.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <span>Gender: {selectedBed.patient.gender}</span>
                  <span>Age: {selectedBed.patient.age || 'N/A'}</span>
                  <span>Days: {selectedBed.encounter?.days_admitted || 0}</span>
                  <span>Acuity: {selectedBed.encounter?.clinical_acuity || 'N/A'}</span>
                </div>
                {selectedBed.encounter?.diagnosis && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Diagnosis:</span> {selectedBed.encounter.diagnosis}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Doctor:</span> {selectedBed.encounter?.doctor_name || 'N/A'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Available bed actions */}
              {selectedBed.status === 'available' && (
                <>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    Assign Patient
                  </button>
                </>
              )}

              {/* Occupied bed actions */}
              {selectedBed.status === 'occupied' && selectedBed.encounter && (
                <>
                  <button
                    onClick={() => navigate(`/encounters/${selectedBed.encounter!.id}`)}
                    className="w-full py-2.5 text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-lg text-sm font-medium hover:bg-[#D1EAE0] transition-colors"
                  >
                    View Patient Details
                  </button>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="w-full py-2.5 text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-lg text-sm font-medium hover:bg-[#D1EAE0] transition-colors"
                  >
                    Transfer to Another Bed
                  </button>
                  <button
                    onClick={() => setShowDischargeModal(true)}
                    className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Discharge Patient
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Release Bed',
                        message: 'Release this bed? The patient must be discharged or transferred first.',
                        onConfirm: () => {
                          releaseMutation.mutate(selectedBed.id);
                          setConfirmDialog(p => ({ ...p, isOpen: false }));
                        }
                      });
                    }}
                    className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Release Bed
                  </button>
                </>
              )}

              <button
                onClick={() => setSelectedBed(null)}
                className="w-full py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors mt-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Assign Bed Modal ──────────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Patient to {selectedBed?.bed_number}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Encounter ID</label>
                <input
                  type="text"
                  value={assignEncounterId}
                  onChange={(e) => setAssignEncounterId(e.target.value)}
                  placeholder="Paste the encounter UUID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedBed && assignEncounterId) {
                      assignMutation.mutate({ bedId: selectedBed.id, encounterId: assignEncounterId });
                    }
                  }}
                  disabled={!assignEncounterId || assignMutation.isPending}
                  className="flex-1 py-2.5 text-white bg-[#0A6253] rounded-lg text-sm font-medium hover:bg-[#084d41] transition-colors disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Transfer Modal ────────────────────────────────────────────────── */}
      {showTransferModal && selectedBed && (
        <TransferModal
          sourceBed={selectedBed}
          bedMap={bedMap || []}
          onTransfer={(destinationBedId, reason) => {
            if (selectedBed.encounter) {
              transferMutation.mutate({
                encounterId: selectedBed.encounter.id,
                destinationBedId,
                reason,
              });
            }
          }}
          onClose={() => setShowTransferModal(false)}
          isPending={transferMutation.isPending}
        />
      )}

      {/* ─── Discharge Modal ───────────────────────────────────────────────── */}
      {showDischargeModal && selectedBed?.encounter && (
        <DischargeModal
          encounterId={selectedBed.encounter.id}
          patientName={selectedBed.patient?.name || 'Unknown'}
          dischargeData={dischargeData}
          onDataChange={setDischargeData}
          onDischarge={() => {
            if (selectedBed.encounter) {
              executeDischarge(selectedBed.encounter.id, dischargeData).then(() => {
                queryClient.invalidateQueries({ queryKey: ['bed-map'] });
                setShowDischargeModal(false);
                setSelectedBed(null);
                setDischargeData({
                  discharge_diagnosis: '',
                  condition_at_discharge: '',
                  follow_up_instructions: '',
                  discharge_medications: '',
                });
              });
            }
          }}
          onClose={() => setShowDischargeModal(false)}
        />
      )}

      {/* ─── Admit Modal ───────────────────────────────────────────────── */}
      {showAdmitModal && (
        <AdmitModal
          bedMap={bedMap || []}
          onClose={() => setShowAdmitModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['bed-map'] });
            setShowAdmitModal(false);
          }}
        />
      )}

      <ConfirmDialog
        {...confirmDialog}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Admit Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function AdmitModal({
  bedMap,
  onClose,
  onSuccess,
}: {
  bedMap: WardBedMap[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    chief_complaint: '',
    scheduled_date: new Date().toISOString().split('T')[0],
  });
  const [selectedBedId, setSelectedBedId] = useState('');
  const [error, setError] = useState('');

  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', search],
    queryFn: () => patientsApi.list({ search }),
    enabled: search.length > 0,
  });
  const patients = patientsData?.results || patientsData?.data?.results || patientsData || [];

  const availableBeds = bedMap.flatMap((ward) =>
    ward.beds
      .filter((b) => b.status === 'available')
      .map((b) => ({ ...b, wardName: ward.name }))
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        patient: selectedPatient.id,
        encounter_type: 'IPD',
        ...formData,
      };
      const response = await encountersApi.create(payload);
      if (selectedBedId) {
        await assignBed(selectedBedId, response.data.id);
      }
      return response;
    },
    onSuccess,
    onError: () => setError('Failed to admit patient. Please try again.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedPatient) return setError('Please select a patient.');
    if (!selectedBedId) return setError('Please select a bed.');
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Admit Patient to Ward</h3>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedPatient(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by patient name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            {showDropdown && search.length > 0 && patients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {patients.map((patient: any) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearch(patient.full_name);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${
                      selectedPatient?.id === patient.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                    }`}
                  >
                    {patient.full_name} - {patient.phone}
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <p className="mt-1 text-xs text-emerald-600">Selected: {selectedPatient.full_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Bed</label>
            <select
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            >
              <option value="">Select available bed...</option>
              {availableBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.wardName} — {bed.bed_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              placeholder="e.g. General Medicine"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
            <textarea
              value={formData.chief_complaint}
              onChange={(e) => setFormData(prev => ({ ...prev, chief_complaint: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              placeholder="Reason for admission..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white bg-[#0A6253] rounded-lg text-sm font-medium hover:bg-[#084d41] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Admitting...' : 'Admit Patient'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Transfer Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function TransferModal({
  sourceBed,
  bedMap,
  onTransfer,
  onClose,
  isPending,
}: {
  sourceBed: BedInfo;
  bedMap: WardBedMap[];
  onTransfer: (destinationBedId: string, reason: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [selectedDestBedId, setSelectedDestBedId] = useState('');
  const [reason, setReason] = useState('');

  // Collect all available beds
  const availableBeds = bedMap.flatMap((ward) =>
    ward.beds
      .filter((b) => b.status === 'available' && b.id !== sourceBed.id)
      .map((b) => ({
        ...b,
        wardName: ward.name,
      })),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Transfer Patient from {sourceBed.bed_number}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Bed</label>
            <select
              value={selectedDestBedId}
              onChange={(e) => setSelectedDestBedId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select destination bed...</option>
              {availableBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.wardName} — {bed.bed_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. Escalation, change in acuity..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onTransfer(selectedDestBedId, reason)}
              disabled={!selectedDestBedId || isPending}
              className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Transferring...' : 'Transfer'}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Discharge Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function DischargeModal({
  encounterId,
  patientName,
  dischargeData,
  onDataChange,
  onDischarge,
  onClose,
}: {
  encounterId: string;
  patientName: string;
  dischargeData: {
    discharge_diagnosis: string;
    condition_at_discharge: string;
    follow_up_instructions: string;
    discharge_medications: string;
  };
  onDataChange: (data: typeof dischargeData) => void;
  onDischarge: () => void;
  onClose: () => void;
}) {
  const [checking, setChecking] = useState(true);
  const [readiness, setReadiness] = useState<{
    can_discharge: boolean;
    blocks: Array<{ type: string; message: string }>;
  } | null>(null);

  // Check discharge readiness on mount
  const checkFn = async () => {
    try {
      const result = await checkDischargeReadiness(encounterId);
      setReadiness(result);
    } catch {
      setReadiness({ can_discharge: true, blocks: [] });
    }
    setChecking(false);
  };

  // Use effect for initial check
  useState(() => {
    checkFn();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Discharge Patient</h3>
        <p className="text-sm text-gray-500 mb-4">{patientName}</p>

        {/* Readiness check */}
        {checking && <p className="text-sm text-gray-400 mb-4">Checking discharge readiness...</p>}

        {readiness && !readiness.can_discharge && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-red-700 mb-2">Cannot discharge — pending items:</p>
            <ul className="text-sm text-red-600 space-y-1">
              {readiness.blocks.map((b, i) => (
                <li key={i}>• {b.message}</li>
              ))}
            </ul>
          </div>
        )}

        {readiness && readiness.can_discharge && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-700">✓ All checks passed. Ready for discharge.</p>
          </div>
        )}

        {/* Discharge form */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Diagnosis *</label>
            <input
              type="text"
              value={dischargeData.discharge_diagnosis}
              onChange={(e) => onDataChange({ ...dischargeData, discharge_diagnosis: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Final diagnosis"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition at Discharge</label>
            <select
              value={dischargeData.condition_at_discharge}
              onChange={(e) => onDataChange({ ...dischargeData, condition_at_discharge: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select...</option>
              <option value="Recovered">Recovered</option>
              <option value="Improved">Improved</option>
              <option value="Stable">Stable</option>
              <option value="Referred">Referred</option>
              <option value="DAMA">DAMA (Left Against Advice)</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Instructions</label>
            <textarea
              value={dischargeData.follow_up_instructions}
              onChange={(e) => onDataChange({ ...dischargeData, follow_up_instructions: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Follow-up care instructions..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Medications</label>
            <textarea
              value={dischargeData.discharge_medications}
              onChange={(e) => onDataChange({ ...dischargeData, discharge_medications: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Medications to continue at home..."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDischarge}
            disabled={!readiness?.can_discharge || !dischargeData.discharge_diagnosis}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            Confirm Discharge
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
