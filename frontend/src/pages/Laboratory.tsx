import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  FlaskConical, Plus, Printer, Settings2, Search, Filter, ChevronDown,
  Eye, Download, MoreVertical, AlertTriangle, Bell, CheckCircle,
  Clock, Activity, ChevronLeft, ChevronRight, BarChart2, Package,
  RefreshCw, UserPlus, Droplets
} from 'lucide-react';
import { labOrdersApi, labDashboardApi, labInventoryApi } from '../api/lab/index';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import LabTemplatesInline from './lab-tabs/LabTemplates';
import LabQueue from './LabQueue';

// ── Types ─────────────────────────────────────────────────────────────────────

type LabOrder = {
  id: string;
  lab_id: string;
  patient: { id: string; full_name: string; age: number; gender: string };
  encounter: { encounter_type: string };
  test_panel: { name: string; short_name: string };
  sample_type: string;
  priority: string;
  status: string;
  ordered_by: { full_name: string };
  department: string;
  ordered_at: string;
  tat_deadline: string;
  tat_remaining_min: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-100',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  UNDER_REVIEW: 'bg-orange-50 text-orange-700 border border-orange-100',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-100',
  ORDERED: 'bg-gray-50 text-gray-700 border border-gray-200',
  SAMPLE_COLLECTED: 'bg-purple-50 text-purple-700 border border-purple-100',
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  UNDER_REVIEW: 'Under Review',
  CRITICAL: 'Critical',
  ORDERED: 'Sample Ordered',
  SAMPLE_COLLECTED: 'Sample Collected',
};

const PRIORITY_STYLES: Record<string, string> = {
  STAT: 'bg-red-100 text-red-700',
  URGENT: 'bg-orange-100 text-orange-700',
  ROUTINE: 'bg-gray-100 text-gray-600',
};

