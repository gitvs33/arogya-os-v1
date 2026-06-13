import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Shield, Building2, UserCog, Clock, HardDrive, 
  CheckCircle2, AlertTriangle, AlertCircle, Info, Lock, Key, 
  MonitorPlay, Eye, Database, CheckSquare, Plus, Settings, Calendar
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { adminApi } from '../../api/adminApi';

// --- ICONS MOCK ---
function FileText(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> }
function DollarSign(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
function Pill(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg> }
function Beaker(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg> }
function Activity(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function Brain(p:any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2h5"/><path d="M5.5 6h13"/><path d="M3.5 10h17"/><path d="M4.5 14h15"/><path d="M7.5 18h9"/><path d="M10.5 22h3"/></svg> }

const MODULE_ICONS: Record<string, any> = {
  'EMR': FileText,
  'Patient Registration': Users,
  'Billing': DollarSign,
  'Pharmacy': Pill,
  'Laboratory': Beaker,
  'TeleICU': Activity,
  'AI Services': Brain
};

// --- COMPONENTS ---
function KPICard({ title, value, subtitle, trendValue, icon: Icon, colorTheme }: any) {
  const themes: any = {
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    gray: 'text-gray-600 bg-gray-50 border-gray-200'
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${themes[colorTheme]}`}>
          {Icon && <Icon size={20} />}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-1">{title}</h3>
        <p className="text-2xl font-black text-gray-900 mb-1.5 leading-none">{value}</p>
        <div className="flex items-center text-xs">
          {trendValue ? (
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <TrendingUp size={12} /> {trendValue}
            </span>
          ) : (
            <span className="font-bold text-gray-400">No change</span>
          )}
          {subtitle && <span className="text-gray-400 ml-1.5">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}

// Simple trending up icon for KPI
function TrendingUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
      <polyline points="16 7 22 7 22 13"></polyline>
    </svg>
  );
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('last_7_days');

  // --- API QUERIES ---
  const { data: statsRes, isError: isStatsError, isLoading: isStatsLoading } = useQuery({ 
    queryKey: ['admin-stats'], 
    queryFn: () => adminApi.getAdminStats().then(r => r.data),
  });
  const { data: chartRes, isLoading: isChartLoading } = useQuery({ queryKey: ['admin-chart', dateRange], queryFn: () => adminApi.getSystemOverviewChart(dateRange).then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: modulesRes } = useQuery({ queryKey: ['admin-modules'], queryFn: () => adminApi.getModuleStatus().then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: alertsRes } = useQuery({ queryKey: ['admin-alerts'], queryFn: () => adminApi.getSystemAlerts().then(r => r.data) });
  const { data: userActRes } = useQuery({ queryKey: ['admin-user-act'], queryFn: () => adminApi.getUserActivity().then(r => r.data) });
  const { data: auditRes } = useQuery({ queryKey: ['admin-audit'], queryFn: () => adminApi.getAuditSummary().then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: secRes } = useQuery({ queryKey: ['admin-sec'], queryFn: () => adminApi.getSecurityOverview().then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: recentRes } = useQuery({ queryKey: ['admin-recent'], queryFn: () => adminApi.getRecentActivities().then(r => r.data) });
  const { data: dbRes } = useQuery({ queryKey: ['admin-db'], queryFn: () => adminApi.getDatabaseStorage().then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: licRes } = useQuery({ queryKey: ['admin-lic'], queryFn: () => adminApi.getLicenseInfo().then(r => r.data), staleTime: 5 * 60 * 1000 });
  const { data: sysRes } = useQuery({ queryKey: ['admin-sys'], queryFn: () => adminApi.getSystemInfo().then(r => r.data), staleTime: 5 * 60 * 1000 });

  // Error state - show explicit failure instead of fake data
  if (isStatsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-bold text-red-700 mb-2">Unable to load dashboard</h2>
          <p className="text-sm text-red-600">
            Could not load dashboard data. Check server status and try again.
          </p>
        </div>
      </div>
    );
  }

  // Skeleton loading state for KPI cards
  if (isStatsLoading) {
    return (
      <div className="pb-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-6 gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gray-100 mb-4 animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded mb-2 animate-pulse" />
              <div className="h-7 w-16 bg-gray-200 rounded mb-1 animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallbacks for individual queries (each can fail independently)
  const kpis = statsRes || {};
  const overviewData = chartRes || [];
  const moduleStatus = modulesRes || [];
  const systemAlerts = alertsRes || [];
  const userActivity = userActRes || [];
  const auditSummary = auditRes || { total_logs: 0, categories: [] };
  const security = secRes || {};
  const recentActivities = recentRes || [];
  const dbStorage = dbRes || {};
  const licenseInfo = licRes || {};
  const systemInfo = sysRes || {};

  // Map backend icons to Lucide components for Recent Activities
  const getRecentIcon = (type: string) => {
    switch (type) {
      case 'user': return UserCog;
      case 'role': return Shield;
      case 'department': return Building2;
      case 'system': return Settings;
      case 'database': return Database;
      default: return Info;
    }
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500">System configuration, user management and security</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <KPICard title="Total Users" value={kpis.total_users?.count || 0} trendValue={kpis.total_users?.growth ? `${kpis.total_users.growth} this month` : ''} icon={Users} colorTheme="green" />
        <KPICard title="Active Users" value={kpis.active_users?.count || 0} subtitle={`${kpis.active_users?.percentage || 0}% of total`} icon={Shield} colorTheme="orange" />
        <KPICard title="Departments" value={kpis.departments?.count || 0} trendValue={kpis.departments?.growth ? `${kpis.departments.growth} this month` : ''} icon={Building2} colorTheme="blue" />
        <KPICard title="Roles" value={kpis.roles?.count || 0} icon={UserCog} colorTheme="purple" />
        <KPICard title="System Uptime" value={`${kpis.system_uptime?.percentage || 0}%`} subtitle="Last 30 days" icon={Clock} colorTheme="green" />
        <KPICard title="Storage Used" value={kpis.storage_used?.used || '0 TB'} subtitle={`of ${kpis.storage_used?.total || '0 TB'} (${kpis.storage_used?.percentage || 0}%)`} icon={HardDrive} colorTheme="orange" />
      </div>

      {/* Row 2: Charts and Status */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        
        {/* System Overview Line Chart */}
        <div className="col-span-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">System Overview</h3>
              <p className="text-[10px] text-gray-500">System activity overview for selected period</p>
            </div>
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#0A6253]"
            >
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
          
          <div className="flex gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><div className="w-3 h-0.5 bg-emerald-600"></div> Logins</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500"><div className="w-3 h-0.5 bg-blue-500 border-dashed border-b"></div> Transactions</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-500"><div className="w-3 h-0.5 bg-red-500 border-dashed border-b"></div> Errors</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overviewData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(val) => `${val/1000}K`} />
                <Tooltip />
                <Line type="monotone" dataKey="logins" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', strokeWidth: 1 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="transactions" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#3B82F6', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#EF4444', strokeWidth: 1 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module Status */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900">Module Status</h3>
            <p className="text-[10px] text-gray-500">Real-time status of all modules</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {moduleStatus.map((mod: any, i: number) => {
              const ModIcon = MODULE_ICONS[mod.name] || Info;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ModIcon size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">{mod.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    mod.status === 'Operational' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                    'text-orange-600 bg-orange-50 border-orange-100'
                  }`}>
                    {mod.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Alerts */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">System Alerts</h3>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View all</button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {systemAlerts.map((alert: any) => (
              <div key={alert.id} className="flex gap-3">
                <div className={`mt-0.5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-500' :
                  alert.severity === 'warning' ? 'text-orange-500' :
                  alert.severity === 'success' ? 'text-emerald-500' : 'text-blue-500'
                }`}>
                  {alert.severity === 'critical' && <AlertTriangle size={16} />}
                  {alert.severity === 'warning' && <AlertCircle size={16} />}
                  {alert.severity === 'info' && <Info size={16} />}
                  {alert.severity === 'success' && <CheckCircle2 size={16} />}
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${
                    alert.severity === 'critical' ? 'text-red-600' :
                    alert.severity === 'warning' ? 'text-orange-600' :
                    alert.severity === 'success' ? 'text-emerald-600' : 'text-blue-600'
                  }`}>{alert.title}</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">{alert.description}</p>
                </div>
                <span className="text-[9px] font-semibold text-gray-400 ml-auto whitespace-nowrap">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 3: User Activity, Audit Log, Quick Actions */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        
        {/* User Activity */}
        <div className="col-span-5 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
            <div>
              <h3 className="text-sm font-bold text-gray-900">User Activity Overview</h3>
              <p className="text-[10px] text-gray-500">Top 5 active users by login count</p>
            </div>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View all</button>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2 text-[10px] font-bold text-gray-500">User</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-gray-500">Role</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-gray-500">Logins</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-gray-500">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userActivity.map((user: any) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#0A6253] flex items-center justify-center text-[10px] font-bold">
                            {user.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-bold text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{user.role}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-900">{user.logins_count}</td>
                    <td className="px-4 py-2.5 text-[10px] text-gray-500">{user.last_login_timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Summary */}
        <div className="col-span-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col relative">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-900">Audit Log Summary</h3>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View all</button>
          </div>
          <div className="flex items-center justify-between flex-1">
            <div className="w-1/2 h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={auditSummary.categories} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="count" stroke="none">
                    {auditSummary.categories?.map((entry: any, index: number) => {
                      const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#9CA3AF'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-gray-500 font-bold">Total Logs</span>
                <span className="text-sm font-black text-gray-900">{(auditSummary.total_logs || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="w-1/2 space-y-2">
              {auditSummary.categories?.map((d: any, index: number) => {
                const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#9CA3AF'];
                const color = colors[index % colors.length];
                return (
                  <div key={d.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-semibold text-gray-600 truncate max-w-[80px]" title={d.name}>{d.name}</span>
                    </div>
                    <div className="text-[10px]">
                      <span className="font-bold text-gray-900">{d.count.toLocaleString()}</span>
                      <span className="text-gray-400 ml-1">({d.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Security Overview Snippet at bottom of Audit card */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-[10px] font-bold text-gray-900 mb-2">Security Overview</h4>
            <p className="text-[9px] text-gray-500 mb-3">All security systems are active and protected</p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-green-50/50 border border-green-100 p-2 rounded-lg">
                <Lock size={14} className="text-emerald-500" />
                <div>
                  <p className="text-[9px] text-gray-500">Password Policy</p>
                  <p className="text-[10px] font-bold text-emerald-700">{security.password_policy || 'Strong'}</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-green-50/50 border border-green-100 p-2 rounded-lg">
                <Shield size={14} className="text-emerald-500" />
                <div>
                  <p className="text-[9px] text-gray-500">2FA Enforcement</p>
                  <p className="text-[10px] font-bold text-emerald-700">{security.two_factor_enforcement || 'Enabled'}</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-green-50/50 border border-green-100 p-2 rounded-lg">
                <Clock size={14} className="text-emerald-500" />
                <div>
                  <p className="text-[9px] text-gray-500">Session Timeout</p>
                  <p className="text-[10px] font-bold text-emerald-700">{security.session_timeout || '30 min'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Add New User', icon: Plus },
              { label: 'Create Role', icon: Shield },
              { label: 'Add Department', icon: Building2 },
              { label: 'System Settings', icon: Settings },
              { label: 'Workflow Builder', icon: CheckSquare },
              { label: 'Backup Now', icon: Database },
              { label: 'View Audit Logs', icon: FileText },
              { label: 'Manage Licenses', icon: Key }
            ].map((action, i) => (
              <button key={i} className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg hover:border-[#0A6253] hover:bg-emerald-50 transition-colors text-left group">
                <action.icon size={14} className="text-gray-400 group-hover:text-[#0A6253]" />
                <span className="text-[10px] font-bold text-gray-700 group-hover:text-[#0A6253]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Activities, Storage, License, System Info */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Recent System Activities */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">Recent System Activities</h3>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View all</button>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[160px]">
            {recentActivities.map((act: any) => {
              const ActIcon = getRecentIcon(act.action_type);
              return (
                <div key={act.id} className="flex items-center gap-3">
                  <ActIcon size={14} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{act.description}</span>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">{act.timestamp.split(',')[1] || act.timestamp}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Database & Storage */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">Database & Storage</h3>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View details</button>
          </div>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 mb-1">Storage Usage</p>
              <h4 className="text-sm font-black text-gray-900">{dbStorage.storage_used_tb || 0} TB <span className="text-[10px] font-normal text-gray-400">/ {dbStorage.storage_total_tb || 0} TB</span></h4>
              <p className="text-[10px] font-bold text-emerald-600 mb-2">
                {dbStorage.storage_total_tb ? ((dbStorage.storage_used_tb / dbStorage.storage_total_tb) * 100).toFixed(1) : 0}% Used
              </p>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dbStorage.storage_total_tb ? (dbStorage.storage_used_tb / dbStorage.storage_total_tb) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div className="flex-1 bg-green-50/50 border border-green-100 rounded-lg p-3 flex flex-col justify-center items-center">
              <Database size={20} className="text-emerald-500 mb-1" />
              <p className="text-[10px] text-gray-500">Database Status</p>
              <h4 className="text-sm font-bold text-emerald-700">{dbStorage.database_status || 'Healthy'}</h4>
              <p className="text-[9px] text-emerald-600 mt-0.5">All systems normal</p>
            </div>
          </div>
          <div className="flex justify-between text-[10px]">
            <div>
              <p className="text-gray-500">Last Backup</p>
              <p className="font-semibold text-gray-900">{dbStorage.last_backup || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Next Backup</p>
              <p className="font-semibold text-gray-900">{dbStorage.next_backup || '-'}</p>
            </div>
          </div>
        </div>

        {/* License & Subscription */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">License & Subscription</h3>
            <button className="text-[10px] font-bold text-[#0A6253] hover:underline">View details</button>
          </div>
          <div className="space-y-3 flex-1">
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Edition</span>
              <span className="text-xs font-bold text-gray-900">{licenseInfo.edition || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Valid Till</span>
              <span className="text-xs font-bold text-gray-900">{licenseInfo.valid_till || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Registered Modules</span>
              <span className="text-xs font-bold text-gray-900">{licenseInfo.registered_modules || 0} / {licenseInfo.total_modules || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Active Users</span>
              <span className="text-xs font-bold text-gray-900">{licenseInfo.active_users || 0} / {licenseInfo.user_limit || 0}</span>
            </div>
          </div>
          <button className="w-full mt-auto bg-[#0A6253] text-white py-2 rounded-lg text-xs font-bold hover:bg-[#084d41] transition-colors">
            Manage Subscription
          </button>
        </div>

        {/* System Information */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 mb-4">System Information</h3>
          <div className="space-y-3 flex-1 bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Version</span>
              <span className="text-xs font-bold text-gray-900">{systemInfo.version || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Environment</span>
              <span className="text-xs font-bold text-gray-900">{systemInfo.environment || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Server Name</span>
              <span className="text-[10px] font-bold text-gray-900">{systemInfo.server_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-[10px] font-semibold text-gray-500">Server Time</span>
              <span className="text-[10px] font-bold text-gray-900">{systemInfo.server_time || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-gray-500">Timezone</span>
              <span className="text-[10px] font-bold text-gray-900">{systemInfo.timezone || '-'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
