import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import {
  ChevronRight,
  ChevronDown,
  Download,
  Share2,
  Send,
  Printer,
  Plus,
  RefreshCw,
  StickyNote,
  MoreVertical,
  User,
  Calendar,
  FlaskConical,
  Building2,
  Stethoscope,
  BedDouble,
  Hash,
  Barcode,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  History,
  ShieldCheck,
  Trash2,
  Upload,
  ChevronUp,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { labOrdersApi, labResultsApi, labQcApi } from '../api/lab/index';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'ORDERED'
  | 'SAMPLE_COLLECTED'
  | 'RECEIVED_IN_LAB'
  | 'ANALYSIS_COMPLETED'
  | 'REPORTED';

type ResultStatus = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL';

interface LabOrder {
  id: string;
  panel_name: string;
  sample_type: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  lab_id: string;
  accession_number: string;
  status: OrderStatus;
  patient: {
    id: string;
    name: string;
    mrn: string;
    age: number;
    gender: string;
  };
  visit_type: string;
  department: string;
  consultant: string;
  encounter_id: string;
  bed_unit: string;
  sample_collected_at: string | null;
  ordered_at: string;
  received_at: string | null;
  analysis_completed_at: string | null;
  reported_at: string | null;
  method: string;
  lab_name: string;
  reviewed_by: string;
  comments: string;
}

interface LabResult {
  id: string;
  parameter: {
    name: string;
    group: string;
    unit: string;
    ref_range_low: number | null;
    ref_range_high: number | null;
  };
  result_value: string;
  result_numeric: number | null;
  status: ResultStatus;
  history?: { date: string; value: number }[];
}

interface Document {
  id: string;
  name: string;
  file_type: string;
  uploaded_at: string;
  file_url: string;
  size_kb: number;
}

interface HistoryEntry {
  id: string;
  date: string;
  panel_name: string;
  overall_status: 'NORMAL' | 'BORDERLINE' | 'ABNORMAL';
  order_id: string;
}

interface QcEvent {
  id: string;
  timestamp: string;
  action: string;
  performed_by: string;
  instrument_id: string | null;
  notes: string | null;
}

interface TrendPoint {
  date: string;
  value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'ORDERED', label: 'Test Ordered' },
  { key: 'SAMPLE_COLLECTED', label: 'Sample Collected' },
  { key: 'RECEIVED_IN_LAB', label: 'Received in Lab' },
  { key: 'ANALYSIS_COMPLETED', label: 'Analysis Completed' },
  { key: 'REPORTED', label: 'Reported' },
];

const STATUS_ORDER: OrderStatus[] = [
  'ORDERED',
  'SAMPLE_COLLECTED',
  'RECEIVED_IN_LAB',
  'ANALYSIS_COMPLETED',
  'REPORTED',
];

function getStepTimestamp(order: LabOrder, key: OrderStatus): string | null {
  switch (key) {
    case 'ORDERED':
      return order.ordered_at;
    case 'SAMPLE_COLLECTED':
      return order.sample_collected_at;
    case 'RECEIVED_IN_LAB':
      return order.received_at;
    case 'ANALYSIS_COMPLETED':
      return order.analysis_completed_at;
    case 'REPORTED':
      return order.reported_at;
  }
}