function tatDisplay(minRemaining: number) {
  if (minRemaining == null) return { text: '—', color: 'text-gray-400' };
  if (minRemaining < 0) return { text: 'Overdue', color: 'text-red-600' };
  if (minRemaining < 30) return { text: `${minRemaining}m left`, color: 'text-red-600' };
  if (minRemaining < 120) return { text: `${minRemaining}m left`, color: 'text-orange-500' };
  const h = Math.floor(minRemaining / 60);
  const m = minRemaining % 60;
  return { text: `${h}h ${m}m left`, color: 'text-emerald-600' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, isLoading }: any) {
  const colors: Record<string, string> = {
    emerald: 'text-[#0A6253] bg-emerald-50 border-emerald-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    green: 'text-green-600 bg-green-50 border-green-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-semibold mb-0.5">{label}</p>
        {isLoading ? (
          <div className="h-7 w-14 bg-gray-200 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-black text-gray-900">{value ?? '—'}</p>
        )}
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PatientAvatar({ name, visitType }: { name: string; visitType?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#0A6253] font-bold text-xs flex-shrink-0">
        {name?.charAt(0) || 'P'}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-900">{name || '—'}</p>
        {visitType && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            visitType === 'IPD' ? 'bg-blue-100 text-blue-700' :
            visitType === 'ER' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>{visitType}</span>
        )}
      </div>
    </div>
  );
}

// ── Main Laboratory Page ──────────────────────────────────────────────────────

const MAIN_TABS = [
  'Overview', 'Lab Queue', 'All Tests', 'In Progress', 'Completed',
  'Critical Alerts', 'Reports', 'Quality Control', 'Inventory', 'Templates'
];

// Map tab → status filter param for the API
const TAB_STATUS: Record<string, string | null> = {
  'Overview': null,
  'All Tests': null,
  'Lab Queue': 'ORDERED',
  'In Progress': 'IN_PROGRESS',
  'Completed': 'COMPLETED',
  'Critical Alerts': 'CRITICAL',
  'Reports': 'COMPLETED',
  'Quality Control': null,
  'Inventory': null,
  'Templates': null,
};

export default function Laboratory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Lab Queue');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(1);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  // ── Stats Query ─────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['lab-stats'],
    queryFn: () => labDashboardApi.getDashboardStats().then(r => r.data),
    refetchInterval: 30000,
  });

  // ── Orders Query ────────────────────────────────────────────────────
  const statusParam = TAB_STATUS[activeTab];
  const { data: ordersData, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['lab-orders', activeTab, debouncedSearch, statusFilter, sampleTypeFilter, deptFilter, page],
    queryFn: () => labOrdersApi.listOrders({
      search: debouncedSearch || undefined,
      status: statusFilter || statusParam || undefined,
      sample_type: sampleTypeFilter || undefined,
      department: deptFilter || undefined,
      page,
    }).then(r => r.data),
    enabled: !['Quality Control', 'Inventory', 'Templates'].includes(activeTab),
  });

  // ── Alerts Query ─────────────────────────────────────────────────────
  const { data: alertsData } = useQuery({
    queryKey: ['lab-alerts-sidebar'],
    queryFn: () => labDashboardApi.getAlerts({ is_acknowledged: false, limit: 5 }).then(r => r.data),
    refetchInterval: 15000,
  });

  const orders: LabOrder[] = Array.isArray(ordersData) ? ordersData : (ordersData?.results || []);
  const total: number = ordersData?.count || orders.length;
  const totalPages = Math.ceil(total / 10);
  const alerts: any[] = Array.isArray(alertsData) ? alertsData : (alertsData?.results || []);
  const criticalCount = stats?.critical_alerts ?? alerts.length;

  // ── Render: Quality Control / Inventory redirects ─────────────────

  if (activeTab === 'Inventory') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <LabInventoryInline />
      </LabShell>
    );
  }

  // ── Render: Templates ─────────────────────────────────────────────

  if (activeTab === 'Templates') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm min-h-[500px]">
          <LabTemplatesInline />
        </div>
      </LabShell>
    );
  }

  // ── Render: Overview ──────────────────────────────────────────────

  if (activeTab === 'Overview') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <LabOverview stats={stats} statsLoading={statsLoading} alerts={alerts} setActiveTab={setActiveTab} />
      </LabShell>
    );
  }

  // ── Render: Reports ───────────────────────────────────────────────

  if (activeTab === 'Reports') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <LabReportsInline stats={stats} orders={orders} isLoading={ordersLoading} />
      </LabShell>
    );
  }

  // ── Render: Critical Alerts ───────────────────────────────────────

  if (activeTab === 'Critical Alerts') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <LabAlertsInline alerts={alerts} allOrders={orders} isLoading={ordersLoading} />
      </LabShell>
    );
  }

  // ── Render: Lab Queue ───────────────────────────────────────

  if (activeTab === 'Lab Queue') {
    return (
      <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount}>
        <div className="mt-2">
          <LabQueue />
        </div>
      </LabShell>
    );
  }

  // ── Render: All Tests / In Progress / Completed ──

  return (
    <LabShell activeTab={activeTab} setActiveTab={setActiveTab} criticalCount={criticalCount} stats={stats} statsLoading={statsLoading} alerts={alerts} setActiveTabFromShell={setActiveTab}>
      <div className="flex gap-6">

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">

          {/* KPI Row */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <StatCard icon={<FlaskConical size={22} />} label="Total Orders" value={stats?.total_orders?.toLocaleString()} sub="↑ 18% from yesterday" color="emerald" isLoading={statsLoading} />
            <StatCard icon={<Activity size={22} />} label="In Progress" value={stats?.in_progress} sub="Samples in lab" color="blue" isLoading={statsLoading} />
            <StatCard icon={<CheckCircle size={22} />} label="Completed Today" value={stats?.completed_today} sub="Reports generated" color="green" isLoading={statsLoading} />
            <StatCard icon={<AlertTriangle size={22} />} label="Critical Alerts" value={stats?.critical_alerts} sub="Require immediate attention" color="red" isLoading={statsLoading} />
            <StatCard icon={<Clock size={22} />} label="Pending Reports" value={stats?.pending_reports} sub="Awaiting validation" color="orange" isLoading={statsLoading} />
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={onSearchChange}
                placeholder="Search by patient or test..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-transparent rounded-lg text-sm outline-none focus:bg-white focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253] transition-all"
              />
            </div>
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-600 cursor-pointer hover:bg-white gap-2">
              <span className="text-xs font-semibold text-gray-500">Date Range</span>
              <span className="text-xs font-bold text-gray-800">20 Jun 2026 – 20 Jun 2026</span>
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 outline-none hover:bg-white focus:border-[#0A6253]">
              <option value="">All Status</option>
              <option value="ORDERED">Ordered</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select value={sampleTypeFilter} onChange={e => { setSampleTypeFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 outline-none hover:bg-white focus:border-[#0A6253]">
              <option value="">All Sample Types</option>
              <option value="BLOOD_EDTA">Blood (EDTA)</option>
              <option value="SERUM">Serum</option>
              <option value="URINE">Urine</option>
              <option value="SWAB">Swab</option>
            </select>
            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 outline-none hover:bg-white focus:border-[#0A6253]">
              <option value="">All Departments</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Nephrology">Nephrology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Pulmonology">Pulmonology</option>
            </select>
            <button className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-white hover:text-[#0A6253] transition-colors">
              <Filter size={15} /> Filters
            </button>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Patient Details</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lab ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Test / Panel</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sample</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ordered By</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">TAT</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordersLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                            <FlaskConical size={32} className="text-gray-300" />
                          </div>
                          <p className="text-sm font-bold text-gray-900">No lab orders found</p>
                          <p className="text-xs text-gray-500">Try adjusting your filters or search term</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const tat = tatDisplay(order.tat_remaining_min);
                      return (
                        <tr
                          key={order.id}
                          onClick={() => navigate(`/laboratory/orders/${order.id}`)}
                          className="hover:bg-[#F8FDFB] group cursor-pointer transition-colors"
                        >
                          {/* Patient */}
                          <td className="px-4 py-3">
                            <PatientAvatar
                              name={order.patient?.full_name}
                              visitType={order.encounter?.encounter_type}
                            />
                            <p className="text-[10px] text-gray-400 mt-1 ml-11">
                              {order.patient?.age ? `${order.patient.age}Y` : ''} / {order.patient?.gender?.charAt(0) || ''}
                            </p>
                          </td>

                          {/* Lab ID */}
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono font-bold text-[#0A6253]">{order.lab_id}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(order.ordered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {new Date(order.ordered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>

                          {/* Test */}
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-gray-900">{order.test_panel?.short_name || '—'}</p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[130px]">{order.test_panel?.name}</p>
                          </td>

                          {/* Sample */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Droplets size={14} className="text-red-400 flex-shrink-0" />
                              <p className="text-xs text-gray-700">{order.sample_type?.replace('_', ' ') || '—'}</p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${PRIORITY_STYLES[order.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {order.priority}
                            </span>
                          </td>

                          {/* Ordered By */}
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-gray-900">{order.ordered_by?.full_name || '—'}</p>
                            <p className="text-[10px] text-gray-400">{order.department}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_STYLES[order.status] || 'bg-gray-50 text-gray-700'}`}>
                              {order.status === 'CRITICAL' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />}
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                          </td>

                          {/* TAT */}
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${tat.color}`}>{tat.text}</span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/laboratory/orders/${order.id}`); }}
                                className="p-1.5 hover:bg-emerald-50 hover:text-[#0A6253] text-gray-400 rounded-lg transition-colors"
                                title="View"
                              >
                                <Eye size={15} />
                              </button>
                              {order.status === 'COMPLETED' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); labOrdersApi.downloadReport(order.id); }}
                                  className="p-1.5 hover:bg-emerald-50 hover:text-[#0A6253] text-gray-400 rounded-lg transition-colors"
                                  title="Download Report"
                                >
                                  <Download size={15} />
                                </button>
                              )}
                              <button className="p-1.5 hover:bg-gray-50 text-gray-400 rounded-lg transition-colors">
                                <MoreVertical size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!ordersLoading && totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Showing <strong>{(page - 1) * 10 + 1}</strong> to <strong>{Math.min(page * 10, total)}</strong> of <strong>{total.toLocaleString()}</strong> results
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-[#0A6253] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs font-bold rounded-lg border transition-colors ${page === p ? 'bg-[#0A6253] text-white border-[#0A6253]' : 'bg-white border-gray-200 text-gray-600 hover:border-[#0A6253]'}`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 5 && <span className="text-gray-400 text-xs px-1">...</span>}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-[#0A6253] disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                  <select className="ml-3 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white outline-none hover:border-[#0A6253]">
                    <option>10 / page</option>
                    <option>25 / page</option>
                    <option>50 / page</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-5">
          {/* Today's Overview */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900">Today's Overview</h3>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View all</button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Samples Collected', value: stats?.samples_collected?.toLocaleString() || '—', color: 'text-[#0A6253]' },
                { label: 'Reports Completed', value: stats?.completed_today?.toLocaleString() || '—', color: 'text-[#0A6253]' },
                { label: 'TAT Compliance', value: stats?.tat_compliance_pct ? `${stats.tat_compliance_pct}%` : '—', color: 'text-[#0A6253]' },
                { label: 'Critical Alerts', value: stats?.critical_alerts?.toString() || '—', color: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Alerts Sidebar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900">Critical Alerts</h3>
              <button className="text-xs font-bold text-[#0A6253] hover:underline" onClick={() => setActiveTab('Critical Alerts')}>View all</button>
            </div>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No critical alerts</p>
              ) : alerts.slice(0, 4).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">{a.patient?.full_name}</p>
                    <p className="text-[10px] text-gray-500">{a.alert_message}</p>
                    <p className="text-[10px] text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Plus size={16} />, label: 'New Test Order', action: () => {} },
                { icon: <Droplets size={16} />, label: 'Sample Collection', action: () => setActiveTab('Sample Collection') },
                { icon: <Printer size={16} />, label: 'Print Labels', action: () => {} },
                { icon: <BarChart2 size={16} />, label: 'Daily Reports', action: () => setActiveTab('Reports') },
              ].map(q => (
                <button key={q.label} onClick={q.action}
                  className="flex flex-col items-center gap-1.5 p-3 border border-gray-100 rounded-lg hover:border-[#0A6253] hover:text-[#0A6253] text-gray-600 transition-colors text-center group">
                  <div className="text-gray-400 group-hover:text-[#0A6253]">{q.icon}</div>
                  <span className="text-[10px] font-bold leading-tight">{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </LabShell>
  );
}

// ── Shell Component (Tabs + Page Header) ──────────────────────────────────────

function LabShell({ children, activeTab, setActiveTab, criticalCount, stats, statsLoading, alerts, setActiveTabFromShell }: any) {
  return (
    <div className="w-full max-w-[1500px] mx-auto pb-10">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratory</h1>
          <p className="text-sm text-gray-500 mt-1">Manage lab workflow, tests and reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
            <Printer size={16} /> Print Labels
          </button>
          <Link to="/laboratory/orders/new"
            className="flex items-center gap-2 px-5 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-bold hover:bg-[#084d41] shadow-md transition-colors">
            <Plus size={18} /> New Test Order
          </Link>
          <button className="p-2 border border-gray-200 bg-white rounded-lg text-gray-500 hover:bg-gray-50 shadow-sm">
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {MAIN_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-5 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-[#0A6253] text-[#0A6253]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'Critical Alerts' && criticalCount > 0 ? (
                <span className="flex items-center gap-2">
                  Critical Alerts
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{criticalCount}</span>
                </span>
              ) : tab}
            </button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}

// ── Inline Overview ───────────────────────────────────────────────────────────

function LabOverview({ stats, statsLoading, alerts, setActiveTab }: any) {
  const statusDist = stats?.status_distribution || {};
  const total = stats?.total_orders || 1;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Stats + Donut-like distribution */}
      <div className="col-span-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<FlaskConical size={22} />} label="Total Orders" value={stats?.total_orders?.toLocaleString()} color="emerald" isLoading={statsLoading} />
          <StatCard icon={<Activity size={22} />} label="In Progress" value={stats?.in_progress} color="blue" isLoading={statsLoading} />
          <StatCard icon={<CheckCircle size={22} />} label="Completed Today" value={stats?.completed_today} color="green" isLoading={statsLoading} />
          <StatCard icon={<AlertTriangle size={22} />} label="Critical Alerts" value={stats?.critical_alerts} color="red" isLoading={statsLoading} />
          <StatCard icon={<Clock size={22} />} label="Pending Reports" value={stats?.pending_reports} color="orange" isLoading={statsLoading} />
          <StatCard icon={<BarChart2 size={22} />} label="TAT Compliance" value={stats?.tat_compliance_pct ? `${stats.tat_compliance_pct}%` : '—'} color="emerald" isLoading={statsLoading} />
        </div>
        {/* Distribution bars */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Test Status Distribution</h3>
          {[
            { label: 'Completed', key: 'Completed', color: 'bg-emerald-500' },
            { label: 'In Progress', key: 'In Progress', color: 'bg-blue-500' },
            { label: 'Under Review', key: 'Under Review', color: 'bg-orange-400' },
            { label: 'Critical', key: 'Critical', color: 'bg-red-500' },
          ].map(s => (
            <div key={s.key} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{s.label}</span>
                <span className="font-bold text-gray-900">{statusDist[s.key] ?? 0}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all`}
                  style={{ width: `${statusDist[s.key] ? Math.round((statusDist[s.key] / total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Alerts + Quick Actions */}
      <div className="col-span-4 space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">Critical Alerts</h3>
            <button className="text-xs font-bold text-[#0A6253] hover:underline" onClick={() => setActiveTab('Critical Alerts')}>View all</button>
          </div>
          {alerts.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No active alerts</p> : alerts.slice(0, 5).map((a: any) => (
            <div key={a.id} className="flex items-start gap-2 mb-3 last:mb-0">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-900">{a.patient?.full_name}</p>
                <p className="text-[10px] text-gray-500">{a.alert_message}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Plus size={15} />, label: 'New Test Order' },
              { icon: <Droplets size={15} />, label: 'Sample Collection', action: () => setActiveTab('Sample Collection') },
              { icon: <Printer size={15} />, label: 'Print Labels' },
              { icon: <BarChart2 size={15} />, label: 'Daily Reports', action: () => setActiveTab('Reports') },
            ].map(q => (
              <button key={q.label} onClick={(q as any).action}
                className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg hover:border-[#0A6253] hover:text-[#0A6253] text-gray-600 text-xs font-bold transition-colors">
                <span className="text-gray-400">{q.icon}</span>{q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline Reports ────────────────────────────────────────────────────────────

function LabReportsInline({ stats, orders, isLoading }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle size={22} />} label="Total Reports" value={stats?.completed_today} color="green" />
        <StatCard icon={<Clock size={22} />} label="Pending Validation" value={stats?.pending_reports} color="orange" />
        <StatCard icon={<AlertTriangle size={22} />} label="Critical Flags" value={stats?.critical_alerts} color="red" />
        <StatCard icon={<Activity size={22} />} label="TAT Compliance" value={stats?.tat_compliance_pct ? `${stats.tat_compliance_pct}%` : '—'} color="emerald" />
      </div>
      <div className="flex justify-end gap-3">
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
          <Download size={15} /> Export CSV
        </button>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
          <Printer size={15} /> Export PDF
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Lab ID</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Patient</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Test Panel</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Completed At</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Loading reports...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No completed reports found</td></tr>
            ) : orders.slice(0, 15).map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 text-xs font-mono font-bold text-[#0A6253]">{o.lab_id}</td>
                <td className="px-4 py-3"><PatientAvatar name={o.patient?.full_name} /></td>
                <td className="px-4 py-3 text-xs font-bold text-gray-900">{o.test_panel?.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{o.reported_at ? new Date(o.reported_at).toLocaleString('en-IN') : '—'}</td>
                <td className="px-4 py-3"><span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Completed</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 hover:bg-emerald-50 hover:text-[#0A6253] text-gray-400 rounded-lg transition-colors"><Download size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Inline Critical Alerts ────────────────────────────────────────────────────

function LabAlertsInline({ alerts, allOrders, isLoading }: any) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<AlertTriangle size={22} />} label="Active Alerts" value={alerts.length} color="red" />
        <StatCard icon={<Bell size={22} />} label="Critical" value={alerts.filter((a: any) => a.severity === 'CRITICAL').length} color="red" />
        <StatCard icon={<CheckCircle size={22} />} label="Acknowledged" value={0} color="green" />
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading alerts...</p>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900">No critical alerts</p>
            <p className="text-xs text-gray-500 mt-1">All results are within acceptable ranges</p>
          </div>
        ) : alerts.map((a: any) => (
          <div key={a.id} className="relative pl-5 pr-4 py-4 bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-xl" />
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-600" />
                <p className="text-sm font-bold text-gray-900">{a.patient?.full_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}</span>
                <button className="px-3 py-1 bg-[#0A6253] text-white text-xs font-bold rounded-lg hover:bg-[#084d41]">Acknowledge</button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">{a.alert_message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline Inventory ──────────────────────────────────────────────────────────

function LabInventoryInline() {
  const { data, isLoading } = useQuery({
    queryKey: ['lab-inventory'],
    queryFn: () => labInventoryApi.getInventory().then(r => r.data),
  });
  const items: any[] = Array.isArray(data) ? data : (data?.results || []);
  const lowStock = items.filter(i => i.current_stock <= i.min_stock_threshold);

  return (
    <div className="space-y-5">
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-5 py-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm font-bold text-red-800">{lowStock.length} item{lowStock.length > 1 ? 's are' : ' is'} below minimum stock threshold!</p>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Package size={22} />} label="Total Items" value={items.length} color="emerald" />
        <StatCard icon={<AlertTriangle size={22} />} label="Low Stock" value={lowStock.length} color="red" />
        <StatCard icon={<Clock size={22} />} label="Expiring Soon" value={items.filter(i => i.expiry_date && new Date(i.expiry_date) < new Date(Date.now() + 30 * 86400000)).length} color="orange" />
        <StatCard icon={<CheckCircle size={22} />} label="Well Stocked" value={items.length - lowStock.length} color="green" />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Item Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Stock Level</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Min Threshold</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Loading inventory...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No inventory items found</td></tr>
              ) : items.map((item: any) => {
                const pct = Math.min(100, Math.round((item.current_stock / Math.max(item.min_stock_threshold * 2, 1)) * 100));
                const barColor = item.current_stock <= item.min_stock_threshold ? 'bg-red-500' : item.current_stock <= item.min_stock_threshold * 1.5 ? 'bg-orange-400' : 'bg-emerald-500';
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-bold text-gray-900">{item.item_name}</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{item.item_type}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black ${item.current_stock <= item.min_stock_threshold ? 'text-red-600' : 'text-gray-900'}`}>{item.current_stock} {item.unit}</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{item.min_stock_threshold} {item.unit}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="px-3 py-1 bg-emerald-50 text-[#0A6253] border border-emerald-100 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors">Restock</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
