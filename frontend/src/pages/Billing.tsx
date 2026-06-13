import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import { 
  FileText, Wallet, Banknote, FileWarning, ShieldCheck, PiggyBank,
  ArrowUpRight, ArrowDownRight, User, Bed, Pill, FlaskConical, CreditCard,
  RotateCcw, FileBarChart, ReceiptText, MoreVertical, AlertCircle, ChevronDown,
  Target, AlertTriangle, TrendingUp, Search, Bell, MessageSquare
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Billing() {
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['billing-dashboard'],
    queryFn: () => billingApi.getDashboard().then((res) => res.data),
  });

  const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['billing-transactions'],
    queryFn: () => billingApi.getTransactions().then((res) => res.data),
  });

  const { data: insights, isLoading: isInsightsLoading } = useQuery({
    queryKey: ['billing-insights'],
    queryFn: () => billingApi.getInsights().then((res) => res.data),
  });

  if (isDashboardLoading || isTransactionsLoading || isInsightsLoading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-[#0A6253] border-t-transparent rounded-full" /></div>;
  }

  // Handle pagination objects if present
  const metrics = dashboard?.metrics || {};
  const charts = dashboard?.charts || {};
  const ageing = dashboard?.ageing || {};
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.results || []);
  const aiInsights = Array.isArray(insights) ? insights : (insights?.results || []);

  const departmentColors = ['#0A6253', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#9CA3AF'];

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* ── HEADER ── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time overview of revenue and collections</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 shadow-sm">
            <CalendarIcon /> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard 
          title="Today's Revenue" 
          value={formatCurrency(metrics.revenue_today || 0)} 
          subtext={`↑ ${metrics.revenue_vs_yesterday_pct || 0}% vs yesterday`}
          icon={<FileText size={24} className="text-emerald-600" />}
          bgColor="bg-emerald-50"
          subtextColor="text-emerald-600"
        />
        <KPICard 
          title="Pending Payments" 
          value={formatCurrency(metrics.pending_payments_total || 0)} 
          subtext={`${metrics.pending_invoices_count || 0} invoices`}
          icon={<Wallet size={24} className="text-orange-500" />}
          bgColor="bg-orange-50"
          subtextColor="text-orange-600"
        />
        <KPICard 
          title="Collected Today" 
          value={formatCurrency(metrics.collected_today || 0)} 
          subtext={`↑ ${metrics.collection_vs_yesterday_pct || 0}% vs yesterday`}
          icon={<Banknote size={24} className="text-[#0A6253]" />}
          bgColor="bg-teal-50"
          subtextColor="text-emerald-600"
        />
        <KPICard 
          title="Refund Requests" 
          value={metrics.refund_requests_total || 0} 
          subtext={`${metrics.refund_pending_approval_count || 0} pending approval`}
          icon={<FileWarning size={24} className="text-red-500" />}
          bgColor="bg-red-50"
          subtextColor="text-red-500"
        />
        <KPICard 
          title="Insurance Claims" 
          value={metrics.insurance_claims_total || 0} 
          subtext={`${metrics.insurance_claims_pending_count || 0} Pending`}
          icon={<ShieldCheck size={24} className="text-blue-500" />}
          bgColor="bg-blue-50"
          subtextColor="text-blue-500"
        />
        <KPICard 
          title="Outstanding Balance" 
          value={formatCurrency(metrics.outstanding_balance || 0)} 
          subtext={`${metrics.outstanding_invoices_count || 0} invoices`}
          icon={<PiggyBank size={24} className="text-emerald-600" />}
          bgColor="bg-emerald-50"
          subtextColor="text-emerald-600"
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Revenue vs Collection Line Chart */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Revenue vs Collection</h3>
              <AlertCircle size={14} className="text-gray-400" />
            </div>
            <select className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.revenue_vs_collection_30d || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }} 
                  tickFormatter={(val) => `₹${val/100000}L`}
                  dx={-10}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), '']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Line type="monotone" name="Revenue" dataKey="revenue" stroke="#0A6253" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Collection" dataKey="collection" stroke="#34D399" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department-wise Revenue Donut Chart */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-6">Department-wise Revenue (Today)</h3>
          <div className="flex items-center justify-between h-64 relative">
            <div className="w-1/2 h-full absolute left-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.department_revenue_today || []}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {(charts.department_revenue_today || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={departmentColors[index % departmentColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-500 font-medium">Total</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(metrics.revenue_today || 0)}</span>
              </div>
            </div>
            
            <div className="w-1/2 pl-4 flex flex-col justify-center gap-3 ml-auto z-10">
              {(charts.department_revenue_today || []).map((entry: any, index: number) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: departmentColors[index % departmentColors.length] }} />
                    <span className="text-gray-600 truncate w-20">{entry.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <QuickActionButton icon={<User size={16} />} label="New OPD Bill" />
            <QuickActionButton icon={<Bed size={16} />} label="New IPD Bill" />
            <QuickActionButton icon={<Pill size={16} />} label="Pharmacy Bill" />
            <QuickActionButton icon={<FlaskConical size={16} />} label="Lab Bill" />
            <QuickActionButton icon={<CreditCard size={16} />} label="Receive Payment" />
            <QuickActionButton icon={<RotateCcw size={16} />} label="Refund Request" />
            <QuickActionButton icon={<FileBarChart size={16} />} label="Day End Report" />
            <QuickActionButton icon={<ReceiptText size={16} />} label="GST Report" />
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Recent Transactions */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900">Recent Transactions</h3>
            <div className="flex items-center gap-4 text-sm font-medium">
              <button className="text-[#0A6253] border-b-2 border-[#0A6253] pb-1">All</button>
              <button className="text-gray-500 hover:text-gray-900 pb-1">Invoices</button>
              <button className="text-gray-500 hover:text-gray-900 pb-1">Payments</button>
              <button className="text-gray-500 hover:text-gray-900 pb-1">Refunds</button>
              <button className="text-gray-400 hover:text-gray-900 ml-4 flex items-center gap-1">View All <ArrowUpRight size={14} /></button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500 font-semibold text-xs border-b border-gray-100">
                <tr>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Invoice / Receipt</th>
                  <th className="pb-3">Patient</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Time</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.slice(0,5).map((txn: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-2 font-medium">
                        {txn.type === 'Invoice' ? <FileText size={16} className="text-[#0A6253]" /> :
                         txn.type === 'Payment' ? <CreditCard size={16} className="text-emerald-500" /> :
                         <RotateCcw size={16} className="text-red-500" />}
                        <span className={txn.type === 'Invoice' ? 'text-[#0A6253]' : txn.type === 'Payment' ? 'text-emerald-600' : 'text-red-600'}>{txn.type}</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-gray-600">{txn.id}</td>
                    <td className="py-3">
                      <div className="font-semibold text-gray-900">{txn.patient_name}</div>
                      <div className="text-[10px] text-gray-500">MRN: {txn.mrn}</div>
                    </td>
                    <td className="py-3 text-gray-600">{txn.department}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">₹{txn.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        txn.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 
                        txn.status === 'Pending' ? 'bg-orange-50 text-orange-700' : 
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      <div>{txn.date}</div>
                      <div className="text-[10px]">{txn.time}</div>
                    </td>
                    <td className="py-3 text-right">
                      <button className="text-gray-400 hover:text-gray-900"><MoreVertical size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-gray-500">Showing 1 to 5 of 25 transactions</div>
        </div>

        {/* Outstanding by Ageing */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="font-bold text-gray-900">Outstanding by Ageing</h3>
            <AlertCircle size={14} className="text-gray-400" />
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">0 - 30 Days</span>
              <span className="font-bold text-[#0A6253]">₹ {ageing['0_30_days']?.toLocaleString('en-IN') || '0'}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
              <span className="text-gray-600 font-medium">31 - 60 Days</span>
              <span className="font-bold text-orange-500">₹ {ageing['31_60_days']?.toLocaleString('en-IN') || '0'}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
              <span className="text-gray-600 font-medium">61 - 90 Days</span>
              <span className="font-bold text-orange-500">₹ {ageing['61_90_days']?.toLocaleString('en-IN') || '0'}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
              <span className="text-gray-600 font-medium">90+ Days</span>
              <span className="font-bold text-red-600">₹ {ageing['90_plus_days']?.toLocaleString('en-IN') || '0'}</span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
            <span className="font-bold text-gray-900 text-sm">Total Outstanding</span>
            <span className="font-bold text-gray-900 text-lg">₹ {ageing['total_outstanding']?.toLocaleString('en-IN') || '0'}</span>
          </div>
        </div>

        {/* AI Insights */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900">AI Insights</h3>
            <button className="text-xs text-[#0A6253] font-semibold hover:underline">View all</button>
          </div>
          
          <div className="flex flex-col gap-3">
            {/* Insights will be loaded dynamically */}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── SUBCOMPONENTS ──

function KPICard({ title, value, subtext, icon, bgColor, subtextColor }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <div>
        <h4 className="text-xl font-bold text-gray-900">{value}</h4>
        <p className={`text-xs font-bold mt-1 ${subtextColor}`}>{subtext}</p>
      </div>
    </div>
  );
}

function QuickActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex items-center gap-3 px-4 py-2.5 w-full border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 hover:text-[#0A6253] group">
      <div className="text-[#0A6253] group-hover:scale-110 transition-transform">{icon}</div>
      {label}
    </button>
  );
}

function InsightCard({ icon, title, desc, color }: any) {
  const colorMap: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${colorMap[color]} bg-opacity-50 cursor-pointer hover:bg-opacity-100 transition-all group`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <h5 className="font-bold text-sm">{title}</h5>
        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{desc}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight size={16} />
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  );
}


