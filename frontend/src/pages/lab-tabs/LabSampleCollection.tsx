import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  FlaskConical,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  TestTube2,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import { labOrdersApi } from '../../api/lab/index';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Priority = 'STAT' | 'URGENT' | 'ROUTINE';
type SampleType = 'BLOOD_EDTA' | 'SERUM' | 'URINE' | 'PLASMA' | 'CSF' | 'SWAB' | string;
type EncounterType = 'OPD' | 'IPD' | string;

interface LabOrder {
  id: string;
  lab_id: string;
  patient: {
    full_name: string;
    age: number;
    gender: 'M' | 'F' | 'O' | string;
  };
  encounter: {
    encounter_type: EncounterType;
  };
  test_panel: {
    name: string;
    short_name: string;
  };
  sample_type: SampleType;
  priority: Priority;
  ordered_by: {
    full_name: string;
  };
  department: string;
  ordered_at: string;
  tat_deadline: string;
}

interface ApiResponse {
  results: LabOrder[];
}

// ─────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────

const SAMPLE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  BLOOD_EDTA: {
    label: 'Blood EDTA',
    icon: <Droplets className="w-3.5 h-3.5" />,
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  SERUM: {
    label: 'Serum',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  URINE: {
    label: 'Urine',
    icon: <TestTube2 className="w-3.5 h-3.5" />,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  PLASMA: {
    label: 'Plasma',
    icon: <Droplets className="w-3.5 h-3.5" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  CSF: {
    label: 'CSF',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  SWAB: {
    label: 'Swab',
    icon: <Thermometer className="w-3.5 h-3.5" />,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
};

function getSampleMeta(type: SampleType) {
  return (
    SAMPLE_TYPE_LABELS[type] ?? {
      label: type,
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      color: 'text-gray-600 bg-gray-50 border-gray-200',
    }
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

function avatarColor(name: string): string {
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function isToday(iso: string): boolean {
  try {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// TAT Countdown
// ─────────────────────────────────────────────

function useTATCountdown(deadline: string) {
  const [remaining, setRemaining] = useState<number>(() => {
    return new Date(deadline).getTime() - Date.now();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(deadline).getTime() - Date.now());
    }, 10_000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isOverdue = remaining < 0;
  const absMs = Math.abs(remaining);
  const hours = Math.floor(absMs / 3_600_000);
  const minutes = Math.floor((absMs % 3_600_000) / 60_000);
  const label = `${isOverdue ? '-' : ''}${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
  const urgency: 'overdue' | 'warning' | 'ok' =
    isOverdue ? 'overdue' : remaining < 30 * 60_000 ? 'warning' : 'ok';

  return { label, urgency };
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

function Toast({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto animate-in slide-in-from-right-4 duration-300 ${
            t.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-800'
              : 'bg-white border-red-200 text-red-800'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          )}
          <span className="text-sm font-medium">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  accent,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="mt-1 h-7 w-12 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, { label: string; cls: string; icon?: React.ReactNode }> = {
    STAT: {
      label: 'STAT',
      cls: 'bg-red-100 text-red-700 border-red-200',
      icon: <Zap className="w-3 h-3" />,
    },
    URGENT: {
      label: 'Urgent',
      cls: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    ROUTINE: {
      label: 'Routine',
      cls: 'bg-gray-100 text-gray-600 border-gray-200',
    },
  };
  const { label, cls, icon } = map[priority] ?? map.ROUTINE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

function EncounterTag({ type }: { type: EncounterType }) {
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
        type === 'IPD'
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-teal-100 text-teal-700'
      }`}
    >
      {type}
    </span>
  );
}

function TATCell({ deadline }: { deadline: string }) {
  const { label, urgency } = useTATCountdown(deadline);
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        urgency === 'overdue'
          ? 'bg-red-50 text-red-600 border-red-200'
          : urgency === 'warning'
          ? 'bg-amber-50 text-amber-600 border-amber-200'
          : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────
// Row Component
// ─────────────────────────────────────────────

interface RowProps {
  order: LabOrder;
  selected: boolean;
  onToggle: () => void;
  onCollect: (id: string) => Promise<void>;
  onPrint: (id: string) => Promise<void>;
  collectingId: string | null;
  printingId: string | null;
}

function OrderRow({ order, selected, onToggle, onCollect, onPrint, collectingId, printingId }: RowProps) {
  const sampleMeta = getSampleMeta(order.sample_type);
  const initials = getInitials(order.patient.full_name);
  const avColor = avatarColor(order.patient.full_name);

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      {/* Checkbox */}
      <td className="pl-4 pr-2 py-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-[#0A6253] accent-[#0A6253] cursor-pointer"
        />
      </td>

      {/* Patient */}
      <td className="px-3 py-3 min-w-[180px]">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avColor}`}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 leading-tight">
                {order.patient.full_name}
              </span>
              <EncounterTag type={order.encounter.encounter_type} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.patient.age}y &middot;{' '}
              {order.patient.gender === 'M' ? 'Male' : order.patient.gender === 'F' ? 'Female' : 'Other'}
            </p>
          </div>
        </div>
      </td>

      {/* Lab ID */}
      <td className="px-3 py-3 w-[110px]">
        <span className="font-mono text-xs font-semibold text-[#0A6253] bg-emerald-50 px-2 py-1 rounded">
          {order.lab_id}
        </span>
      </td>

      {/* Test/Panel */}
      <td className="px-3 py-3 min-w-[160px]">
        <p className="text-sm font-medium text-gray-900">{order.test_panel.name}</p>
        <p className="text-xs text-gray-400">{order.test_panel.short_name}</p>
      </td>

      {/* Sample Type */}
      <td className="px-3 py-3 w-[130px]">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sampleMeta.color}`}
        >
          {sampleMeta.icon}
          {sampleMeta.label}
        </span>
      </td>

      {/* Priority */}
      <td className="px-3 py-3 w-[100px]">
        <PriorityBadge priority={order.priority} />
      </td>

      {/* Ordered By */}
      <td className="px-3 py-3 min-w-[140px]">
        <p className="text-sm text-gray-800 font-medium leading-tight">
          Dr. {order.ordered_by.full_name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{order.department}</p>
      </td>

      {/* Ordered At */}
      <td className="px-3 py-3 w-[130px]">
        <p className="text-xs text-gray-600">{formatDateTime(order.ordered_at)}</p>
      </td>

      {/* TAT */}
      <td className="px-3 py-3 w-[110px]">
        <TATCell deadline={order.tat_deadline} />
      </td>

      {/* Actions */}
      <td className="px-3 py-3 w-[180px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCollect(order.id)}
            disabled={collectingId === order.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A6253] text-white hover:bg-[#085244] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {collectingId === order.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            {collectingId === order.id ? 'Saving…' : 'Collected'}
          </button>

          <button
            onClick={() => onPrint(order.id)}
            disabled={printingId === order.id}
            className="inline-flex items-center gap-1 p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-[#0A6253] hover:border-[#0A6253] hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            title="Print Label"
          >
            {printingId === order.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const SAMPLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Sample Types' },
  { value: 'BLOOD_EDTA', label: 'Blood EDTA' },
  { value: 'SERUM', label: 'Serum' },
  { value: 'URINE', label: 'Urine' },
  { value: 'PLASMA', label: 'Plasma' },
  { value: 'CSF', label: 'CSF' },
  { value: 'SWAB', label: 'Swab' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Priorities' },
  { value: 'STAT', label: 'STAT' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'ROUTINE', label: 'Routine' },
];

export default function LabSampleCollection() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [sampleFilter, setSampleFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Action state
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [bulkPrinting, setBulkPrinting] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toastCounter = useRef(0);

  // ── Toast helpers ──
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast-${++toastCounter.current}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch ──
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await labOrdersApi.listOrders({ status: 'ORDERED' });
      const data: ApiResponse = res.data;
      setOrders(data.results);
    } catch (err) {
      setError('Failed to load lab orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Filtered orders ──
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q ||
        o.patient.full_name.toLowerCase().includes(q) ||
        o.lab_id.toLowerCase().includes(q) ||
        o.test_panel.name.toLowerCase().includes(q) ||
        o.test_panel.short_name.toLowerCase().includes(q);
      const matchSample = !sampleFilter || o.sample_type === sampleFilter;
      const matchPriority = !priorityFilter || o.priority === priorityFilter;
      return matchSearch && matchSample && matchPriority;
    });
  }, [orders, search, sampleFilter, priorityFilter]);

  // ── KPI values ──
  const kpis = useMemo(() => {
    const pending = orders.length;
    const stat = orders.filter((o) => o.priority === 'STAT').length;
    const routine = orders.filter((o) => o.priority === 'ROUTINE').length;
    // "Collected today" would come from a separate endpoint in prod; using 0 as placeholder
    const collectedToday = 0;
    return { pending, stat, routine, collectedToday };
  }, [orders]);

  // ── Actions ──
  const handleCollect = useCallback(
    async (id: string) => {
      setCollectingId(id);
      try {
        await labOrdersApi.collectSample(id);
        setOrders((prev) => prev.filter((o) => o.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        addToast('success', 'Sample marked as collected successfully.');
      } catch {
        addToast('error', 'Failed to mark sample as collected.');
      } finally {
        setCollectingId(null);
      }
    },
    [addToast]
  );

  const handlePrint = useCallback(
    async (id: string) => {
      setPrintingId(id);
      try {
        await labOrdersApi.printLabels([id]);
        addToast('success', 'Label sent to printer.');
      } catch {
        addToast('error', 'Failed to print label.');
      } finally {
        setPrintingId(null);
      }
    },
    [addToast]
  );

  const handleBulkPrint = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkPrinting(true);
    try {
      await labOrdersApi.printLabels(Array.from(selectedIds));
      addToast('success', `${selectedIds.size} label(s) sent to printer.`);
    } catch {
      addToast('error', 'Bulk print failed.');
    } finally {
      setBulkPrinting(false);
    }
  }, [selectedIds, addToast]);

  // ── Selection helpers ──
  const allFilteredIds = useMemo(() => filteredOrders.map((o) => o.id), [filteredOrders]);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = allFilteredIds.some((id) => selectedIds.has(id));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      } else {
        return new Set([...prev, ...allFilteredIds]);
      }
    });
  }, [allSelected, allFilteredIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSampleFilter('');
    setPriorityFilter('');
  }, []);

  const hasFilters = search || sampleFilter || priorityFilter;
  const selectedCount = Array.from(selectedIds).filter((id) =>
    filteredOrders.some((o) => o.id === id)
  ).length;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/40 p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TestTube2 className="w-5 h-5 text-[#0A6253]" />
            Sample Collection
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All lab orders pending sample collection
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-[#0A6253] hover:text-[#0A6253] transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pending Collection"
          value={kpis.pending}
          icon={<FlaskConical className="w-6 h-6 text-[#0A6253]" />}
          accent="bg-emerald-50"
          loading={loading}
        />
        <KpiCard
          title="Urgent / STAT"
          value={kpis.stat}
          icon={<Zap className="w-6 h-6 text-red-500" />}
          accent="bg-red-50"
          loading={loading}
        />
        <KpiCard
          title="Routine"
          value={kpis.routine}
          icon={<Clock className="w-6 h-6 text-gray-400" />}
          accent="bg-gray-50"
          loading={loading}
        />
        <KpiCard
          title="Collected Today"
          value={kpis.collectedToday}
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
          accent="bg-emerald-50"
          loading={loading}
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap gap-3 items-center border-b border-gray-50">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patient, lab ID, test…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/30 focus:border-[#0A6253] transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sample Type Filter */}
          <div className="relative">
            <select
              value={sampleFilter}
              onChange={(e) => setSampleFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0A6253]/30 focus:border-[#0A6253] transition cursor-pointer"
            >
              {SAMPLE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0A6253]/30 focus:border-[#0A6253] transition cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {selectedCount > 0 && (
              <span className="text-xs text-gray-500">
                {selectedCount} selected
              </span>
            )}
            <button
              onClick={handleBulkPrint}
              disabled={selectedCount === 0 || bulkPrinting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A6253] text-white text-sm font-semibold hover:bg-[#085244] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {bulkPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Print Labels
              {selectedCount > 0 && (
                <span className="bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[11px] font-bold">
                  {selectedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    disabled={filteredOrders.length === 0}
                    className="w-4 h-4 rounded border-gray-300 accent-[#0A6253] cursor-pointer disabled:opacity-40"
                  />
                </th>
                {[
                  'Patient',
                  'Lab ID',
                  'Test / Panel',
                  'Sample Type',
                  'Priority',
                  'Ordered By',
                  'Ordered At',
                  'TAT',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <AlertCircle className="w-10 h-10 text-red-300" />
                      <p className="text-sm font-medium text-gray-600">{error}</p>
                      <button
                        onClick={fetchOrders}
                        className="text-sm text-[#0A6253] underline hover:no-underline"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <FlaskConical className="w-10 h-10 text-gray-200" />
                      <p className="text-sm font-medium text-gray-500">
                        {hasFilters ? 'No orders match your filters.' : 'No pending sample collections.'}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-sm text-[#0A6253] underline hover:no-underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={selectedIds.has(order.id)}
                    onToggle={() => toggleOne(order.id)}
                    onCollect={handleCollect}
                    onPrint={handlePrint}
                    collectingId={collectingId}
                    printingId={printingId}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>
              Showing <span className="font-semibold text-gray-600">{filteredOrders.length}</span> of{' '}
              <span className="font-semibold text-gray-600">{orders.length}</span> orders
            </span>
            <span>Status: Pending Collection</span>
          </div>
        )}
      </div>

      {/* ── Toasts ── */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
