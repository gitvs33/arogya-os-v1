import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canAccess, canAccessFeature } from '../utils/permissions';
import { Lock } from 'lucide-react';

import AdminDashboard from './admin-tabs/AdminDashboard';
import UserManagement from './admin-tabs/UserManagement';
import RoleManagement from './admin-tabs/RoleManagement';
import DepartmentSetup from './admin-tabs/DepartmentSetup';
import MasterData from './admin-tabs/MasterData';
import WardSetup from './admin-tabs/WardSetup';
import LabPanelsSetup from './admin-tabs/LabPanelsSetup';
import PharmacyStock from './PharmacyStock';

import WorkflowSetup from './admin-tabs/WorkflowSetup';
import DeviceIntegration from './admin-tabs/DeviceIntegration';
import SecurityAccess from './admin-tabs/SecurityAccess';
import AuditLogs from './admin-tabs/AuditLogs';
import BackupRestore from './admin-tabs/BackupRestore';

export default function AdminPanel() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Dashboard');

  useEffect(() => {
    if (location.pathname === '/admin') {
      setActiveTab('Dashboard');
    }
  }, [location.pathname]);

  const ALL_TABS = [
    { name: 'Dashboard', perm: 'read' }, 
    { name: 'User Management', perm: 'manage_users' }, 
    { name: 'Role Management', perm: 'manage_roles' }, 
    { name: 'Department Setup', perm: 'write' }, 
    { name: 'Ward Setup', perm: 'write' },
    { name: 'Lab Tests', perm: 'write' },
    { name: 'Drug Inventory', perm: 'write' },
    { name: 'Master Data', perm: 'write' },

    { name: 'Workflow Setup', perm: 'write', feature: 'advanced-admin' }, 
    { name: 'Device Integration', perm: 'write', feature: 'enterprise-admin' }, 
    { name: 'Security & Access', perm: 'manage_roles', feature: 'enterprise-admin' }, 
    { name: 'Audit Logs', perm: 'read', feature: 'advanced-admin' }, 
    { name: 'Backup & Restore', perm: 'write', feature: 'enterprise-admin' }
  ];

  const visibleTabs = ALL_TABS.filter(tab => canAccess('admin', tab.perm));

  return (
    <div className="flex h-full -mx-4 -mt-4 bg-[#F8F9FA] min-h-[calc(100vh-80px)]">
      
      {/* ── Left Sidebar (Vertical Tabs) ── */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col py-4">
        <div className="px-4 mb-2">
          <h2 className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Admin Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2">
          {visibleTabs.map(tab => {
            const isLocked = tab.feature && !canAccessFeature(tab.feature);
            return (
              <button
                key={tab.name}
                onClick={() => !isLocked && setActiveTab(tab.name)}
                disabled={isLocked}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === tab.name 
                    ? 'bg-emerald-50 text-[#0A6253]' 
                    : isLocked 
                      ? 'text-gray-400 cursor-not-allowed opacity-60' 
                      : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isLocked && <Lock size={12} />}
                  <span>{tab.name}</span>
                </div>
                {!isLocked && activeTab === tab.name && <div className="w-1.5 h-1.5 rounded-full bg-[#0A6253]" />}
                {isLocked && <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded uppercase">Upgrade</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 max-w-[1600px] mx-auto w-full">
          
          {/* Dynamic Panel Rendering */}
          {activeTab === 'Dashboard' && <AdminDashboard />}
          {activeTab === 'User Management' && <UserManagement />}
          {activeTab === 'Role Management' && <RoleManagement />}
          {activeTab === 'Department Setup' && <DepartmentSetup />}
          {activeTab === 'Ward Setup' && <WardSetup />}
          {activeTab === 'Lab Tests' && <LabPanelsSetup />}
          {activeTab === 'Drug Inventory' && <PharmacyStock />}
          {activeTab === 'Master Data' && <MasterData />}

          {activeTab === 'Workflow Setup' && <WorkflowSetup />}
          {activeTab === 'Device Integration' && <DeviceIntegration />}
          {activeTab === 'Security & Access' && <SecurityAccess />}
          {activeTab === 'Audit Logs' && <AuditLogs />}
          {activeTab === 'Backup & Restore' && <BackupRestore />}

        </div>
      </div>
    </div>
  );
}
