import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import {
  Users, ClipboardList, Zap, AlertTriangle, TrendingUp, TrendingDown,
  IndianRupee, UserCheck, Activity, ChevronRight, Stethoscope,
  FlaskConical, Pill, ArrowRight, Search, UserPlus, FileText,
  CalendarDays, HeartPulse, Mic, BarChart3, Clock, CheckCircle2,
} from 'lucide-react';
import { appointmentsApi } from '../api/appointments';

/* ────────────────────────────────────────────────
   MedOS — Dashboard
   Wired to real backend endpoints via React Query.
   ──────────────────────────────────────────────── */

// ── Icon mapping ──
const iconMap: Record<string, { icon: any; bg: string; color: string }> = {
  'user-plus': { icon: UserPlus, bg: '#E8F5F0', color: '#0A6253' },
  'activity': { icon: Activity, bg: '#EFF6FF', color: '#3B82F6' },
  'file-text': { icon: FileText, bg: '#FEF3C7', color: '#F59E0B' },
  'alert-triangle': { icon: AlertTriangle, bg: '#FEE2E2', color: '#EF4444' },
};

const insightIconMap: Record<string, { icon: any; bg: string; color: string }> = {
  'alert-triangle': { icon: AlertTriangle, bg: '#FEE2E2', color: '#EF4444' },
  'trending-up': { icon: TrendingUp, bg: '#E8F5F0', color: '#0A6253' },
  'users': { icon: Users, bg: '#EFF6FF', color: '#3B82F6' },
  'clipboard-list': { icon: ClipboardList, bg: '#FEF3C7', color: '#F59E0B' },
};

// ── Stat card icons ──
const statIcons: Record<string, { icon: any; bg: string; color: string; label: string; sublabel?: string }> = {
  total_patients: { icon: Users, bg: '#E8F5F0', color: '#0A6253', label: 'Total Patients', sublabel: 'All time' },
  today_encounters: { icon: ClipboardList, bg: '#EFF6FF', color: '#3B82F6', label: "Today's Encounters", sublabel: '+' },
  active_alerts: { icon: AlertTriangle, bg: '#FEE2E2', color: '#EF4444', label: 'Active Alerts', sublabel: '' },
  pending_invoices: { icon: IndianRupee, bg: '#FEF3C7', color: '#F59E0B', label: 'Pending Invoices', sublabel: '' },
  today_appointments: { icon: CalendarDays, bg: '#F3E8FF', color: '#8B5CF6', label: "Today's Appointments", sublabel: '' },
  active_staff: { icon: UserCheck, bg: '#F0FDF4', color: '#10B981', label: 'Active Staff', sublabel: '' },
};

