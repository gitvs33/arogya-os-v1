import React from 'react';
import { BrainCircuit, Zap, ShieldAlert, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';

const kpiData: any[] = [];

const influxData: any[] = [];

const anomalyData: any[] = [];

const recommendations: any[] = [];

export default function AIInsightsPanel() {
  return (
    <div className="space-y-6">
      {/* Header section with Sparkles */}
      <div className="flex items-center space-x-3 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-xl shadow-md text-white">
        <Sparkles size={32} className="text-violet-200" />
        <div>
          <h2 className="text-xl font-bold">AI Co-Pilot is Active</h2>
          <p className="text-violet-100 text-sm mt-1">Analyzing 2.4M data points in real-time to optimize hospital operations.</p>
        </div>
      </div>

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
        {/* Expected vs Actual */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Patient Influx: Predicted vs Actual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={influxData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: 'rgba(0,0,0,0.04)'}}
                />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                <Bar dataKey="actual" name="Actual Patients" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="predicted" name="AI Prediction" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4, strokeWidth: 2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Real-time Anomaly Detection</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" dataKey="x" name="Time" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <YAxis type="number" dataKey="y" name="Variance" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Scatter name="Anomalies" data={anomalyData} fill="#f43f5e" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Key AI Recommendations</h3>
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 border border-gray-100 transition-colors hover:bg-violet-50 hover:border-violet-100">
              <div className="mt-1">
                <CheckCircle2 className={`w-6 h-6 ${rec.impact === 'High' ? 'text-violet-600' : 'text-blue-500'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-semibold text-gray-800">{rec.title}</h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rec.impact === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {rec.impact} Impact
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{rec.desc}</p>
                <div className="mt-3 flex space-x-3">
                  <button className="px-4 py-1.5 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-violet-600 transition-colors shadow-sm">
                    Review Details
                  </button>
                  <button className="px-4 py-1.5 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm">
                    Apply Action
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
