import React from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  CalendarDays, Users, Clock, CalendarCheck, PhoneCall,
  TrendingUp, TrendingDown, CalendarX, PieChart as PieChartIcon
} from 'lucide-react';
import './ReportsPanels.css';

const appointmentsByDeptData: any[] = [];

const statusBreakdownData: any[] = [];

const STATUS_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

export default function AppointmentsReportsPanel() {
  return (
    <div className="rp-container">
      <div className="rp-header">
        <h1 className="rp-title"><CalendarDays size={32} color="#8b5cf6" /> Appointments Analytics</h1>
        <p className="rp-subtitle">Patient scheduling, attendance rates, and consultation modes</p>
      </div>

      <div className="rp-kpi-grid">
        <div className="rp-kpi-card" style={{ '--kpi-color': '#8b5cf6', '--kpi-bg': '#f5f3ff' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><CalendarCheck size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Total Appointments</h3>
            <p className="rp-kpi-value">0</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>vs last week</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fef2f2' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><CalendarX size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">No-Show Rate</h3>
            <p className="rp-kpi-value">0%</p>
            <div className="rp-kpi-trend rp-trend-down">
              <TrendingUp size={16} className="rp-trend-down" /> <span className="rp-trend-down">0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>needs attention</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#3b82f6', '--kpi-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><PhoneCall size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Telehealth Share</h3>
            <p className="rp-kpi-value">0%</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingUp size={16} /> <span>0%</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>growth</span>
            </div>
          </div>
        </div>

        <div className="rp-kpi-card" style={{ '--kpi-color': '#f59e0b', '--kpi-bg': '#fffbeb' } as React.CSSProperties}>
          <div className="rp-kpi-icon-wrapper"><Clock size={24} /></div>
          <div className="rp-kpi-content">
            <h3 className="rp-kpi-title">Avg Wait Time</h3>
            <p className="rp-kpi-value">0m</p>
            <div className="rp-kpi-trend rp-trend-up">
              <TrendingDown size={16} className="rp-trend-up" /> <span className="rp-trend-up">0m</span> <span className="rp-trend-neutral" style={{fontWeight: 400}}>improvement</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rp-charts-grid">
        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><Users size={20} color="#3b82f6" /> Volume by Department</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appointmentsByDeptData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 12, fontWeight: 500}} width={90} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                  cursor={{fill: '#f1f5f9'}}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 600, paddingTop: '10px'}} />
                <Bar dataKey="inPerson" name="In-Person" fill="#8b5cf6" stackId="a" radius={[0, 0, 0, 0]} barSize={24} />
                <Bar dataKey="telehealth" name="Telehealth" fill="#38bdf8" stackId="a" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rp-chart-card">
          <div className="rp-chart-header">
            <h2 className="rp-chart-title"><PieChartIcon size={20} color="#10b981" /> Appointment Outcomes</h2>
          </div>
          <div className="rp-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {statusBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
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
        <h2 className="rp-table-title"><CalendarDays size={20} color="#0f172a" /> Upcoming Critical Consultations</h2>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Type</th>
              <th>Department</th>
              <th>Provider</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>14:00 (Today)</td>
              <td><span style={{fontWeight: 600}}>John Doe</span></td>
              <td>Follow-up</td>
              <td>Cardiology</td>
              <td>Dr. Alan Smith</td>
              <td><span className="rp-badge rp-badge-success">Confirmed</span></td>
            </tr>
            <tr>
              <td>14:30 (Today)</td>
              <td><span style={{fontWeight: 600}}>Mary Johnson</span></td>
              <td>Initial Consult</td>
              <td>Oncology</td>
              <td>Dr. Susan Lee</td>
              <td><span className="rp-badge rp-badge-warning">Unconfirmed</span></td>
            </tr>
            <tr>
              <td>15:00 (Today)</td>
              <td><span style={{fontWeight: 600}}>Robert Chen</span></td>
              <td>Telehealth</td>
              <td>Neurology</td>
              <td>Dr. Mark Davis</td>
              <td><span className="rp-badge rp-badge-success">Confirmed</span></td>
            </tr>
            <tr>
              <td>15:45 (Today)</td>
              <td><span style={{fontWeight: 600}}>Sarah Williams</span></td>
              <td>Procedure</td>
              <td>Orthopedics</td>
              <td>Dr. James Wilson</td>
              <td><span className="rp-badge rp-badge-info">Checked In</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
