import React from 'react';
import { 
  TrendingUp, TrendingDown, Users, Building, Receipt, 
  AlertTriangle, Lightbulb, Beaker, FileSpreadsheet, Eye, Download, CheckCircle, Clock, Activity
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, LineChart, Line, ResponsiveContainer
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

const CHART_COLORS = ['#0A6253', '#E8871E', '#3B82F6', '#8B5CF6', '#10B981', '#9CA3AF'];

function KPICard({ title, value, subtitle, trend, icon: Icon, colorClass, isNegative = false }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border ${colorClass}`}>
        <Icon size={22} />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-gray-500 mb-1">{title}</h3>
        <p className="text-2xl font-black text-gray-900 leading-none mb-1.5">{value}</p>
        <div className="flex items-center gap-1 text-[10px] font-bold">
          {isNegative ? <TrendingDown size={12} className="text-red-500" /> : <TrendingUp size={12} className="text-emerald-500" />}
          <span className={isNegative ? 'text-red-500' : 'text-emerald-500'}>{trend}</span>
          <span className="text-gray-400 font-medium ml-1">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ title, desc, icon: Icon, colorTheme }: any) {
  const themes: any = {
    green: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-600',
    red: 'bg-red-50 border-red-100 text-red-600',
  };
  return (
    <div className="flex items-start justify-between gap-3 p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors cursor-pointer group">
      <div className="flex gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${themes[colorTheme]}`}>
          <Icon size={16} />
        </div>
        <div>
          <h4 className={`text-xs font-bold ${themes[colorTheme].split(' ')[2]}`}>{title}</h4>
          <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPanel({ data, state, setState }: any) {
  const { kpis, revDept, revSpec, revTrend, deptPerf, topDocs, insights, scheduledReports, savedViews } = data;
  const { trendInterval } = state;
  const { setTrendInterval } = setState;

  return (
    <>
      {/* KPI Cards Row */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <KPICard title="Total Revenue" value={`₹ ${((kpis.total_revenue?.value || 0) / 100000).toFixed(1)}L`} subtitle="vs yesterday" trend={`${kpis.total_revenue?.growth_pct > 0 ? '+' : ''}${kpis.total_revenue?.growth_pct || 0}%`} isNegative={kpis.total_revenue?.growth_pct < 0} icon={Receipt} colorClass="bg-emerald-50 text-[#0A6253] border-emerald-100" />
        <KPICard title="Patients Seen" value={kpis.patients_seen?.value || 0} subtitle="vs yesterday" trend={`${kpis.patients_seen?.growth_pct > 0 ? '+' : ''}${kpis.patients_seen?.growth_pct || 0}%`} isNegative={kpis.patients_seen?.growth_pct < 0} icon={Users} colorClass="bg-orange-50 text-orange-600 border-orange-100" />
        <KPICard title="Admissions" value={kpis.admissions?.value || 0} subtitle="vs yesterday" trend={`${kpis.admissions?.growth_pct > 0 ? '+' : ''}${kpis.admissions?.growth_pct || 0}%`} isNegative={kpis.admissions?.growth_pct < 0} icon={Building} colorClass="bg-blue-50 text-blue-600 border-blue-100" />
        <KPICard title="Lab Tests" value={kpis.lab_tests?.value || 0} subtitle="vs yesterday" trend={`${kpis.lab_tests?.growth_pct > 0 ? '+' : ''}${kpis.lab_tests?.growth_pct || 0}%`} isNegative={kpis.lab_tests?.growth_pct < 0} icon={Beaker} colorClass="bg-purple-50 text-purple-600 border-purple-100" />
        <KPICard title="Prescriptions" value={kpis.prescriptions?.value || 0} subtitle="vs yesterday" trend={`${kpis.prescriptions?.growth_pct > 0 ? '+' : ''}${kpis.prescriptions?.growth_pct || 0}%`} isNegative={kpis.prescriptions?.growth_pct < 0} icon={Receipt} colorClass="bg-green-50 text-green-600 border-green-100" />
        <KPICard title="TeleICU Consults" value={kpis.teleicu_consults?.value || 0} subtitle="vs yesterday" trend={`${kpis.teleicu_consults?.growth_pct > 0 ? '+' : ''}${kpis.teleicu_consults?.growth_pct || 0}%`} isNegative={kpis.teleicu_consults?.growth_pct < 0} icon={Activity} colorClass="bg-red-50 text-red-600 border-red-100" />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        
        {/* Column 1: Charts (Span 8) */}
        <div className="col-span-8 grid grid-cols-2 gap-6">
          
          {/* Donut Chart: Revenue by Dept */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm col-span-1">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-gray-900">Revenue Contribution by Department</h3>
            </div>
            <div className="flex items-center h-64">
              <div className="w-1/2 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revDept} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="revenue" stroke="none">
                      {revDept.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => `₹ ${(value/100000).toFixed(1)}L`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 font-bold">Total Revenue</span>
                  <span className="text-lg font-black text-gray-900">₹ {((kpis.total_revenue?.value || 0)/100000).toFixed(1)}L</span>
                </div>
              </div>
              <div className="w-1/2 space-y-2.5">
                {revDept.map((d: any, i: number) => (
                  <div key={d.department} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-gray-600">{d.department}</span>
                    </div>
                    <span className="font-bold text-gray-900">₹ {(d.revenue/100000).toFixed(1)}L <span className="text-gray-400 font-normal ml-1">({d.percentage}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar Chart: Revenue by Specialty */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900">Revenue by Specialty</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revSpec} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="specialty" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 11, fill: '#4B5563', fontWeight: 600 }} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} formatter={(value: number) => `₹ ${(value/100000).toFixed(1)}L`} />
                  <Bar dataKey="revenue" fill="#0A6253" radius={[0, 4, 4, 0]} barSize={24}>
                    {revSpec.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart: Revenue Trend */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-gray-900">Revenue Trend</h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {['Daily', 'Weekly', 'Monthly'].map((period) => (
                  <button key={period} onClick={() => setTrendInterval(period)} className={`px-4 py-1 text-[10px] font-bold rounded-md transition-colors ${trendInterval === period ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(val) => `₹ ${(val/100000).toFixed(0)}L`} />
                  <RechartsTooltip formatter={(value: number) => `₹ ${(value/100000).toFixed(1)}L`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0A6253" strokeWidth={3} dot={{ r: 4, fill: '#0A6253', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="collections" name="Collections" stroke="#3B82F6" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#E8871E" strokeWidth={3} strokeDasharray="3 3" dot={{ r: 4, fill: '#E8871E', strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Tables */}
          <div className="col-span-2 grid grid-cols-2 gap-6">
            
            {/* Dept Performance */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                <h3 className="text-sm font-bold text-gray-900">Department Performance</h3>
                <button className="text-xs font-bold text-[#0A6253] hover:underline">View full report</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Department</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Revenue</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Collection</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {deptPerf.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-xs font-bold text-gray-900">{r.department}</td>
                        <td className="px-5 py-3 text-xs font-medium text-gray-700">₹ {(r.revenue/100000).toFixed(1)}L</td>
                        <td className="px-5 py-3 text-xs font-medium text-gray-700">₹ {(r.collection/100000).toFixed(1)}L</td>
                        <td className={`px-5 py-3 text-xs font-bold text-right ${r.growth > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r.growth > 0 ? '+' : ''}{r.growth}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Doctors */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                <h3 className="text-sm font-bold text-gray-900">Top Performing Doctors</h3>
                <button className="text-xs font-bold text-[#0A6253] hover:underline">View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase w-8 text-center">#</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Doctor</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Revenue</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topDocs.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-xs font-bold text-gray-400 text-center">{i + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {d.doctor_avatar ? (
                              <img src={d.doctor_avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#0A6253] flex items-center justify-center text-[10px] font-bold">
                                {(d.name || d.doctor_name || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-gray-900 leading-tight">{d.name || d.doctor_name || 'Unknown Doctor'}</p>
                              <p className="text-[10px] text-gray-400">{d.specialty}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs font-bold text-gray-900">₹ {(d.revenue_generated/100000).toFixed(1)}L</td>
                        <td className={`px-5 py-3 text-xs font-bold text-right ${d.growth > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {d.growth > 0 ? '+' : ''}{d.growth}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Column 2: Sidebar (Span 4) */}
        <div className="col-span-4 space-y-6 flex flex-col">
          
          {/* AI Insights */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Lightbulb size={16} className="text-orange-500" />
                AI Insights
              </h3>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">View all</button>
            </div>
            <div className="space-y-3">
              {insights.map((ins: any) => {
                const iconMap: any = {
                  'TrendingUp': TrendingUp,
                  'Building': Building,
                  'Beaker': Beaker,
                  'Receipt': Receipt,
                  'AlertTriangle': AlertTriangle
                };
                const colorMap: any = {
                  'INFO': 'blue',
                  'WARNING': 'orange',
                  'CRITICAL': 'red'
                };
                const IconToUse = iconMap[ins.icon_name] || Lightbulb;
                const theme = colorMap[ins.severity] || 'green';
                
                return (
                  <InsightCard key={ins.id} title={ins.title} desc={ins.description} icon={IconToUse} colorTheme={theme} />
                );
              })}
            </div>
          </div>

          {/* Scheduled Reports */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900">Scheduled Reports</h3>
              <button className="text-xs font-bold text-[#0A6253] hover:underline">Manage</button>
            </div>
            <div className="space-y-4">
              {scheduledReports.map((r: any) => (
                <div key={r.id} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet size={16} className="text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{r.report_definition?.name || 'Report'}</p>
                      <p className="text-[10px] text-gray-500">{r.schedule_time} {r.frequency}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Dashboards */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Saved Dashboards</h3>
            <div className="space-y-2">
              {savedViews.map((d: any) => (
                <button key={d.id} className="w-full flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <PieChartIcon size={16} className="text-[#0A6253]" />
                  <span className="text-xs font-bold text-gray-700 flex-1">{d.view_name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
