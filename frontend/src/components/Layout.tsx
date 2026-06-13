import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  UserPlus,
  CalendarDays,
  HeartPulse,
  Pill,
  IndianRupee,
  FlaskConical,
  Mic,
  BarChart3,
  Shield,
  Settings,
  Search,
  Bell,
  MessageSquare,
  HelpCircle,
  Calendar,
  RefreshCw,
  Leaf,
  Bed,
} from 'lucide-react';
import { useAlertWebSocket } from '../hooks/useAlertWebSocket';
import AlertToast from './AlertToast';
import { hasAnyAccess, canAccessFeature } from '../utils/permissions';
import { getStoredUser } from '../api/client';

const navItems = [
  { path: '/', label: 'Dashboard', Icon: LayoutDashboard, module: 'dashboard' },
  { path: '/encounters', label: 'EMR', Icon: FileText, module: 'encounters' },
  { path: '/patients', label: 'Patient Registration', Icon: UserPlus, module: 'patients' },
  { path: '/appointments', label: 'Appointments', Icon: CalendarDays, module: 'appointments' },
  { path: '/ward', label: 'Ward / IPD', Icon: Bed, module: 'ward', subItems: [
      { path: '/ward', label: 'Bed Map & Overview' },
      { path: '/ward/nursing-station', label: 'Nursing Station' },
      { path: '/ward/morning-round', label: 'Morning Round' },
    ]
  },
  { path: '/teleicu', label: 'TeleICU', Icon: HeartPulse, module: 'teleicu', feature: 'teleicu', subItems: [
      { path: '/teleicu', label: 'Monitor' },
      { path: '/teleicu/patients', label: 'Patients' },
      { path: '/teleicu/alerts', label: 'Alerts' },
      { path: '/teleicu/consults', label: 'Consults' },
      { path: '/teleicu/devices', label: 'Bedside Devices' },
    ]
  },
  { path: '/prescriptions', label: 'Pharmacy', Icon: Pill, module: 'pharmacy', subItems: [
      { path: '/prescriptions', label: 'Prescriptions' },
      { path: '/pharmacy/stock', label: 'Stock & Inventory' },
    ]
  },
  { 
    path: '/billing', 
    label: 'Billing', 
    Icon: IndianRupee,
    module: 'billing',
    subItems: [
      { path: '/billing', label: 'Dashboard' },
      { path: '/billing/invoices', label: 'Invoices' },
      { path: '/billing/opd', label: 'OPD Billing' },
      { path: '/billing/ipd', label: 'IPD Billing' },
      { path: '/billing/pharmacy', label: 'Pharmacy Billing' },
      { path: '/billing/laboratory', label: 'Laboratory Billing' },
      { path: '/billing/payments', label: 'Payments' },
      { path: '/billing/refunds', label: 'Refunds' },
      { path: '/billing/gst', label: 'GST Reports' },
      { path: '/billing/day-end', label: 'Day End Reports' },
      { path: '/billing/insurance', label: 'Insurance / TPA' },
    ]
  },
  { path: '/laboratory', label: 'Laboratory', Icon: FlaskConical, module: 'lab', feature: 'lab' },
  { path: '/ai-scribe', label: 'AI Scribe', Icon: Mic, module: 'encounters', feature: 'ai-scribe' },
  { path: '/reports', label: 'Reports & Analytics', Icon: BarChart3, module: 'reports', feature: 'reports' },
  { path: '/admin', label: 'Admin Panel', Icon: Shield, module: 'admin' },
  { 
    path: '/settings', 
    label: 'System Settings', 
    Icon: Settings,
    module: 'admin',
    subItems: [
      { path: '/settings/general', label: 'General Settings' },
      { path: '/settings/hospital-profile', label: 'Hospital Profile' },
      { path: '/settings/users', label: 'Users & Permissions' },
      { path: '/settings/departments', label: 'Departments & Units' },
      { path: '/settings/billing', label: 'Billing & Finance' },
      { path: '/settings/pharmacy', label: 'Pharmacy Settings' },
      { path: '/settings/laboratory', label: 'Laboratory Settings' },
      { path: '/settings/teleicu', label: 'TeleICU Settings' },
      { path: '/settings/notifications', label: 'Notifications' },
      { path: '/settings/integrations', label: 'Integrations' },
      { path: '/settings/security', label: 'Security Settings' },
      { path: '/settings/data', label: 'Data Management' },
      { path: '/settings/backup', label: 'Backup & Restore' },
      { path: '/settings/audit', label: 'Audit Trail' },
      { path: '/settings/localization', label: 'Localization' },
      { path: '/settings/templates', label: 'Templates' },
      { path: '/settings/api', label: 'API & Webhooks' },
    ]
  },
];

