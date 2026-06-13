import React from 'react';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Pill, AlertTriangle, TrendingDown, PackageOpen, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const inventoryData: any[] = [];

const categoryData: any[] = [];

const CATEGORY_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b'];

const lowStockAlerts: any[] = [];

export default function PharmacyReportsPanel() {
  return (
    <div className="p-6 bg-slate-50 min-h-full font-sans">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Pharmacy Analytics</h2>
          <p className="text-slate-500 mt-1">Inventory, dispensing metrics, and stock alerts</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm shadow-indigo-200">
          Generate Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Prescriptions Filled', value: '0', trend: '0%', trendUp: true, icon: Pill, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { title: 'Inventory Valuation', value: '$0', trend: '0%', trendUp: true, icon: PackageOpen, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'Out of Stock Items', value: '0', trend: '0%', trendUp: false, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
          { title: 'Avg Dispense Time', value: '0m', trend: '0m', trendUp: false, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-100' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <span className={`flex items-center text-sm font-bold ${kpi.trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpi.trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {kpi.trend}
              </span>
            </div>
            <div>
              <h4 className="text-3xl font-extrabold text-slate-800 tracking-tight">{kpi.value}</h4>
              <p className="text-sm font-medium text-slate-500 mt-1">{kpi.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Inventory vs Dispensing Volume</h3>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={inventoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="stock" name="Total Stock" fill="url(#colorStock)" stroke="#818cf8" strokeWidth={2} />
                <Bar dataKey="dispensed" name="Dispensed" barSize={20} fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Dispensed by Category</h3>
          <p className="text-sm text-slate-500 mb-6">Distribution of medications this week</p>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Low Stock Alerts</h3>
            <p className="text-sm text-slate-500 mt-1">Medications below reorder threshold</p>
          </div>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View All Inventory</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 font-semibold">Medication ID</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold text-right">Current Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Threshold</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockAlerts.map((alert) => (
                <tr key={alert.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{alert.id}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{alert.name}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{alert.currentStock}</td>
                  <td className="px-6 py-4 text-right text-slate-500">{alert.threshold}</td>
                  <td className="px-6 py-4 text-slate-600">{alert.supplier}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                      alert.status === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {alert.status === 'Critical' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>}
                      {alert.status === 'Warning' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>}
                      {alert.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
