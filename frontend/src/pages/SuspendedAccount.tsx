import React from 'react';
import { LogOut, AlertOctagon } from 'lucide-react';
import { clearAuth } from '../api/client';

export default function SuspendedAccount() {
  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertOctagon className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Suspended</h1>
        <p className="text-slate-600 mb-8">
          Your hospital's subscription to MedOS has expired or been deactivated. Please contact your system administrator or the MedOS billing team to restore access.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
