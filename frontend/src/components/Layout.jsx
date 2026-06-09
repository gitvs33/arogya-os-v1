import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAlertWebSocket } from '../hooks/useAlertWebSocket';
import AlertToast from './AlertToast';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/patients', label: 'Patients', icon: '👥' },
  { path: '/encounters', label: 'Encounters', icon: '📋' },
  { path: '/teleicu', label: 'TeleICU', icon: '🫀' },
  { path: '/prescriptions', label: 'Prescriptions', icon: '💊' },
  { path: '/billing', label: 'Billing', icon: '💰' },
  { path: '/alerts', label: 'Alerts', icon: '🔔' },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Global alert toast ──────────────────────────────────────────────────
  const { latestAlert, clearAlert } = useAlertWebSocket();
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    if (latestAlert) {
      setToastAlert(latestAlert);
    }
  }, [latestAlert]);

  const handleDismissToast = useCallback(() => {
    setToastAlert(null);
    clearAlert();
  }, [clearAlert]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 transition-all duration-200 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <h1 className={`text-xl font-bold text-blue-600 ${!sidebarOpen && 'hidden'}`}>MedOS</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              D
            </div>
            {sidebarOpen && (
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Doctor</p>
                <p className="text-xs text-gray-500">doctor@hospital.com</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Global alert toast */}
      {toastAlert && (
        <AlertToast alert={toastAlert} onDismiss={handleDismissToast} />
      )}
    </div>
  );
}
