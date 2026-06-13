import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labQueueApi } from '../api/lab/index';
import { useQueueWebSocket } from '../hooks/useQueueWebSocket';
import { FlaskConical, AlertTriangle, Clock, MapPin, User, Stethoscope, RefreshCw, Search, ChevronDown, ChevronUp, CheckCircle, Droplets } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type LabOrderEntry = {
  id: string;
  lab_id: string;
  test_name: string;
  test_panel_id: string;
  priority: string;
  status: string;
  sample_type: string;
  patient_name: string;
  ordered_at: string;
  tat_deadline: string;
  barcode: string;
};

type PrescriptionLabEntry = {
  group_id: string;
  prescription_status: string;
  version: number;
  encounter_id: string;
  patient_name: string;
  clinical_acuity: string;
  encounter_type: string;
  bed_number: string;
  doctor_name: string;
  ordered_at: string;
  lab_orders: LabOrderEntry[];
  order_count: number;
  highest_priority: string;
};

type LabQueue = {
  stat?: PrescriptionLabEntry[];
  urgent?: PrescriptionLabEntry[];
  routine?: PrescriptionLabEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, { label: string }> = {
  stat: { label: 'STAT — Immediate' },
  urgent: { label: 'Urgent — Priority' },
  routine: { label: 'Routine' },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  ORDERED: { label: 'Sample Ordered', color: 'bg-gray-100 text-gray-700' },
  SAMPLE_COLLECTED: { label: 'Collected', color: 'bg-[#E8F5F0] text-[#0A6253]' },
  RECEIVED_IN_LAB: { label: 'In Lab', color: 'bg-[#E8F5F0] text-[#0A6253]' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-[#E8F5F0] text-[#0A6253]' },
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

export default function LabQueue() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stat: true, urgent: true, routine: true,
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: queueData, isLoading, error, refetch } = useQuery({
    queryKey: ['lab-queue'],
    queryFn: () => labQueueApi.getQueue(),
    refetchInterval: 30000,
  });

  const queue: LabQueue = queueData?.data || {};

  // Real-time updates
  useQueueWebSocket('lab', useCallback((data: any) => {
    queryClient.invalidateQueries({ queryKey: ['lab-queue'] });
  }, [queryClient]));

  const collectSamplesMutation = useMutation({
    mutationFn: (rxId: string) => labQueueApi.collectSamples(rxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-queue'] });
      showNotification('Samples marked as collected.', 'success');
    },
    onError: () => showNotification('Failed to mark samples.', 'error'),
  });

  const receiveInLabMutation = useMutation({
    mutationFn: (orderId: string) => labQueueApi.receiveInLab(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-queue'] });
      showNotification('Sample received in lab.', 'success');
    },
    onError: () => showNotification('Failed to receive sample.', 'error'),
  });

  function showNotification(message: string, type: 'success' | 'error') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function matchesSearch(entry: PrescriptionLabEntry) {
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
          <span className="text-lg">Loading lab queue...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        Error loading lab queue. Please try again.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, doctor, or bed..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A6253] focus:border-[#0A6253] outline-none text-sm transition-colors"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Queue
        </button>
      </div>

      {/* Sections */}
      {Object.entries(SECTION_LABELS).map(([key, section]) => {
        const entries = (queue as any)[key] as PrescriptionLabEntry[] | undefined;
        if (!entries || entries.length === 0) return null;
        const filtered = entries.filter(matchesSearch);
        if (filtered.length === 0) return null;

        return (
          <div key={key} className="mb-8">
            <div className="flex items-center gap-3 mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900">{section.label}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-4">
                {filtered.map((rx) => (
                  <div key={rx.group_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Patient Header */}
                    <div className="p-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5F0] flex items-center justify-center">
                          <FlaskConical className="w-5 h-5 text-[#0A6253]" />
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
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        rx.clinical_acuity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rx.clinical_acuity || 'Routine'}
                      </span>
                    </div>

                    {/* Lab Orders Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Test</th>
                            <th className="text-left px-3 py-2 font-medium">Lab ID</th>
                            <th className="text-left px-3 py-2 font-medium">Sample</th>
                            <th className="text-left px-3 py-2 font-medium">Status</th>
                            <th className="text-right px-3 py-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rx.lab_orders.map((order) => (
                            <tr key={order.id} className="hover:bg-white transition-colors">
                              <td className="px-3 py-2 font-medium text-gray-900">{order.test_name}</td>
                              <td className="px-3 py-2 text-gray-500 font-mono">{order.lab_id}</td>
                              <td className="px-3 py-2 text-gray-600">{order.sample_type?.replace('_', ' ') || '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  (STATUS_BADGES[order.status as keyof typeof STATUS_BADGES]?.color) || 'bg-gray-100 text-gray-600'
                                }`}>
                                  {(STATUS_BADGES[order.status as keyof typeof STATUS_BADGES]?.label) || order.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {order.status === 'ORDERED' && (
                                  <button
                                    onClick={() => receiveInLabMutation.mutate(order.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-[#0A6253] bg-[#E8F5F0] border border-[#0A6253]/20 rounded-md hover:bg-[#D1EAE0] transition-colors"
                                  >
                                    Receive
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Bulk Action */}
                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => collectSamplesMutation.mutate(rx.group_id)}
                        disabled={rx.lab_orders.every(o => o.status !== 'ORDERED')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084d41] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Droplets className="w-3.5 h-3.5" />
                        Collect All Samples
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {Object.values(queue).every((v: any) => !v || v.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No pending lab orders</p>
          <p className="text-sm mt-1">New lab orders will appear here in real time when doctors submit them.</p>
        </div>
      )}
        </div>
  );
}
