import React from 'react';
import { Bed, Activity, Clock, AlertCircle } from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  ComposedChart, Line, Legend, AreaChart, Area
} from 'recharts';

const kpiData = [
  { title: "Total Beds", value: "0", trend: "0 change", icon: Bed, color: "text-indigo-600", bg: "bg-indigo-100" },
  { title: "Occupancy Rate", value: "0%", trend: "0% vs last week", icon: Activity, color: "text-rose-600", bg: "bg-rose-100" },
  { title: "Avg Wait Time", value: "0m", trend: "0m vs yesterday", icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
  { title: "Critical ER Cases", value: "0", trend: "Normal limits", icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" }
];

const occupancyData: any[] = [];

const admissionDischargeData: any[] = [];

const resources: any[] = [];

export default function OperationsReportsPanel() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center space-x-4 transition-transform hover:scale-[1.02]">
              <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                <h3 className="text-2xl font-bold text-gray-800">{kpi.value}</h3>
                <p className="text-xs font-medium text-gray-400 mt-1">{kpi.trend}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bed Occupancy Rate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">24h Bed Occupancy</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={occupancyData}>
                <defs>
                  <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} domain={[50, 100]} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="occ" name="Occupancy %" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorOcc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Admissions vs Discharges */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Admissions vs Discharges</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={admissionDischargeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: 'rgba(0,0,0,0.04)'}}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                <Bar dataKey="admitted" name="Admitted" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="discharged" name="Discharged" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Department Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="py-3 px-6 font-medium">Department</th>
                <th className="py-3 px-6 font-medium">Status</th>
                <th className="py-3 px-6 font-medium">Utilization</th>
                <th className="py-3 px-6 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resources.map((res) => {
                let statusBadge = "bg-green-50 text-green-600";
                if (res.status === "High") statusBadge = "bg-amber-50 text-amber-600";
                if (res.status === "Critical") statusBadge = "bg-red-50 text-red-600";

                return (
                  <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-800">{res.dept}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge}`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-medium">{res.utilization}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{res.notes}</td>
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