export default function Layout() {
  const location = useLocation();

  // ── Global alert toast ──────────────────────────────────────────────────
  const { latestAlert, clearAlert } = useAlertWebSocket();
  const [toastAlert, setToastAlert] = useState<typeof latestAlert>(null);

  useEffect(() => {
    if (latestAlert) {
      setToastAlert(latestAlert);
    }

    const msg = sessionStorage.getItem('access_denied_message');
    if (msg) {
      setToastAlert({
        id: 'access-denied-' + Date.now(),
        type: 'warning',
        title: 'Access Denied',
        message: msg,
        timestamp: new Date().toISOString(),
      });
      sessionStorage.removeItem('access_denied_message');
    }
  }, [latestAlert]);

  const handleDismissToast = useCallback(() => {
    setToastAlert(null);
    clearAlert();
  }, [clearAlert]);

  return (
    <>
      <style>{layoutStyles}</style>

      <div className="layout-root">
        {/* ── Background elements ── */}
        <div className="bg-elements">
          {/* Mandala bottom-left */}
          <svg className="dash-mandala-bl" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="180" stroke="#0A6253" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="150" stroke="#0A6253" strokeWidth="0.4" />
            <circle cx="200" cy="200" r="120" stroke="#0A6253" strokeWidth="0.4" />
            {[...Array(12)].map((_, i) => (
              <g key={i} transform={`rotate(${i * 30} 200 200)`}>
                <ellipse cx="200" cy="115" rx="12" ry="36" stroke="#0A6253" strokeWidth="0.4" fill="none" />
              </g>
            ))}
            {[...Array(24)].map((_, i) => {
              const a = (i * 15 * Math.PI) / 180;
              return <circle key={i} cx={200 + 175 * Math.cos(a)} cy={200 + 175 * Math.sin(a)} r="2" fill="#0A6253" opacity="0.25" />;
            })}
          </svg>

          {/* Mandala top-right */}
          <svg className="dash-mandala-tr" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="190" stroke="#C8956C" strokeWidth="0.6" />
            <circle cx="200" cy="200" r="160" stroke="#C8956C" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="130" stroke="#C8956C" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="100" stroke="#C8956C" strokeWidth="0.4" />
            <circle cx="200" cy="200" r="70" stroke="#C8956C" strokeWidth="0.4" />
            {[...Array(16)].map((_, i) => (
              <g key={i} transform={`rotate(${i * 22.5} 200 200)`}>
                <ellipse cx="200" cy="110" rx="14" ry="40" stroke="#C8956C" strokeWidth="0.5" fill="none" />
                <ellipse cx="200" cy="130" rx="7" ry="22" stroke="#C8956C" strokeWidth="0.4" fill="none" />
                <line x1="200" y1="10" x2="200" y2="50" stroke="#C8956C" strokeWidth="0.3" />
              </g>
            ))}
            {[...Array(32)].map((_, i) => {
              const a = (i * 11.25 * Math.PI) / 180;
              return <circle key={i} cx={200 + 185 * Math.cos(a)} cy={200 + 185 * Math.sin(a)} r="2.5" fill="#C8956C" opacity="0.3" />;
            })}
          </svg>

          {/* Mandala bottom-right */}
          <svg className="dash-mandala-br" viewBox="0 0 400 400" fill="none">
             <circle cx="200" cy="200" r="180" stroke="#0A6253" strokeWidth="0.5" />
             <circle cx="200" cy="200" r="150" stroke="#0A6253" strokeWidth="0.4" />
             <circle cx="200" cy="200" r="120" stroke="#0A6253" strokeWidth="0.4" />
             {[...Array(12)].map((_, i) => (
               <g key={i} transform={`rotate(${i * 30} 200 200)`}>
                 <ellipse cx="200" cy="115" rx="12" ry="36" stroke="#0A6253" strokeWidth="0.4" fill="none" />
               </g>
             ))}
          </svg>
        </div>

        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <aside className="sidebar">
          {/* Logo area */}
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Arogya OS" className="sidebar-logo-img" />
            <span className="sidebar-logo-subtitle">Healthcare Operating System</span>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              // Ensure user has permission to see this module
              if (item.module && !hasAnyAccess(item.module)) {
                return null;
              }

              // Ensure user's hospital subscription plan includes this feature
              // @ts-ignore
              if (item.feature && !canAccessFeature(item.feature)) {
                return null;
              }

              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path)) ||
                (item.subItems && item.subItems.some(sub => location.pathname.startsWith(sub.path)));
                
              if (item.subItems && isActive) {
                return (
                  <div key={item.path} className="flex flex-col mb-1">
                    <Link to={item.path} className={`sidebar-nav-item active`}>
                      <item.Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                    <div className="pl-12 py-2 flex flex-col gap-1.5 bg-[#fcfcfc] border-l-[3px] border-[#0A6253]">
                      {item.subItems.map(sub => (
                        <Link 
                          key={sub.path} 
                          to={sub.path} 
                          className={`text-xs font-semibold py-1.5 flex items-center gap-2 hover:bg-gray-50 mr-2 rounded-r ${location.pathname === sub.path ? 'text-[#0A6253]' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                          {location.pathname === sub.path ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0A6253]" />
                          ) : (
                            <span className="w-1.5 h-1.5 opacity-0" />
                          )}
                          <span>{sub.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom status */}
          <div className="sidebar-status">
            <div className="sidebar-status-row">
              <span className="status-dot" />
              <div className="status-text-group">
                <span className="status-label">System Status</span>
                <span className="status-sub">All systems operational</span>
              </div>
            </div>
            <div className="sidebar-sync">
              <span>Last sync: 2 min ago</span>
              <RefreshCw size={14} />
            </div>
          </div>
        </aside>

        {/* ─── RIGHT PANEL (header + content + footer) ──────────────── */}
        <div className="main-wrapper">
          {/* Top header bar */}
          <header className="top-header">
            <div className="header-greeting">
              <h2 className="greeting-title">
                Good morning, {(() => { const u = getStoredUser(); return u?.first_name || u?.username || 'User'; })()} 👋
              </h2>
              <p className="greeting-sub flex items-center gap-2">
                {(() => { const u = getStoredUser(); return u?.hospital?.name || 'Welcome to MedOS'; })()}
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">
                  {(() => { const u = getStoredUser(); return (u?.hospital?.plan || 'basic').toUpperCase(); })()}
                </span>
              </p>
            </div>

            <div className="header-search">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search patients, modules, reports..."
                className="search-input"
              />
            </div>

            <div className="header-actions">
              <button className="header-icon-btn" aria-label="Notifications">
                <Bell size={20} />
              </button>
              <button className="header-icon-btn" aria-label="Messages">
                <MessageSquare size={20} />
              </button>
              <button className="header-icon-btn" aria-label="Help">
                <HelpCircle size={20} />
              </button>

              <div className="header-user">
                <div className="header-avatar">{(() => { const u = getStoredUser(); return u?.first_name?.charAt(0) || u?.username?.charAt(0) || 'U'; })()}</div>
                <div className="header-user-info">
                  <span className="header-user-name">{(() => { const u = getStoredUser(); return (u?.first_name && u?.last_name) ? `${u.first_name} ${u.last_name}` : u?.username || 'User'; })()}</span>
                  <span className="header-user-role">{(() => { const u = getStoredUser(); return u?.role || 'User'; })()}</span>
                </div>
              </div>

              <div className="header-date">
                <Calendar size={16} />
                <span>20 Jun 2026, Friday</span>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="main-content">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="main-footer">
            <span className="footer-copy">&copy; 2026 Arogya OS</span>
            <span className="footer-tagline">
              <Leaf size={14} />
              One Platform. Every Care. Better Health for India.
            </span>
          </footer>
        </div>

        {/* Global alert toast */}
        {toastAlert && (
          <AlertToast alert={toastAlert} onDismiss={handleDismissToast} />
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Plain CSS ───────────────────────── */
const layoutStyles = `
/* Reset & base */
.layout-root {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(160deg, #fdfbf7 0%, #f4f9f7 100%);
  position: relative;
}

.bg-elements {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.dash-mandala-bl {
  position: absolute;
  bottom: -150px;
  left: -150px;
  width: 500px;
  height: 500px;
  opacity: 0.15;
}

.dash-mandala-tr {
  position: absolute;
  top: -100px;
  right: -100px;
  width: 450px;
  height: 450px;
  opacity: 0.15;
}

.dash-mandala-br {
  position: absolute;
  bottom: -150px;
  right: -150px;
  width: 450px;
  height: 450px;
  opacity: 0.1;
}

/* ─── Sidebar ──────────────────────────────────────────────── */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(229, 231, 235, 0.7);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 1;
}

.sidebar-logo {
  padding: 16px 16px 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.sidebar-logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
}

.sidebar-logo-subtitle {
  font-size: 11px;
  color: #9ca3af;
  letter-spacing: 0.02em;
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  font-size: 13px;
  color: #4b5563;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s;
}

.sidebar-nav-item:hover {
  background: #f3f4f6;
}

.sidebar-nav-item.active {
  background: #E8F5F0;
  color: #0A6253;
  border-left-color: #0A6253;
  font-weight: 600;
}

/* Bottom status */
.sidebar-status {
  border-top: 1px solid #e5e7eb;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-status-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  margin-top: 3px;
  flex-shrink: 0;
}

.status-text-group {
  display: flex;
  flex-direction: column;
}

.status-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.status-sub {
  font-size: 11px;
  color: #9ca3af;
}

.sidebar-sync {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
}

.sidebar-sync svg {
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.15s;
}

.sidebar-sync svg:hover {
  color: #0A6253;
}

/* ─── Main Wrapper ─────────────────────────────────────────── */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Top Header ───────────────────────────────────────────── */
.top-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(229, 231, 235, 0.7);
  flex-shrink: 0;
  z-index: 1;
}

.header-greeting {
  flex-shrink: 0;
}

.greeting-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.greeting-sub {
  font-size: 12px;
  color: #6b7280;
  margin: 2px 0 0;
}

.header-search {
  flex: 1;
  max-width: 420px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #f9fafb;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #0A6253;
  background: #fff;
}

.search-input::placeholder {
  color: #9ca3af;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

.header-icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  border-radius: 8px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.header-icon-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  padding-left: 16px;
  border-left: 1px solid #e5e7eb;
}

.header-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #0A6253;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-user-info {
  display: flex;
  flex-direction: column;
}

.header-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.header-user-role {
  font-size: 11px;
  color: #9ca3af;
}

.header-date {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  padding-left: 16px;
  border-left: 1px solid #e5e7eb;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

/* ─── Main Content ─────────────────────────────────────────── */
.main-content {
  flex: 1;
  overflow-y: auto;
  background: transparent;
  padding: 24px;
  z-index: 1;
  position: relative;
}

/* ─── Footer ───────────────────────────────────────────────── */
.main-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(229, 231, 235, 0.7);
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
  z-index: 1;
}

.footer-copy {
  color: #9ca3af;
}

.footer-tagline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0A6253;
  font-weight: 500;
}

.footer-tagline svg {
  color: #0A6253;
}
`;
