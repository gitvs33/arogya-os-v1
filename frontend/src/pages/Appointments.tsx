import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../api/appointments';
import { 
  Calendar, Clock, Plus, Search, Filter, MoreVertical, 
  CalendarDays, Video, PhoneCall, User, Users, XCircle, CheckCircle2
} from 'lucide-react';

const typeIconMap: Record<string, any> = {
  TELEMEDICINE: Video,
  OPD: User,
  FOLLOW_UP: PhoneCall,
  EMERGENCY: Calendar,
  REVIEW: Clock,
  PROCEDURE: Calendar,
};

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Fetch appointments ──────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', selectedDate],
    queryFn: () => appointmentsApi.list({ appointment_date: selectedDate }).then((r) => r.data),
  });

  const appointments = useMemo(() => {
    const raw = Array.isArray(data) ? data : data?.results || [];
    if (!searchTerm.trim()) return raw;
    const q = searchTerm.toLowerCase();
    return raw.filter((a: any) =>
      (a.patient_name || '').toLowerCase().includes(q) ||
      (a.doctor_name || '').toLowerCase().includes(q) ||
      (a.department || '').toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  // ── Compute stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const raw = Array.isArray(data) ? data : data?.results || [];
    const total = raw.length;
    const completed = raw.filter((a: any) => a.status === 'COMPLETED').length;
    const cancelled = raw.filter((a: any) => a.status === 'CANCELLED').length;
    const telehealth = raw.filter((a: any) => a.appointment_type === 'TELEMEDICINE').length;
    const inPerson = total - telehealth;
    return { total, completed, cancelled, telehealth, inPerson };
  }, [data]);

  // ── Loading State ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-[#0A6253] border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mx-6 mt-6">
        Failed to load appointments. Please try again.
      </div>
    );
  }

  return (
    <>
      <style>{`
        .appointments-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }
        .header-section {
          display: flex; justify-content: space-between; align-items: center;
          background: #fff; padding: 24px 32px; border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9;
        }
        .title-area h1 {
          font-size: 1.5rem; font-weight: 700; color: #0f172a;
          display: flex; align-items: center; gap: 12px; margin-bottom: 4px;
        }
        .title-area p { color: #64748b; font-size: 0.9rem; }
        .actions-area { display: flex; align-items: center; gap: 16px; }
        .btn-primary {
          background: linear-gradient(135deg, #0A6253 0%, #0D7A68 100%);
          color: white; padding: 10px 20px; border-radius: 10px;
          font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;
          border: none; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(10,98,83,0.2);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(10,98,83,0.3); }
        .content-grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
        @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } }
        .calendar-sidebar {
          background: #fff; border-radius: 16px; padding: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; height: fit-content;
        }
        .calendar-sidebar h2 { font-size: 1.1rem; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
        .date-input {
          width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px;
          font-family: inherit; color: #334155; margin-bottom: 24px;
        }
        .stats-box { background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .stats-box-title { font-size: 0.8rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .stat-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .stat-item:last-child { margin-bottom: 0; }
        .stat-label { font-size: 0.9rem; color: #334155; }
        .stat-value { font-weight: 600; color: #0f172a; }
        .list-container { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .search-bar { position: relative; width: 300px; }
        .search-bar input {
          width: 100%; padding: 10px 16px 10px 40px; border: 1px solid #e2e8f0;
          border-radius: 10px; font-size: 0.9rem; outline: none; transition: all 0.2s;
        }
        .search-bar input:focus { border-color: #0A6253; box-shadow: 0 0 0 3px rgba(10,98,83,0.1); }
        .search-bar svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .appt-card {
          display: flex; align-items: center; padding: 16px; border: 1px solid #f1f5f9;
          border-radius: 12px; margin-bottom: 12px; transition: all 0.2s;
        }
        .appt-card:hover { border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transform: translateX(4px); }
        .appt-time { width: 100px; flex-shrink: 0; border-right: 2px solid #f1f5f9; padding-right: 16px; margin-right: 16px; }
        .appt-time-main { font-size: 1rem; font-weight: 700; color: #0f172a; }
        .appt-time-sub { font-size: 0.75rem; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        .appt-info { flex: 1; }
        .appt-patient { font-size: 1.05rem; font-weight: 600; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
        .appt-details { font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 12px; }
        .appt-type-badge {
          display: flex; align-items: center; gap: 4px; font-size: 0.75rem;
          padding: 4px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; font-weight: 500;
        }
        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
        .status-SCHEDULED { background: #fef3c7; color: #92400e; }
        .status-CHECKED_IN { background: #dbeafe; color: #1e40af; }
        .status-IN_PROGRESS { background: #dcfce7; color: #166534; }
        .status-COMPLETED { background: #e8f5f0; color: #0A6253; }
        .status-CANCELLED { background: #fee2e2; color: #991b1b; }
        .status-NO_SHOW { background: #fef2f2; color: #dc2626; }
        .appt-actions { margin-left: 20px; }
        .icon-btn {
          background: none; border: none; color: #94a3b8;
          cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s;
        }
        .icon-btn:hover { background: #f1f5f9; color: #0f172a; }
        .card-empty { padding: 60px 20px; text-align: center; color: #9CA3AF; font-size: 0.9rem; }
      `}</style>

      <div className="appointments-page">
        {/* Header */}
        <div className="header-section">
          <div className="title-area">
            <h1><CalendarDays size={28} color="#0A6253" /> Appointments</h1>
            <p>Manage patient scheduling and daily consultations</p>
          </div>
          <div className="actions-area">
            <button className="btn-primary">
              <Plus size={18} /> New Appointment
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="content-grid">
          {/* Sidebar */}
          <div className="calendar-sidebar">
            <h2>Select Date</h2>
            <input 
              type="date" 
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <div className="stats-box">
              <div className="stats-box-title">Daily Summary</div>
              <div className="stat-item">
                <span className="stat-label">Total Scheduled</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Completed</span>
                <span className="stat-value">{stats.completed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cancellations</span>
                <span className="stat-value">{stats.cancelled}</span>
              </div>
            </div>

            <div className="stats-box">
              <div className="stats-box-title">By Type</div>
              <div className="stat-item">
                <span className="stat-label">In-Person</span>
                <span className="stat-value">{stats.inPerson}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Telehealth</span>
                <span className="stat-value">{stats.telehealth}</span>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="list-container">
            <div className="list-header">
              <div className="search-bar">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Search patients, doctors..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="icon-btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Filter size={16} /> Filter
              </button>
            </div>

            <div className="appt-list">
              {appointments.length === 0 ? (
                <div className="card-empty">
                  <CalendarDays size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No appointments for this date</p>
                </div>
              ) : (
                appointments.map((appt: any) => {
                  const TypeIcon = typeIconMap[appt.appointment_type] || User;
                  const statusClass = (appt.status || 'SCHEDULED').replace(/_/g, '-');
                  return (
                    <div key={appt.id} className="appt-card">
                      <div className="appt-time">
                        <div className="appt-time-main">
                          {appt.appointment_time ? appt.appointment_time.slice(0, 5) : '--:--'}
                        </div>
                        <div className="appt-time-sub">
                          <Clock size={12} /> {appt.duration_minutes || 15}min
                        </div>
                      </div>

                      <div className="appt-info">
                        <div className="appt-patient">
                          {appt.patient_name || 'Patient'}
                          <span className="appt-type-badge">
                            <TypeIcon size={12} color="#475569" />
                            {appt.appointment_type || 'OPD'}
                          </span>
                        </div>
                        <div className="appt-details">
                          <span>{appt.doctor_name || 'Unassigned'}</span>
                          <span>•</span>
                          <span>{appt.department || 'General'}</span>
                        </div>
                      </div>

                      <div className={`status-badge status-${statusClass}`}>
                        {appt.status?.replace(/_/g, ' ') || 'SCHEDULED'}
                      </div>

                      <div className="appt-actions">
                        <button className="icon-btn"><MoreVertical size={20} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