function isStepCompleted(order: LabOrder, key: OrderStatus): boolean {
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const stepIdx = STATUS_ORDER.indexOf(key);
  return stepIdx <= currentIdx;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const resultStatusConfig: Record<
  ResultStatus,
  { label: string; badge: string; text: string; symbol: string }
> = {
  NORMAL: {
    label: 'Normal',
    badge: 'bg-green-100 text-green-700',
    text: 'text-gray-900',
    symbol: '✓',
  },
  LOW: {
    label: 'Low',
    badge: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
    symbol: 'L',
  },
  HIGH: {
    label: 'High',
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-600',
    symbol: 'H',
  },
  CRITICAL: {
    label: 'Critical',
    badge: 'bg-red-200 text-red-800 font-bold',
    text: 'text-red-700 font-bold',
    symbol: 'C',
  },
};

const overallStatusConfig: Record<
  string,
  { badge: string }
> = {
  NORMAL: { badge: 'bg-green-100 text-green-700' },
  BORDERLINE: { badge: 'bg-yellow-100 text-yellow-700' },
  ABNORMAL: { badge: 'bg-red-100 text-red-700' },
};

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

interface SparklineProps {
  data: { date: string; value: number }[];
  status: ResultStatus;
}

function Sparkline({ data, status }: SparklineProps) {
  if (!data || data.length < 2) {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  const color =
    status === 'NORMAL'
      ? '#16a34a'
      : status === 'LOW'
      ? '#2563eb'
      : '#dc2626';
  return (
    <LineChart width={60} height={32} data={data}>
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab =
  | 'overview'
  | 'results'
  | 'trends'
  | 'documents'
  | 'history'
  | 'qcaudit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Test Overview' },
  { key: 'results', label: 'Results' },
  { key: 'trends', label: 'Trends' },
  { key: 'documents', label: 'Documents' },
  { key: 'history', label: 'History' },
  { key: 'qcaudit', label: 'QC & Audit' },
];

export default function LabOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [allExpanded, setAllExpanded] = useState(false);
  const [selectedTrendParam, setSelectedTrendParam] = useState<string>('');
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteText, setNoteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: orderData,
    isLoading: orderLoading,
    error: orderError,
  } = useQuery({
    queryKey: ['lab-order', id],
    queryFn: () => labOrdersApi.getOrder(id!),
    enabled: !!id,
  });

  const order: LabOrder | undefined = orderData?.data;

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['lab-results', id],
    queryFn: () => labResultsApi.getResults(id!),
    enabled: !!id && activeTab === 'results',
  });

  const results: LabResult[] = resultsData?.data?.results ?? [];

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['lab-trend', order?.patient?.id, selectedTrendParam],
    queryFn: () => labResultsApi.getResultTrend(order!.patient.id, selectedTrendParam).then(r => r.data),
    enabled: !!order?.patient?.id && !!selectedTrendParam && activeTab === 'trends',
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['lab-docs', id],
    queryFn: () => labOrdersApi.getDocuments(id!),
    enabled: !!id && activeTab === 'documents',
  });
  const documents: Document[] = docsData?.data?.documents ?? [];

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['lab-history', order?.patient?.id, order?.panel_name],
    queryFn: () =>
      labResultsApi.getHistory(order!.patient.id, order!.panel_name),
    enabled:
      !!order?.patient?.id &&
      !!order?.panel_name &&
      activeTab === 'history',
  });
  const history: HistoryEntry[] = historyData?.data?.history ?? [];

  const { data: qcData, isLoading: qcLoading } = useQuery({
    queryKey: ['lab-qc', id],
    queryFn: () => labQcApi.getQcAudit(id!),
    enabled: !!id && activeTab === 'qcaudit',
  });
  const qcEvents: QcEvent[] = qcData?.data?.events ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────

  const repeatMutation = useMutation({
    mutationFn: () => labOrdersApi.repeatTest(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-order', id] });
      alert('Repeat test order placed successfully.');
    },
  });

  const noteMutation = useMutation({
    mutationFn: (note: string) => labOrdersApi.addNote(id!, note),
    onSuccess: () => {
      setNoteText('');
      setShowNoteBox(false);
      queryClient.invalidateQueries({ queryKey: ['lab-qc', id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => labOrdersApi.uploadDocument(id!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-docs', id] });
    },
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const resultGroups = results.reduce<Record<string, LabResult[]>>(
    (acc, r) => {
      const g = r.parameter.group || 'General';
      if (!acc[g]) acc[g] = [];
      acc[g].push(r);
      return acc;
    },
    {}
  );

  const uniqueParams = [
    ...new Set(results.map((r) => r.parameter.name)),
  ];

  const resultsCount = results.length;

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function handleExpandAll() {
    const next = !allExpanded;
    setAllExpanded(next);
    const newState: Record<string, boolean> = {};
    Object.keys(resultGroups).forEach((g) => {
      newState[g] = next;
    });
    setExpandedGroups(newState);
  }

  async function handleDownloadReport() {
    try {
      const res = await labOrdersApi.downloadReport(id!);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `LabReport_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download report. Please try again.');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    uploadMutation.mutate(fd);
  }

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (orderLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-red-600 font-medium">
          Failed to load order details. Please try again.
        </p>
        <Link
          to="/laboratory"
          className="text-sm text-[#0A6253] hover:underline"
        >
          ← Back to Lab Orders
        </Link>
      </div>
    );
  }

  const currentStepIdx = STATUS_ORDER.indexOf(order.status);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Back nav ── */}
      <div className="px-6 pt-4">
        <Link
          to="/laboratory"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0A6253] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lab Orders
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PATIENT HEADER BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="mx-6 mt-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Top green bar */}
        <div className="h-1.5 bg-[#0A6253]" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Avatar + primary info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#0A6253]/10 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-[#0A6253]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {order.patient.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Hash className="w-3 h-3" />
                    MRN: <span className="font-medium text-gray-700">{order.patient.mrn}</span>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-600 font-medium">
                    {order.patient.age}Y / {order.patient.gender}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                    {order.visit_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Meta grid */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Dept:</span>
                <span className="font-medium text-gray-700">{order.department}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Stethoscope className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Consultant:</span>
                <span className="font-medium text-gray-700">{order.consultant}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Encounter:</span>
                <span className="font-medium text-gray-700">{order.encounter_id}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <BedDouble className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Bed/Unit:</span>
                <span className="font-medium text-gray-700">{order.bed_unit}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Sample Collected:</span>
                <span className="font-medium text-gray-700">
                  {fmtShort(order.sample_collected_at)}
                </span>
              </div>
            </div>

            {/* More Actions */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMoreActionsOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                More Actions
                <MoreVertical className="w-4 h-4" />
              </button>
              {moreActionsOpen && (
                <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
                  {[
                    'Edit Order',
                    'Cancel Order',
                    'Reassign Lab',
                    'Escalate Priority',
                    'Flag for Review',
                  ].map((action) => (
                    <button
                      key={action}
                      onClick={() => {
                        setMoreActionsOpen(false);
                        alert(`${action} — Coming soon`);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT: Tab bar + Body + Right Sidebar
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="mx-6 mt-4 flex gap-4 items-start">
        {/* LEFT: Tabs + Content */}
        <div className="flex-1 min-w-0">
          {/* ── Tab bar ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-[#0A6253] text-[#0A6253]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'results' && resultsCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-[#0A6253]/10 text-[#0A6253] font-semibold">
                      {resultsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div className="p-5">
              {activeTab === 'overview' && (
                <OverviewTab order={order} currentStepIdx={currentStepIdx} />
              )}
              {activeTab === 'results' && (
                <ResultsTab
                  isLoading={resultsLoading}
                  resultGroups={resultGroups}
                  expandedGroups={expandedGroups}
                  allExpanded={allExpanded}
                  onExpandAll={handleExpandAll}
                  onToggleGroup={toggleGroup}
                />
              )}
              {activeTab === 'trends' && (
                <TrendsTab
                  isLoading={trendLoading}
                  trendData={trendData}
                  uniqueParams={uniqueParams}
                  selectedParam={selectedTrendParam}
                  onSelectParam={setSelectedTrendParam}
                  resultsLoading={resultsLoading}
                  results={results}
                />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab
                  isLoading={docsLoading}
                  documents={documents}
                  onUploadClick={() => fileInputRef.current?.click()}
                  uploadPending={uploadMutation.isPending}
                />
              )}
              {activeTab === 'history' && (
                <HistoryTab
                  isLoading={historyLoading}
                  history={history}
                />
              )}
              {activeTab === 'qcaudit' && (
                <QcAuditTab
                  isLoading={qcLoading}
                  events={qcEvents}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-64 flex-shrink-0 space-y-3">
          {/* Action Buttons Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Actions
            </h3>
            <div className="space-y-2">
              <SidebarButton
                icon={<Download className="w-4 h-4" />}
                label="Download Report (PDF)"
                onClick={handleDownloadReport}
                variant="primary"
              />
              <SidebarButton
                icon={<Share2 className="w-4 h-4" />}
                label="Share Report"
                onClick={() => alert('Share Report — Coming soon')}
              />
              <SidebarButton
                icon={<Send className="w-4 h-4" />}
                label="Send to Doctor"
                onClick={() => alert('Send to Doctor — Coming soon')}
              />
              <SidebarButton
                icon={<Printer className="w-4 h-4" />}
                label="Print Report"
                onClick={() => window.print()}
              />
              <div className="border-t border-gray-100 pt-2 mt-2" />
              <SidebarButton
                icon={<Plus className="w-4 h-4" />}
                label="Add Test to Sample"
                onClick={() => alert('Add Test to Existing Sample — Coming soon')}
              />
              <SidebarButton
                icon={<RefreshCw className="w-4 h-4" />}
                label="Repeat Test"
                onClick={() => repeatMutation.mutate()}
                loading={repeatMutation.isPending}
              />
              <SidebarButton
                icon={<StickyNote className="w-4 h-4" />}
                label="Add Note"
                onClick={() => setShowNoteBox((v) => !v)}
              />
            </div>

            {/* Inline Note Box */}
            {showNoteBox && (
              <div className="mt-3 space-y-2">
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter clinical note..."
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A6253] focus:border-[#0A6253] outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={!noteText.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate(noteText.trim())}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-[#0A6253] text-white hover:bg-[#085046] transition-colors disabled:opacity-50"
                  >
                    {noteMutation.isPending ? 'Saving...' : 'Save Note'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNoteBox(false);
                      setNoteText('');
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous Results & Related Tests — only on Overview tab */}
          {activeTab === 'overview' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Previous Results
                </h3>
                {history.slice(0, 3).length === 0 ? (
                  <p className="text-xs text-gray-400">No previous results found.</p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 3).map((h) => (
                      <Link
                        key={h.id}
                        to={`/laboratory/orders/${h.order_id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            {fmtShort(h.date)}
                          </p>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              overallStatusConfig[h.overall_status]?.badge ??
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {h.overall_status}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Related Tests
                </h3>
                <p className="text-xs text-gray-400">
                  No related tests linked to this order.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden file input for document upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.dcm"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}

// ─── Sidebar Button ────────────────────────────────────────────────────────────

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary';
  loading?: boolean;
}

function SidebarButton({
  icon,
  label,
  onClick,
  variant = 'default',
  loading = false,
}: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left disabled:opacity-60 ${
        variant === 'primary'
          ? 'bg-[#0A6253] text-white hover:bg-[#085046]'
          : 'text-gray-700 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  order,
  currentStepIdx,
}: {
  order: LabOrder;
  currentStepIdx: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Left: Panel Card + Workflow */}
      <div className="col-span-2 space-y-5">
        {/* Panel Card */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0A6253]/10 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-[#0A6253]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {order.panel_name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete Blood Count Panel
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {order.status === 'REPORTED'
                ? 'Completed'
                : order.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow icon={<FlaskConical className="w-3.5 h-3.5" />} label="Sample Type" value={order.sample_type} />
            <InfoRow
              icon={<AlertCircle className="w-3.5 h-3.5" />}
              label="Priority"
              value={
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    order.priority === 'STAT'
                      ? 'bg-red-100 text-red-700'
                      : order.priority === 'URGENT'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {order.priority}
                </span>
              }
            />
            <InfoRow icon={<Hash className="w-3.5 h-3.5" />} label="Lab ID" value={order.lab_id} />
            <InfoRow
              icon={<Barcode className="w-3.5 h-3.5" />}
              label="Accession No."
              value={
                <span className="font-mono text-xs tracking-widest bg-gray-200 px-2 py-0.5 rounded">
                  {order.accession_number}
                </span>
              }
            />
          </div>

          {/* Barcode visual */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-2">Barcode</p>
            <div className="flex items-end gap-px h-10">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-sm"
                  style={{
                    width: i % 3 === 0 ? '3px' : '1.5px',
                    height: `${60 + Math.sin(i * 0.7) * 30}%`,
                  }}
                />
              ))}
            </div>
            <p className="font-mono text-[10px] text-gray-500 mt-1 tracking-widest">
              {order.accession_number}
            </p>
          </div>
        </div>

        {/* Workflow Progress Bar */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">
            Workflow Progress
          </h3>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-[#0A6253] z-0 transition-all duration-500"
              style={{
                width:
                  currentStepIdx === 0
                    ? '0%'
                    : `${(currentStepIdx / (WORKFLOW_STEPS.length - 1)) * 100}%`,
              }}
            />

            <div className="relative z-10 flex justify-between">
              {WORKFLOW_STEPS.map((step, idx) => {
                const completed = isStepCompleted(
                  { ...order },
                  step.key
                );
                const isCurrent =
                  STATUS_ORDER.indexOf(order.status) === idx;
                const ts = getStepTimestamp(order, step.key);

                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center gap-2 flex-1"
                    style={{ maxWidth: '20%' }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        completed
                          ? 'bg-[#0A6253] border-[#0A6253]'
                          : isCurrent
                          ? 'bg-white border-[#0A6253]'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-[#0A6253]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-xs font-medium leading-tight ${
                          completed || isCurrent
                            ? 'text-gray-800'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      {ts && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(ts).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                          <br />
                          {new Date(ts).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Reference Range Side Panel */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 h-full space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Reference Information
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Method</p>
              <p className="text-gray-800 font-medium">{order.method || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Laboratory</p>
              <p className="text-gray-800 font-medium">{order.lab_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Reviewed By</p>
              <div className="flex items-center gap-2">
                <p className="text-gray-800 font-medium">
                  {order.reviewed_by || '—'}
                </p>
                {order.reviewed_by && (
                  <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                    Pathologist
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Reported On</p>
              <p className="text-gray-800 font-medium">
                {fmtShort(order.reported_at)}
              </p>
            </div>
          </div>

          {order.comments && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-1.5">Comments</p>
              <p className="text-sm text-gray-600 italic leading-relaxed">
                "{order.comments}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="text-gray-500 text-xs">{label}:</span>
      <span className="text-gray-800 font-medium text-xs ml-auto">{value}</span>
    </div>
  );
}

// ─── Tab: Results ─────────────────────────────────────────────────────────────

interface ResultsTabProps {
  isLoading: boolean;
  resultGroups: Record<string, LabResult[]>;
  expandedGroups: Record<string, boolean>;
  allExpanded: boolean;
  onExpandAll: () => void;
  onToggleGroup: (group: string) => void;
}

function ResultsTab({
  isLoading,
  resultGroups,
  expandedGroups,
  allExpanded,
  onExpandAll,
  onToggleGroup,
}: ResultsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const groups = Object.keys(resultGroups);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <FlaskConical className="w-10 h-10 opacity-30" />
        <p className="text-sm">No results available for this order.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend + Expand All */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            <span className="font-bold text-blue-600">L</span> = Low
          </span>
          <span>
            <span className="font-bold text-red-600">H</span> = High
          </span>
          <span>
            <span className="font-bold text-red-700">C</span> = Critical
          </span>
          <span>
            <span className="font-bold text-green-600">✓</span> = Normal
          </span>
        </div>
        <button
          onClick={onExpandAll}
          className="text-xs flex items-center gap-1 text-[#0A6253] hover:underline font-medium"
        >
          {allExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Collapse All
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Expand All
            </>
          )}
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-t-lg text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div className="col-span-4">Parameter</div>
        <div className="col-span-2 text-right">Result</div>
        <div className="col-span-1 text-right">Unit</div>
        <div className="col-span-2 text-center">Reference</div>
        <div className="col-span-1 text-center">Status</div>
        <div className="col-span-1 text-center">Trend</div>
        <div className="col-span-1" />
      </div>

      {/* Groups */}
      <div className="border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-100 overflow-hidden">
        {groups.map((group) => {
          const isOpen = expandedGroups[group] ?? false;
          return (
            <div key={group}>
              {/* Group header */}
              <button
                onClick={() => onToggleGroup(group)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#0A6253]/5 hover:bg-[#0A6253]/10 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-[#0A6253]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#0A6253]" />
                  )}
                  <span className="text-sm font-semibold text-[#0A6253]">
                    {group}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({resultGroups[group].length} parameters)
                  </span>
                </div>
                {/* Group summary badge */}
                {resultGroups[group].some((r) =>
                  ['HIGH', 'LOW', 'CRITICAL'].includes(r.status)
                ) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    Abnormal values
                  </span>
                )}
              </button>

              {/* Group rows */}
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {resultGroups[group].map((result) => {
                    const cfg = resultStatusConfig[result.status];
                    const refLow = result.parameter.ref_range_low;
                    const refHigh = result.parameter.ref_range_high;
                    const refStr =
                      refLow != null && refHigh != null
                        ? `${refLow} – ${refHigh}`
                        : refLow != null
                        ? `> ${refLow}`
                        : refHigh != null
                        ? `< ${refHigh}`
                        : '—';

                    return (
                      <div
                        key={result.id}
                        className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50 transition-colors items-center text-sm"
                      >
                        <div className="col-span-4 text-gray-700 font-medium">
                          {result.parameter.name}
                        </div>
                        <div
                          className={`col-span-2 text-right font-bold ${cfg.text}`}
                        >
                          {result.result_value}
                        </div>
                        <div className="col-span-1 text-right text-gray-500 text-xs">
                          {result.parameter.unit || '—'}
                        </div>
                        <div className="col-span-2 text-center text-gray-500 text-xs">
                          {refStr}
                        </div>
                        <div className="col-span-1 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}
                          >
                            {cfg.symbol}
                          </span>
                        </div>
                        <div className="col-span-1 text-center flex justify-center items-center">
                          <Sparkline
                            data={result.history ?? []}
                            status={result.status}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Trends ──────────────────────────────────────────────────────────────

interface TrendsTabProps {
  isLoading: boolean;
  trendData: TrendPoint[];
  uniqueParams: string[];
  selectedParam: string;
  onSelectParam: (p: string) => void;
  resultsLoading: boolean;
  results: LabResult[];
}

function TrendsTab({
  isLoading,
  trendData,
  uniqueParams,
  selectedParam,
  onSelectParam,
  resultsLoading,
  results,
}: TrendsTabProps) {
  // Find ref range for selected param
  const selectedResult = results.find(
    (r) => r.parameter.name === selectedParam
  );
  const refLow = selectedResult?.parameter.ref_range_low ?? null;
  const refHigh = selectedResult?.parameter.ref_range_high ?? null;

  const chartData = trendData.map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    }),
    value: p.value,
  }));

  return (
    <div>
      {/* Parameter selector */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Select Parameter
        </label>
        <select
          value={selectedParam}
          onChange={(e) => onSelectParam(e.target.value)}
          className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A6253] focus:border-[#0A6253] outline-none bg-white"
        >
          <option value="">— Choose a parameter —</option>
          {resultsLoading ? (
            <option disabled>Loading parameters...</option>
          ) : (
            uniqueParams.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))
          )}
        </select>
      </div>

      {!selectedParam && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <TrendingUp className="w-10 h-10 opacity-30" />
          <p className="text-sm">Select a parameter to view its trend chart.</p>
        </div>
      )}

      {selectedParam && isLoading && (
        <Skeleton className="h-72 w-full" />
      )}

      {selectedParam && !isLoading && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <TrendingUp className="w-10 h-10 opacity-30" />
          <p className="text-sm">No trend data available for this parameter.</p>
        </div>
      )}

      {selectedParam && !isLoading && chartData.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                {selectedParam} — 6-Month Trend
              </h3>
              {selectedResult && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Unit: {selectedResult.parameter.unit} · Reference:{' '}
                  {refLow != null && refHigh != null
                    ? `${refLow} – ${refHigh}`
                    : '—'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-[#0A6253] rounded-full inline-block" />
                Value
              </span>
              {refLow != null && refHigh != null && (
                <span className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: 'rgba(10,98,83,0.1)' }}
                  />
                  Reference Range
                </span>
              )}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ fontWeight: 600, color: '#374151' }}
              />
              {/* Reference range band */}
              {refLow != null && refHigh != null && (
                <ReferenceArea
                  y1={refLow}
                  y2={refHigh}
                  fill="rgba(10,98,83,0.08)"
                  strokeOpacity={0}
                />
              )}
              {refLow != null && (
                <ReferenceLine
                  y={refLow}
                  stroke="#0A6253"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              )}
              {refHigh != null && (
                <ReferenceLine
                  y={refHigh}
                  stroke="#0A6253"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0A6253"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0A6253', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#0A6253' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Documents ───────────────────────────────────────────────────────────

interface DocumentsTabProps {
  isLoading: boolean;
  documents: Document[];
  onUploadClick: () => void;
  uploadPending: boolean;
}

function DocumentsTab({
  isLoading,
  documents,
  onUploadClick,
  uploadPending,
}: DocumentsTabProps) {
  const fileTypeColors: Record<string, string> = {
    pdf: 'bg-red-100 text-red-700',
    jpg: 'bg-blue-100 text-blue-700',
    jpeg: 'bg-blue-100 text-blue-700',
    png: 'bg-purple-100 text-purple-700',
    dcm: 'bg-orange-100 text-orange-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Uploaded Documents
        </h3>
        <button
          onClick={onUploadClick}
          disabled={uploadPending}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-medium hover:bg-[#085046] transition-colors disabled:opacity-60"
        >
          {uploadPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploadPending ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!isLoading && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="text-sm">No documents uploaded yet.</p>
          <button
            onClick={onUploadClick}
            className="text-[#0A6253] text-sm hover:underline"
          >
            Upload the first document
          </button>
        </div>
      )}

      {!isLoading && documents.length > 0 && (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {documents.map((doc) => {
            const ext = doc.file_type.toLowerCase().replace('.', '');
            const colorClass =
              fileTypeColors[ext] ?? 'bg-gray-100 text-gray-600';
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colorClass}`}
                    >
                      {ext.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      {doc.size_kb} KB
                    </span>
                    <span className="text-xs text-gray-400">
                      {fmtShort(doc.uploaded_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-2 rounded-lg text-gray-500 hover:text-[#0A6253] hover:bg-[#0A6253]/5 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                    onClick={() =>
                      alert('Delete document — Coming soon')
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({
  isLoading,
  history,
}: {
  isLoading: boolean;
  history: HistoryEntry[];
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <History className="w-10 h-10 opacity-30" />
        <p className="text-sm">No previous results found for this test.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Previous Results — {history[0]?.panel_name}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {history.map((h) => {
          const cfg = overallStatusConfig[h.overall_status] ?? {
            badge: 'bg-gray-100 text-gray-600',
          };
          const statusIcon =
            h.overall_status === 'NORMAL'
              ? '✓'
              : h.overall_status === 'BORDERLINE'
              ? '~'
              : '!';

          return (
            <Link
              key={h.id}
              to={`/laboratory/orders/${h.order_id}`}
              className="block p-4 rounded-xl border border-gray-200 hover:border-[#0A6253] hover:shadow-sm transition-all bg-white group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {fmtShort(h.date)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {h.panel_name}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
                >
                  {statusIcon} {h.overall_status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Order #{h.order_id}</p>
                <span className="flex items-center gap-1 text-xs text-[#0A6253] font-medium group-hover:underline">
                  View <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: QC & Audit ──────────────────────────────────────────────────────────

function QcAuditTab({
  isLoading,
  events,
}: {
  isLoading: boolean;
  events: QcEvent[];
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <Skeleton className="flex-1 h-20" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <ShieldCheck className="w-10 h-10 opacity-30" />
        <p className="text-sm">No QC or audit events recorded.</p>
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    SAMPLE_RECEIVED: 'bg-blue-100 text-blue-700',
    ANALYSIS_STARTED: 'bg-purple-100 text-purple-700',
    RESULT_ENTERED: 'bg-yellow-100 text-yellow-700',
    RESULT_VERIFIED: 'bg-green-100 text-green-700',
    REPORT_RELEASED: 'bg-[#0A6253]/10 text-[#0A6253]',
    QC_PASSED: 'bg-green-100 text-green-700',
    QC_FAILED: 'bg-red-100 text-red-700',
    NOTE_ADDED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-5">
        QC & Audit Trail
      </h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-5">
          {events.map((event, idx) => {
            const colorClass =
              actionColors[event.action] ?? 'bg-gray-100 text-gray-600';
            return (
              <div key={event.id || idx} className="relative pl-12">
                {/* Dot */}
                <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-white border-2 border-[#0A6253] -translate-x-1/2" />

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}
                      >
                        {event.action.replace(/_/g, ' ')}
                      </span>
                      {event.instrument_id && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Instrument: {event.instrument_id}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {fmt(event.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-sm text-gray-700 font-medium">
                      {event.performed_by}
                    </p>
                  </div>

                  {event.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">
                      {event.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
