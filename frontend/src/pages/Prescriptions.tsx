import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '../api/pharmacy';
import { useQueueWebSocket } from '../hooks/useQueueWebSocket';
import { Pill, Activity, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Search, MapPin, User, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Medication = {
  id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  route: string;
  quantity: string;
  is_active: boolean;
  cancellation_reason: string;
};

type PrescriptionEntry = {
  id: string;
  version: number;
  status: string;
  encounter_id: string;
  patient_name: string;
  patient_id: string;
  encounter_type: string;
  bed_number: string;
  clinical_acuity: string;
  doctor_name: string;
  ordered_at: string;
  medications: Medication[];
  medication_count: number;
  pharmacy_notes: string;
};

type PharmacyQueue = {
  stat?: PrescriptionEntry[];
  urgent?: PrescriptionEntry[];
  opd?: PrescriptionEntry[];
  ipd?: PrescriptionEntry[];
  teleicu?: PrescriptionEntry[];
  emergency?: PrescriptionEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, { label: string; icon: any }> = {
  stat: { label: 'STAT — Dispense Immediately', icon: AlertTriangle },
  urgent: { label: 'Urgent — Priority', icon: Activity },
  emergency: { label: 'Emergency', icon: Activity },
  ipd: { label: 'IPD Ward', icon: MapPin },
  teleicu: { label: 'TeleICU', icon: Activity },
  opd: { label: 'OPD Queue', icon: User },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  ORDERED: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-[#E8F5F0] text-[#0A6253]' },
  DISPENSED: { label: 'Dispensed', color: 'bg-gray-100 text-gray-700' },
};

function timeAgo(dateStr: string) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  return `${hrs}h ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Prescriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stat: true, urgent: true, opd: true, ipd: true, teleicu: true, emergency: true,
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch queue
  const { data: queueData, isLoading, error, refetch } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: () => pharmacyApi.getQueue(),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const queue: PharmacyQueue = queueData?.data || {};

  // WebSocket real-time updates
  useQueueWebSocket('pharmacy', useCallback((data: any) => {
    queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
  }, [queryClient]));

  // Mutations
  const markInProgressMutation = useMutation({
    mutationFn: (rxId: string) => pharmacyApi.markInProgress(rxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      showNotification('Prescription marked as in progress.', 'success');
    },
    onError: () => showNotification('Failed to update prescription.', 'error'),
  });

  const dispenseMedMutation = useMutation({
    mutationFn: (medId: string) => pharmacyApi.dispenseMedication(medId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      showNotification('Medication dispensed.', 'success');
    },
    onError: () => showNotification('Failed to dispense medication.', 'error'),
  });

  const dispenseAllMutation = useMutation({
    mutationFn: (rxId: string) => pharmacyApi.dispensePrescription(rxId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      showNotification(res.data?.detail || 'Prescription fully dispensed.', 'success');
    },
    onError: () => showNotification('Failed to dispense all medications.', 'error'),
  });

  function showNotification(message: string, type: 'success' | 'error') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Filter by patient name
  function matchesSearch(entry: PrescriptionEntry) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      entry.patient_name.toLowerCase().includes(q) ||
      entry.doctor_name.toLowerCase().includes(q) ||
      entry.bed_number.toLowerCase().includes(q)
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-lg">Loading pharmacy queue...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        Error loading pharmacy queue. Please try again.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Prescriptions grouped by patient — dispense one medication or all at once
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, doctor, or bed..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>
      </div>

      {/* Queue Sections */}
      {Object.entries(SECTION_LABELS).map(([key, section]) => {
        const entries = (queue as any)[key] as PrescriptionEntry[] | undefined;
        if (!entries || entries.length === 0) return null;

        const filtered = entries.filter(matchesSearch);
        if (filtered.length === 0) return null;

        const Icon = section.icon;

        return (
          <div key={key} className="mb-8">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-4 px-1">
              <Icon className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-bold text-gray-900">{section.label}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {filtered.length} prescription{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Section Content */}
            <div className="space-y-4">
                {filtered.map((rx) => (
                  <PrescriptionCard
                    key={rx.id}
                    rx={rx}
                    onMarkInProgress={() => markInProgressMutation.mutate(rx.id)}
                    onDispenseMed={(medId) => dispenseMedMutation.mutate(medId)}
                    onDispenseAll={() => dispenseAllMutation.mutate(rx.id)}
                    isDispensing={dispenseAllMutation.isPending}
                  />
                ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {Object.values(queue).every((v: any) => !v || v.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <Pill className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No pending prescriptions</p>
          <p className="text-sm mt-1">New prescriptions will appear here in real time when doctors submit them.</p>
        </div>
      )}
    </div>
  );
}

// ── Prescription Card ─────────────────────────────────────────────────────────

function PrescriptionCard({
  rx,
  onMarkInProgress,
  onDispenseMed,
  onDispenseAll,
  isDispensing,
}: {
  rx: PrescriptionEntry;
  onMarkInProgress: () => void;
  onDispenseMed: (medId: string) => void;
  onDispenseAll: () => void;
  isDispensing: boolean;
}) {
  const statusBadge = STATUS_BADGES[rx.status as keyof typeof STATUS_BADGES] || { label: rx.status, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Patient Header */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E8F5F0] flex items-center justify-center">
            <User className="w-5 h-5 text-[#0A6253]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{rx.patient_name}</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {rx.bed_number && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {rx.bed_number}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3 h-3" />
                {rx.doctor_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(rx.ordered_at)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
          {rx.clinical_acuity && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              rx.clinical_acuity === 'Critical' ? 'bg-red-100 text-red-700' :
              rx.clinical_acuity === 'Observation' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {rx.clinical_acuity}
            </span>
          )}
        </div>
      </div>

      {/* Medications Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Medication</th>
              <th className="text-left px-3 py-2 font-medium">Dosage</th>
              <th className="text-left px-3 py-2 font-medium">Frequency</th>
              <th className="text-left px-3 py-2 font-medium">Route</th>
              <th className="text-right px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rx.medications.filter(m => m.is_active).map((med) => (
              <tr key={med.id} className="hover:bg-white transition-colors">
                <td className="px-3 py-2 font-medium text-gray-900">{med.drug_name}</td>
                <td className="px-3 py-2 text-gray-600">{med.dosage}</td>
                <td className="px-3 py-2 text-gray-600">{med.frequency}</td>
                <td className="px-3 py-2 text-gray-600">{med.route}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onDispenseMed(med.id)}
                    disabled={rx.status === 'DISPENSED'}
                    className="px-2.5 py-1 text-xs font-medium text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-md hover:bg-[#D1EAE0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Dispense
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Action Buttons */}
      <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex-1">
          {rx.pharmacy_notes && (
            <p className="text-xs text-gray-500 italic">Note: {rx.pharmacy_notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rx.status === 'ORDERED' && (
            <button
              onClick={onMarkInProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-lg hover:bg-[#D1EAE0] transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Start
            </button>
          )}
          <button
            onClick={onDispenseAll}
            disabled={isDispensing || rx.status === 'DISPENSED' || rx.medications.filter(m => m.is_active).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084d41] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {isDispensing ? 'Dispensing...' : 'Dispense All'}
          </button>
        </div>
      </div>
    </div>
  );
}
