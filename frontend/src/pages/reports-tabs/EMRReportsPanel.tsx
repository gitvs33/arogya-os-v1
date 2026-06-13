import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Database, Activity, AlertTriangle, CheckCircle, FileText, 
  TrendingUp, TrendingDown, Clock, ArrowUpRight
} from 'lucide-react';
import './ReportsPanels.css';

const emrActivityData: any[] = [];

const recordTypesData: any[] = [];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function EMRReportsPanel() {
  return (
    <div className="rp-container">
      <div className="rp-header">
        <h1 className="rp-title"><Database size={32} color="#3b82f6" /> EMR Systems Overview</h1>
        <p className="rp-subtitle">Real-time analytics and electronic medical record health metrics</p>
      </div>

      <div className="rp-kpi-grid">
        <div className="rp-kpi-card" style={{ '--kpi-color': '#3b82f6', '--kpi-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><FileText size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Total Records</h3>
            <p className="rp-kpi-value">0</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>vs last month</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-bg': '#ecfdf5' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><CheckCircle size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Data Accuracy</h3>
            <p className="rp-kpi-value">0%</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>vs last month</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#f59e0b', '--kpi-bg': '#fffbeb' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><Activity size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Sync Latency</h3>
            <p className="rp-kpi-value">0ms</p>
            <div className="rp-kpi-trend rp-trend-down">
              <TrendingDown size={16} /> <span>0ms</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>improvement</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fef2f2' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><AlertTriangle size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Critical Alerts</h3>
            <p className="rp-kpi-value">0</p>
            <div className="rp-kpi-trend rp-trend-neutral">
              <Clock size={16} /> <span className="rp-trend-neutral" style={{fontWeight: 400}}>Requires attention</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rp-charts-grid">
        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><Activity size={20} color="#3b82f6" /> EMR Read/Write Activity</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emrActivityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWrites" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 600, paddingTop: '10px'}} />
                <Area type="monotone" dataKey="reads" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReads)" />
                <Area type="monotone" dataKey="writes" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWrites)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><Database size={20} color="#8b5cf6" /> Record Distribution</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={recordTypesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {recordTypesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '13px', fontWeight: 600}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rp-table-card">
        <h2 className="rp-table-title"><FileText size={20} color="#0f172a" /> Recent Sync Anomalies</h2>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>System Component</th>
              <th>Event Description</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Anomalies will be loaded dynamically */}
          </tbody>
        </table>
      </div>
    </div>
  );
}