// ── Quick Actions ──
const quickActions = [
  { label: 'Register Patient', icon: UserPlus, path: '/patients/new' },
  { label: 'Open EMR', icon: FileText, path: '/encounters' },
  { label: 'Appointments', icon: CalendarDays, path: '/appointments' },
  { label: 'Billing', icon: IndianRupee, path: '/billing' },
  { label: 'Pharmacy', icon: Pill, path: '/prescriptions' },
  { label: 'TeleICU', icon: HeartPulse, path: '/teleicu' },
  { label: 'Laboratory', icon: FlaskConical, path: '/laboratory' },
  { label: 'AI Scribe', icon: Mic, path: '/ai-scribe' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
];

export default function Dashboard() {
  // ── Data Queries ──────────────────────────────────────────────────────────
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.kpis().then((r) => r.data),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => dashboardApi.activity({ limit: 15 }).then((r) => r.data),
  });

  const { data: patientFlowData, isLoading: flowLoading } = useQuery({
    queryKey: ['dashboard-patient-flow'],
    queryFn: () => dashboardApi.patientFlow().then((r) => r.data),
  });

  const { data: departmentData, isLoading: deptLoading } = useQuery({
    queryKey: ['dashboard-departments'],
    queryFn: () => dashboardApi.departmentOverview().then((r) => r.data),
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: () => dashboardApi.insights().then((r) => r.data),
  });

  const { data: appointmentsData, isLoading: apptLoading } = useQuery({
    queryKey: ['appointments-upcoming'],
    queryFn: () => appointmentsApi.upcoming().then((r) => r.data),
  });

  // ── Data extraction ──────────────────────────────────────────────────────
  const kpis = kpisData || {};
  const activityFeed = Array.isArray(activityData) ? activityData : [];
  const patientFlow = patientFlowData || {};
  const departments = Array.isArray(departmentData) ? departmentData : [];
  const aiInsights = Array.isArray(insightsData) ? insightsData : [];
  const appointments = Array.isArray(appointmentsData) ? appointmentsData : [];

  // ── Derive stat cards from kpis ────────────────────────────────────────────
  const statCards = Object.entries(statIcons).map(([key, config]) => {
    const val = kpis[key] || {};
    return {
      label: config.label,
      sublabel: config.sublabel,
      icon: config.icon,
      iconBg: config.bg,
      iconColor: config.color,
      value: val.value ?? '-',
      change: val.change ?? '-',
      changeDir: val.direction ?? 'neutral',
    };
  });

  // ── Loading Skeleton ────────────────────────────────────────────────────
  const anyLoading = kpisLoading || activityLoading || flowLoading || deptLoading || insightsLoading || apptLoading;

  if (anyLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-[#0A6253] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .dash-grid { display: grid; gap: 20px; }
        .stat-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
        }
        @media (max-width: 1400px) { .stat-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 18px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: box-shadow 0.2s;
        }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .stat-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .stat-label { font-size: 0.75rem; color: #6B7280; font-weight: 500; line-height: 1.3; }
        .stat-label span { color: #9CA3AF; }
        .stat-value { font-size: 1.6rem; font-weight: 700; color: #111827; line-height: 1.2; margin-top: 2px; }
        .stat-change { font-size: 0.7rem; margin-top: 4px; display: flex; align-items: center; gap: 3px; }
        .stat-change.up { color: #059669; }
        .stat-change.down { color: #DC2626; }
        .stat-change.neutral { color: #6B7280; }
        .mid-row { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 20px; }
        @media (max-width: 1200px) { .mid-row { grid-template-columns: 1fr; } }
        .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; overflow: hidden; }
        .card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; }
        .card-title { font-size: 0.95rem; font-weight: 700; color: #111827; }
        .card-link { font-size: 0.78rem; font-weight: 500; color: #0A6253; text-decoration: none; cursor: pointer; }
        .card-body { padding: 0 20px 20px; }
        .card-empty { padding: 40px 20px; text-align: center; color: #9CA3AF; font-size: 0.85rem; }
        .feed-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid #F3F4F6;
        }
        .feed-item:last-child { border-bottom: none; }
        .feed-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .feed-content { flex: 1; min-width: 0; }
        .feed-title { font-size: 0.8rem; font-weight: 600; color: #111827; line-height: 1.3; }
        .feed-desc { font-size: 0.72rem; color: #6B7280; margin-top: 1px; line-height: 1.3; }
        .feed-detail { font-size: 0.68rem; color: #9CA3AF; margin-top: 1px; }
        .feed-time { font-size: 0.68rem; color: #9CA3AF; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
        .dept-item { display: grid; grid-template-columns: 130px 1fr 70px; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F3F4F6; }
        .dept-item:last-child { border-bottom: none; }
        .dept-name { font-size: 0.82rem; font-weight: 600; color: #111827; }
        .dept-sub { font-size: 0.68rem; color: #9CA3AF; }
        .dept-bar-wrap { display: flex; align-items: center; gap: 8px; }
        .dept-bar-bg { flex: 1; height: 8px; background: #F3F4F6; border-radius: 4px; overflow: hidden; }
        .dept-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .dept-pct { font-size: 0.75rem; font-weight: 600; color: #374151; width: 38px; text-align: right; }
        .dept-stat { text-align: right; }
        .dept-stat-val { font-size: 0.78rem; font-weight: 600; color: #111827; }
        .dept-stat-label { font-size: 0.65rem; color: #9CA3AF; }
        .ai-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 12px; margin-bottom: 10px; }
        .ai-card:last-child { margin-bottom: 0; }
        .ai-card-red { background: #FEF2F2; border: 1px solid #FECACA; }
        .ai-card-orange { background: #FFF7ED; border: 1px solid #FED7AA; }
        .ai-card-green { background: #E8F5F0; border: 1px solid #A7F3D0; }
        .ai-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ai-title { font-size: 0.82rem; font-weight: 700; color: #111827; margin-bottom: 2px; }
        .ai-desc { font-size: 0.72rem; color: #6B7280; line-height: 1.4; }
        .bottom-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        @media (max-width: 1200px) { .bottom-row { grid-template-columns: 1fr; } }
        .flow-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .flow-stat { text-align: center; }
        .flow-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
        .flow-label { font-size: 0.7rem; color: #6B7280; }
        .flow-value { font-size: 1.5rem; font-weight: 700; margin-top: 2px; }
        .flow-change { font-size: 0.65rem; margin-top: 2px; display: flex; align-items: center; justify-content: center; gap: 2px; }
        .appt-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F3F4F6; }
        .appt-item:last-child { border-bottom: none; }
        .appt-time { font-size: 0.75rem; font-weight: 500; color: #6B7280; width: 64px; flex-shrink: 0; }
        .appt-dot { width: 8px; height: 8px; border-radius: 50%; background: #0A6253; flex-shrink: 0; }
        .appt-info { flex: 1; min-width: 0; }
        .appt-name { font-size: 0.8rem; font-weight: 600; color: #111827; }
        .appt-detail { font-size: 0.68rem; color: #9CA3AF; }
        .appt-badge { font-size: 0.65rem; font-weight: 500; padding: 3px 10px; border-radius: 12px; background: #E8F5F0; color: #0A6253; flex-shrink: 0; }
        .qa-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .qa-item {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 14px 8px; border-radius: 12px; border: 1px solid #E5E7EB;
          background: #fff; cursor: pointer; transition: all 0.2s; text-decoration: none;
        }
        .qa-item:hover { border-color: #0A6253; background: #F0FDF9; box-shadow: 0 2px 8px rgba(10,98,83,0.08); }
        .qa-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #F0F7F4; color: #0A6253; }
        .qa-label { font-size: 0.7rem; font-weight: 500; color: #374151; text-align: center; }
        .dept-header-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; }
        .view-full-link { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 500; color: #0A6253; text-decoration: none; padding: 10px 20px 16px; cursor: pointer; }
      `}</style>

      <div className="dash-grid">
        {/* ── Stat Cards ── */}
        <div className="stat-row">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.iconBg }}>
                <s.icon size={20} color={s.iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <div className="stat-label">
                  {s.label} {s.sublabel && <span>{s.sublabel}</span>}
                </div>
                <div className="stat-value">{s.value}</div>
                <div className={`stat-change ${s.changeDir}`}>
                  {s.changeDir === 'up' && <TrendingUp size={12} />}
                  {s.changeDir === 'down' && <TrendingDown size={12} />}
                  {s.changeDir !== 'neutral' ? (
                    <>{s.changeDir === 'up' ? '↑' : '↓'} {s.change} vs yesterday</>
                  ) : (
                    <>— {s.change}</>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Middle Row: Feed | Departments | AI Insights ── */}
        <div className="mid-row">
          {/* Live Activity Feed */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Activity Feed</span>
              <span className="card-link">View all</span>
            </div>
            <div className="card-body">
              {activityFeed.length === 0 ? (
                <div className="card-empty">No recent activity</div>
              ) : (
                activityFeed.map((item, i) => {
                  const iconCfg = iconMap[item.icon] || { icon: Activity, bg: '#F3F4F6', color: '#6B7280' };
                  const IconComp = iconCfg.icon;
                  return (
                    <div key={i} className="feed-item">
                      <div className="feed-icon" style={{ background: iconCfg.bg }}>
                        <IconComp size={16} color={iconCfg.color} strokeWidth={2} />
                      </div>
                      <div className="feed-content">
                        <div className="feed-title">{item.title}</div>
                        <div className="feed-desc">{item.description}</div>
                        {item.detail && <div className="feed-detail">{item.detail}</div>}
                      </div>
                      <div className="feed-time">{item.time}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Department Overview */}
          <div className="card">
            <div className="dept-header-row">
              <span className="card-title">Department Overview</span>
            </div>
            <div className="card-body">
              {departments.length === 0 ? (
                <div className="card-empty">No department data</div>
              ) : (
                departments.map((d) => (
                  <div key={d.name} className="dept-item">
                    <div>
                      <div className="dept-name">{d.name}</div>
                      <div className="dept-sub">{d.sub}</div>
                    </div>
                    <div className="dept-bar-wrap">
                      <div className="dept-bar-bg">
                        <div className="dept-bar-fill" style={{ width: `${Math.min(d.pct, 100)}%`, background: d.pct >= 80 ? '#DC2626' : '#0A6253' }} />
                      </div>
                      <span className="dept-pct">{d.pct}%</span>
                    </div>
                    <div className="dept-stat">
                      <div className="dept-stat-val">{d.stat}</div>
                      <div className="dept-stat-label">{d.statLabel}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">AI Insights</span>
            </div>
            <div className="card-body">
              {aiInsights.length === 0 ? (
                <div className="card-empty">No insights yet</div>
              ) : (
                aiInsights.map((insight, i) => {
                  const severity = insight.severity || 'green';
                  const bgClass = severity === 'red' ? 'ai-card-red' : severity === 'orange' ? 'ai-card-orange' : 'ai-card-green';
                  const iconCfg = insightIconMap[insight.icon] || { icon: BarChart3, bg: '#F3F4F6', color: '#6B7280' };
                  const IconComp = iconCfg.icon;
                  return (
                    <div key={i} className={`ai-card ${bgClass}`}>
                      <div className="ai-icon" style={{ background: iconCfg.bg }}>
                        <IconComp size={18} color={iconCfg.color} strokeWidth={2} />
                      </div>
                      <div>
                        <div className="ai-title">{insight.title}</div>
                        <div className="ai-desc">{insight.description}</div>
                      </div>
                      <ChevronRight size={18} className="ml-auto text-gray-300 flex-shrink-0 self-center" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Patient Flow | Appointments | Quick Actions ── */}
        <div className="bottom-row">
          {/* Patient Flow */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Patient Flow (Today)</span>
            </div>
            <div className="card-body">
              {Object.keys(patientFlow).length === 0 ? (
                <div className="card-empty">No patient flow data</div>
              ) : (
                <div className="flow-stats">
                  {Object.entries(patientFlow).map(([key, f]: [string, any]) => {
                    const colors: Record<string, string> = {
                      admissions: '#0A6253',
                      opd_visits: '#3B82F6',
                      discharges: '#10B981',
                      bed_occupancy: '#8B5CF6',
                    };
                    const labels: Record<string, string> = {
                      admissions: 'Admissions',
                      opd_visits: 'OPD Visits',
                      discharges: 'Discharges',
                      bed_occupancy: 'Bed Occupancy',
                    };
                    const color = colors[key] || '#6B7280';
                    return (
                      <div key={key} className="flow-stat">
                        <div className="flow-label">
                          <span className="flow-dot" style={{ background: color }} />
                          {labels[key] || key}
                        </div>
                        <div className="flow-value" style={{ color }}>{f.value}</div>
                        <div className="flow-change" style={{ color: f.direction === 'up' ? '#059669' : '#DC2626' }}>
                          {f.direction === 'up' ? '↑' : '↓'} {f.change}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upcoming Appointments</span>
              <Link to="/appointments" className="card-link">View all</Link>
            </div>
            <div className="card-body">
              {appointments.length === 0 ? (
                <div className="card-empty">No upcoming appointments</div>
              ) : (
                appointments.map((a, i) => (
                  <div key={a.id || i} className="appt-item">
                    <div className="appt-time">{a.appointment_time?.slice(0, 5) || '-'}</div>
                    <div className="appt-dot" />
                    <div className="appt-info">
                      <div className="appt-name">{a.patient_name || 'Patient'}</div>
                      <div className="appt-detail">{a.department || ''} • {a.doctor_name || 'Unassigned'}</div>
                    </div>
                    <div className="appt-badge">{a.status?.replace('_', ' ') || 'SCHEDULED'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            <div className="card-body">
              <div className="qa-grid">
                {quickActions.map((qa) => (
                  <Link key={qa.label} to={qa.path} className="qa-item">
                    <div className="qa-icon">
                      <qa.icon size={18} strokeWidth={1.8} />
                    </div>
                    <span className="qa-label">{qa.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
