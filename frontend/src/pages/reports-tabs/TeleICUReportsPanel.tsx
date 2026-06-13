import React from 'react';
import { 
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  Video, HeartPulse, Activity, AlertCircle, Users,
  TrendingUp, TrendingDown, Clock, ShieldAlert, Monitor
} from 'lucide-react';
import './ReportsPanels.css';

const icuAlertsData: any[] = [];

const vitalsTrendData: any[] = [];

export default function TeleICUReportsPanel() {
  return (
    <div className="rp-container">
      <div className="rp-header">
        <h1 className="rp-title"><HeartPulse size={32} color="#ef4444" /> Tele-ICU Command Center</h1>
        <p className="rp-subtitle">Centralized monitoring, vitals tracking, and remote patient management</p>
      </div>

      <div className="rp-kpi-grid">
        <div className="rp-kpi-card" style={{ '--kpi-color': '#8b5cf6', '--kpi-bg': '#f5f3ff' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><Monitor size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Active ICU Beds</h3>
            <p className="rp-kpi-value">0<span style={{fontSize: '14px', color: '#64748b', fontWeight: 600}}>/150</span></p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0% Capacity</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fef2f2' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper">
            <div className="rp-live-indicator"></div>
            <ShieldAlert size={24} />
          </div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Active Interventions</h3>
            <p className="rp-kpi-value">0</p>
            <div className="rp-kpi-trend rp-trend-down">
              <TrendingDown size={16} /> <span>0</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>since last hour</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-bg': '#ecfdf5' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><Clock size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Avg Response Time</h3>
            <p className="rp-kpi-value">0m 0s</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingDown size={16} className="rp-trend-up" /> <span className="rp-trend-up">0s</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>vs target</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#3b82f6', '--kpi-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><Video size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Video Consults</h3>
            <p className="rp-kpi-value">0</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>today</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rp-charts-grid">
        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><AlertCircle size={20} color="#ef4444" /> Alerts Distribution by Hour</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={icuAlertsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                  cursor={{fill: '#f1f5f9'}}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 600, paddingTop: '10px'}} />
                <Bar dataKey="alerts" name="Standard Alerts" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="critical" name="Critical Alerts" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><Activity size={20} color="#10b981" /> Vitals & Clinical Incidents Trend</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vitalsTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[60, 100]} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 600, paddingTop: '10px'}} />
                <Bar yAxisId="right" dataKey="incidents" name="Incidents" fill="#fde047" barSize={20} radius={[4, 4, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="avgHeartRate" name="Avg HR" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                <Line yAxisId="left" type="monotone" dataKey="avgSpO2" name="Avg SpO2" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rp-table-card">
        <h2 className="rp-table-title"><Users size={20} color="#0f172a" /> High-Risk Patients Watchlist</h2>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Location</th>
              <th>Primary Diagnosis</th>
              <th>Current Status</th>
              <th>Last Review</th>
              <th>Assigned Intensivist</th>
            </tr>
          </thead>
          <tbody>
            {/* Watchlist will be loaded dynamically */}
          </tbody>
        </table>
      </div>
    </div>
  );
}
