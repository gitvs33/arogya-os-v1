import React from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Beaker, ClipboardList, Clock, ArrowUp, ArrowDown, Activity } from 'lucide-react';

const volumeData: any[] = [];

const statusData: any[] = [];

const STATUS_COLORS = ['#14b8a6', '#f59e0b', '#64748b'];

const abnormalFindings: any[] = [];

export default function LaboratoryReportsPanel() {
  return (
    <div className="p-6 bg-[#f8fafc] min-h-full font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Laboratory Insights</h2>
          <p className="text-slate-500 mt-1">Test volumes, turnaround times, and critical results</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
            Export CSV
          </button>
          <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm shadow-teal-200">
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Tests (Today)', value: '0', change: '0%', isPositive: true, icon: Beaker, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Avg Turnaround Time', value: '0 hrs', change: '0%', isPositive: true, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Abnormal Findings', value: '0', change: '0%', isPositive: false, icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Pending Results', value: '0', change: '0%', isPositive: true, icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center text-sm font-bold px-2.5 py-1 rounded-full ${stat.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {stat.isPositive ? <ArrowDown className="w-3.5 h-3.5 mr-1" /> : <ArrowUp className="w-3.5 h-3.5 mr-1" />}
                {stat.change}
              </div>
            </div>
            <h4 className="text-3xl font-extrabold text-slate-800">{stat.value}</h4>
            <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Area / Line Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Test Volumes by Department</h3>
            <select className="bg-slate-50 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-3 py-1.5 focus:ring-teal-500 focus:border-teal-500 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Line type="monotone" dataKey="biochemistry" name="Biochemistry" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="hematology" name="Hematology" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="microbiology" name="Microbiology" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Current Test Status</h3>
          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[idx] }}></div>
                  <span className="text-sm font-medium text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Abnormal Findings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <Activity className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Critical & Abnormal Findings</h3>
          </div>
          <button className="text-sm font-bold text-teal-600 hover:text-teal-700">View All Patients</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 font-bold">Patient</th>
                <th className="px-6 py-4 font-bold">Test Name</th>
                <th className="px-6 py-4 font-bold">Result</th>
                <th className="px-6 py-4 font-bold">Ref. Range</th>
                <th className="px-6 py-4 font-bold">Severity</th>
                <th className="px-6 py-4 font-bold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abnormalFindings.map((finding, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{finding.patient}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{finding.test}</td>
                  <td className="px-6 py-4 font-extrabold text-rose-600">{finding.result}</td>
                  <td className="px-6 py-4 font-medium text-slate-500">{finding.refRange}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      finding.severity === 'High' ? 'bg-rose-100 text-rose-700' :
                      finding.severity === 'Medium' ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-semibold">{finding.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
