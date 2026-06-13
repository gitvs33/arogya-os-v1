import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, ResponsiveContainer 
} from 'recharts';
import { 
  Users, AlertTriangle, Bell, ShieldCheck, Video, Phone, Maximize2, 
  ChevronRight, Activity, Thermometer, UserPlus, FileText, BarChart2, 
  Monitor, HelpCircle, ArrowRight, RefreshCw, Wifi
} from 'lucide-react';
import { teleicuApi } from '../api/teleicu';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAlertWebSocket } from '../hooks/useAlertWebSocket';
import AlertToast from '../components/AlertToast';

// ── Helpers ──────────────────────────────────────────────────────────

function getTeleicuWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/teleicu/`;
}

const CHART_PERIOD_OPTIONS = ['1H', '6H', '24H', '7D'];

// ── Sub-components ────────────────────────────────────────────────────

function StatCard({ icon, title, value, subtext, color, isLoading }: any) {
  const colorMap: Record<string, string> = {
    emerald: 'text-[#0A6253] bg-emerald-50 border-emerald-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-xs font-bold text-gray-500 mb-0.5">{title}</h3>
        {isLoading ? (
          <div className="h-6 w-12 bg-gray-200 animate-pulse rounded" />
        ) : (
          <div className="text-xl font-black text-gray-900">{value ?? '—'}</div>
        )}
        <p className={`text-[10px] font-bold ${color === 'red' ? 'text-red-600' : 'text-gray-400'}`}>{subtext}</p>
      </div>
    </div>
  );
}

function MiniChart({ title, dataKey, color, value, data }: any) {
  const chartData = data?.map((d: any) => ({ time: d.time, val: d[dataKey] })) || [];
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{title}</span>
        <span className="text-sm font-black text-gray-900">{value ?? '—'}</span>
      </div>
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActionButton({ icon, label }: any) {
  return (
    <button className="flex items-center gap-2 p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-[#0A6253] hover:text-[#0A6253] transition-colors shadow-sm group">
      <div className="text-gray-400 group-hover:text-[#0A6253]">{icon}</div>
      <span className="text-left leading-tight">{label}</span>
    </button>
  );
}

// ── Main TeleICU Monitor Page ─────────────────────────────────────────

export default function TeleICU() {
  const [activeTab, setActiveTab] = useState('All');
  const [chartPeriod, setChartPeriod] = useState('1H');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [wsPatients, setWsPatients] = useState<any[]>([]);
  const { latestAlert, clearAlert } = useAlertWebSocket();
  const [toastAlert, setToastAlert] = useState<any>(null);

  // ── API Queries ──────────────────────────────────────────────────

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['teleicu-stats'],
    queryFn: () => teleicuApi.getDashboardStats().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: monitored, isLoading: monitoredLoading, refetch: refetchMonitored } = useQuery({
    queryKey: ['teleicu-monitored'],
    queryFn: async () => {
      const [monitoredRes, sessionsRes] = await Promise.all([
        teleicuApi.getMonitoredPatients().then(r => r.data),
        teleicuApi.getSessions({ is_active: 'true' }).then(r => r.data)
      ]);
      
      const monList = Array.isArray(monitoredRes) ? monitoredRes : (monitoredRes?.results || []);
      const sessList = Array.isArray(sessionsRes) ? sessionsRes : (sessionsRes?.results || []);
      
      const combined = [...monList];
      for (const sess of sessList) {
        if (!combined.find(p => p.id === sess.patient_id)) {
          combined.push({
            id: sess.patient_id,
            name: sess.patient_name,
            bed: sess.bed_label,
            ward: sess.ward_name,
            status: sess.acuity_status === 'CRITICAL' ? 'critical' : sess.acuity_status === 'UNSTABLE' ? 'warning' : 'stable',
            acuity_status: sess.acuity_status,
            support_type: sess.support_type,
            vitals: {},
            encounter_id: sess.encounter,
            session_id: sess.id
          });
        }
      }
      return combined;
    },
    refetchInterval: 15000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['teleicu-alerts'],
    queryFn: () => teleicuApi.getAlerts('ACTIVE', 10).then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: consultsData } = useQuery({
    queryKey: ['teleicu-consults'],
    queryFn: () => teleicuApi.getConsults({ status: 'ACTIVE' }).then(r => r.data),
  });

  const { data: timelineData } = useQuery({
    queryKey: ['teleicu-timeline'],
    queryFn: () => teleicuApi.getTimeline(null, 10).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: trendData } = useQuery({
    queryKey: ['teleicu-trend', selectedPatient?.id, chartPeriod],
    queryFn: () => selectedPatient
      ? teleicuApi.getVitalsTrend(selectedPatient.id, chartPeriod).then(r => r.data)
      : null,
    enabled: !!selectedPatient,
  });

  // Combine API patients with WS-updated ones
  const patients: any[] = (() => {
    const base: any[] = Array.isArray(monitored) ? monitored : ((monitored as any)?.results || []);
    if (wsPatients.length === 0) return base;
    return base.map(p => wsPatients.find(w => w.id === p.id) || p);
  })();

  // Auto-select first patient for chart
  useEffect(() => {
    if (!selectedPatient && patients.length > 0) setSelectedPatient(patients[0]);
  }, [patients, selectedPatient]);

  // ── WebSocket ────────────────────────────────────────────────────

  const token = sessionStorage.getItem('medos_token');
  const { isConnected: wsConnected, lastMessage: vitalsMsg } = useWebSocket(
    token ? getTeleicuWsUrl() : null,
  );

  useEffect(() => {
    if (!vitalsMsg?.data) return;
    try {
      const data = JSON.parse(vitalsMsg.data);
      if (data.type === 'vitals_update') {
        setWsPatients(prev => {
          const idx = prev.findIndex(p => p.id === data.patient_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], vitals: data.vitals, acuity_status: data.status };
            return copy;
          }
          return prev;
        });
        refetchMonitored();
      }
      if (data.type === 'initial_state' && Array.isArray(data.patients)) {
        setWsPatients(data.patients);
      }
    } catch { /* noop */ }
  }, [vitalsMsg, refetchMonitored]);

  // Alert toast
  useEffect(() => { if (latestAlert) setToastAlert(latestAlert); }, [latestAlert]);
  const handleDismissToast = useCallback(() => { setToastAlert(null); clearAlert(); }, [clearAlert]);

  // ── Derived data ──────────────────────────────────────────────────

  const stats = statsData || {};
  const activeAlerts: any[] = Array.isArray(alertsData) ? alertsData : (alertsData?.results || []);
  const activeConsults: any[] = Array.isArray(consultsData) ? consultsData : (consultsData?.results || []);
  const timeline: any[] = Array.isArray(timelineData) ? timelineData : (timelineData?.results || []);

  const filteredPatients = patients.filter(p => {
    if (activeTab === 'Critical') return p.acuity_status === 'CRITICAL';
    if (activeTab === 'Stable') return p.acuity_status === 'STABLE';
    if (activeTab === 'On Ventilator') return p.support_type === 'VENTILATOR';
    return true;
  });

  // Build tab labels with counts
  const tabLabels = [
    `All (${patients.length})`,
    `Critical (${patients.filter(p => p.acuity_status === 'CRITICAL').length})`,
    `Stable (${patients.filter(p => p.acuity_status === 'STABLE').length})`,
    `On Ventilator (${patients.filter(p => p.support_type === 'VENTILATOR').length})`,
  ];
  const tabKeys = ['All', 'Critical', 'Stable', 'On Ventilator'];

  const statusStyle = (s: string) => {
    if (s === 'CRITICAL') return 'bg-red-50 text-red-700';
    if (s === 'UNSTABLE') return 'bg-orange-50 text-orange-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto pb-10">

      {/* Alert Toast */}
      {toastAlert && <AlertToast alert={toastAlert} onDismiss={handleDismissToast} />}

      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TeleICU Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time monitoring of critical care patients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* WS Status */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${wsConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            {wsConnected ? 'Live' : 'Offline'}
          </span>
          <select className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 outline-none hover:bg-gray-50">
            <option>All ICUs</option>
          </select>
          <select className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 outline-none hover:bg-gray-50">
            <option>All Status</option>
            <option>Critical</option>
            <option>Stable</option>
          </select>
          <button onClick={() => refetchMonitored()} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#0A6253] border border-emerald-100 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard icon={<Users size={24} />} title="Total Patients" value={stats.total_patients ?? patients.length} subtext={`Across ${stats.total_wards ?? '—'} ICUs`} color="emerald" isLoading={statsLoading} />
        <StatCard icon={<AlertTriangle size={24} />} title="Critical Alerts" value={stats.critical_alerts ?? activeAlerts.filter(a => a.severity === 'CRITICAL').length} subtext="Needs immediate attention" color="red" isLoading={statsLoading} />
        <StatCard icon={<Bell size={24} />} title="New Alerts (1h)" value={stats.new_alerts_1h ?? activeAlerts.length} subtext="Last updated just now" color="orange" isLoading={statsLoading} />
        <StatCard icon={<Wifi size={24} />} title="Devices Online" value={stats.devices_online_pct ? `${stats.devices_online_pct}%` : '—'} subtext={stats.devices_detail ?? ''} color="blue" isLoading={statsLoading} />
        <StatCard icon={<Video size={24} />} title="Consults Active" value={stats.active_consults ?? activeConsults.length} subtext="With specialists" color="emerald" isLoading={statsLoading} />
      </div>

      {/* Main 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT (5 cols) ── */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Patient Overview Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-900">Patient Overview</h2>
              <Maximize2 size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
            </div>
            {/* Tabs */}
            <div className="flex px-4 border-b border-gray-100 gap-4 overflow-x-auto">
              {tabKeys.map((key, i) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-3 text-[10px] font-bold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === key ? 'border-[#0A6253] text-[#0A6253]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tabLabels[i]}
                </button>
              ))}
            </div>
            {/* Table */}
            {monitoredLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-[#0A6253]/20 border-t-[#0A6253] rounded-full" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No patients in this category</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Bed / ICU</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Vitals</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map((p: any) => {
                      const v = p.vitals || p.latest_vitals || {};
                      const isSelected = selectedPatient?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={`group cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#0A6253] font-bold text-xs flex-shrink-0">
                                {(p.name || p.patient?.full_name || 'P').charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-900 truncate max-w-[100px]">{p.name || p.patient?.full_name}</p>
                                <p className="text-[10px] text-gray-400">{p.patient?.age ? `${p.patient.age}Y` : ''} {p.patient?.gender || ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-gray-900">{p.bed || p.bed?.bed_number}</p>
                            <p className="text-[10px] text-gray-500">{p.ward || p.bed?.ward?.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${statusStyle(p.acuity_status || p.status || 'STABLE')}`}>
                              {(p.acuity_status || p.status || 'Stable').replace('_', ' ')}
                            </span>
                            <p className="text-[10px] text-gray-500 mt-1">{p.support_type || p.support}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 text-[10px] font-bold">
                              <div className="flex flex-col">
                                <span className="text-gray-400">HR</span>
                                <span className={v.heart_rate > 100 ? 'text-red-500' : 'text-emerald-600'}>{v.heart_rate ?? p.hr ?? '—'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-400">SpO₂</span>
                                <span className={v.oxygen_saturation < 92 ? 'text-red-500' : 'text-emerald-600'}>{v.oxygen_saturation ?? p.spo2 ?? '—'}%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] text-emerald-600 font-bold">Live</span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <ChevronRight size={14} className={`${isSelected ? 'text-[#0A6253]' : 'text-gray-400 group-hover:text-[#0A6253]'}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Camera Feeds */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900">Live Camera Feeds</h2>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((num) => (
                <div key={num} className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-900" />
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">Bed-0{num}</span>
                  </div>
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 size={20} className="text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── CENTER (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Vitals Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
            <div className="p-4 flex justify-between items-start border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Vitals Trend <span className="text-gray-500 font-normal">({selectedPatient?.name || selectedPatient?.patient?.full_name || 'Select a patient'})</span>
                </h2>
              </div>
              <Maximize2 size={16} className="text-gray-400 cursor-pointer" />
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-5">
                {CHART_PERIOD_OPTIONS.map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${chartPeriod === p ? 'bg-[#0A6253] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                ))}
              </div>
              {!selectedPatient ? (
                <p className="text-xs text-gray-400 text-center py-8">Click a patient row to view vitals trend</p>
              ) : (
                <div className="space-y-5">
                  <MiniChart title="Heart Rate (bpm)" dataKey="heart_rate" color="#ef4444"
                    value={selectedPatient?.vitals?.heart_rate ?? selectedPatient?.hr ?? '—'}
                    data={trendData?.data || []} />
                  <MiniChart title="SpO₂ (%)" dataKey="oxygen_saturation" color="#3b82f6"
                    value={selectedPatient?.vitals?.oxygen_saturation ?? selectedPatient?.spo2 ?? '—'}
                    data={trendData?.data || []} />
                  <MiniChart title="Blood Pressure (mmHg)" dataKey="systolic_bp" color="#10b981"
                    value={selectedPatient?.vitals?.systolic_bp ? `${selectedPatient.vitals.systolic_bp}/${selectedPatient.vitals.diastolic_bp}` : selectedPatient?.bp ?? '—'}
                    data={trendData?.data || []} />
                  <MiniChart title="Respiratory Rate (rpm)" dataKey="respiratory_rate" color="#8b5cf6"
                    value={selectedPatient?.vitals?.respiratory_rate ?? '—'}
                    data={trendData?.data || []} />
                </div>
              )}
            </div>
          </div>

          {/* Active Consults */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900">Active Consults</h2>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View All</button>
            </div>
            {activeConsults.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No active consults right now</p>
            ) : (
              <div className="space-y-3">
                {activeConsults.slice(0, 4).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-emerald-100 hover:bg-emerald-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#0A6253] font-bold text-xs flex-shrink-0">
                        {(c.patient?.full_name || 'P').charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{c.patient?.full_name}</p>
                        <p className="text-[10px] text-gray-500">{c.bed_location}</p>
                        <p className="text-[10px] text-gray-400">{c.specialty}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] font-bold text-gray-700">{c.doctor?.full_name || c.doctor}</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded mt-0.5 border border-gray-100">
                        {c.call_type === 'VIDEO' ? <Video size={10} className="text-blue-500" /> : <Phone size={10} className="text-emerald-500" />}
                        {c.call_type === 'VIDEO' ? 'Video' : 'Audio'} Call
                      </div>
                    </div>
                    <button onClick={() => teleicuApi.startCall(c.id)} className="px-3 py-1 bg-[#0A6253] text-white text-[10px] font-bold rounded hover:bg-[#084d41] transition-colors shadow-sm">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT (3 cols) ── */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Critical Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900">Critical Alerts</h2>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View all</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-72">
              {activeAlerts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No active alerts</p>
              ) : activeAlerts.map((a: any) => (
                <div key={a.id} className="relative pl-4 py-3 pr-3 border border-red-100 bg-red-50/30 rounded-lg">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-lg" />
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={11} className="text-red-600" />
                      <p className="text-xs font-bold text-gray-900">{a.patient?.full_name}</p>
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-0.5">{a.bed_location}</p>
                  <p className="text-xs font-bold text-red-700">{a.parameter}</p>
                  <p className="text-[10px] text-gray-600">{a.description}</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <Bell size={14} className="text-gray-400" /> View all alerts <ArrowRight size={14} />
            </button>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900">Recent Notes & Updates</h2>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
              ) : timeline.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#0A6253] mt-1" />
                    {i < timeline.length - 1 && <div className="w-px h-full bg-gray-200 flex-1 mt-1" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="text-xs font-bold text-gray-900">{item.title || item.description}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.author_name || item.event_type}</p>
                    <p className="text-[10px] text-gray-400">{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <ActionButton icon={<UserPlus size={14} />} label="Add New Patient" />
              <ActionButton icon={<AlertTriangle size={14} />} label="Send Alert to Team" />
              <ActionButton icon={<Video size={14} />} label="Start Video Consult" />
              <ActionButton icon={<FileText size={14} />} label="Add Clinical Note" />
              <ActionButton icon={<Monitor size={14} />} label="Ventilator Dashboard" />
              <ActionButton icon={<BarChart2 size={14} />} label="ICU Analytics" />
            </div>
            <div className="mt-3 bg-[#F8FDFB] border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0A6253] flex items-center justify-center flex-shrink-0">
                <HelpCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0A6253]">Need Help?</h4>
                <p className="text-[10px] text-[#0A6253]/70 leading-tight">Open support ticket or chat with our team</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
