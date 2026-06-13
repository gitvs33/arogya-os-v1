import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';

import SystemSettings from './admin-tabs/SystemSettings';
import UserManagement from './admin-tabs/UserManagement';
import DepartmentSetup from './admin-tabs/DepartmentSetup';
import SecurityAccess from './admin-tabs/SecurityAccess';
import AuditLogs from './admin-tabs/AuditLogs';
import BackupRestore from './admin-tabs/BackupRestore';

import HospitalProfile from './settings-tabs/HospitalProfile';
import BillingSettings from './settings-tabs/BillingSettings';
import PharmacySettings from './settings-tabs/PharmacySettings';
import LaboratorySettings from './settings-tabs/LaboratorySettings';
import TeleICUSettings from './settings-tabs/TeleICUSettings';
import NotificationsSettings from './settings-tabs/NotificationsSettings';
import IntegrationsSettings from './settings-tabs/IntegrationsSettings';
import DataManagement from './settings-tabs/DataManagement';
import LocalizationSettings from './settings-tabs/LocalizationSettings';
import TemplatesSettings from './settings-tabs/TemplatesSettings';
import APIWebhooksSettings from './settings-tabs/APIWebhooksSettings';

export default function SystemSettingsPanel() {
  const location = useLocation();

  // If they just hit /settings, redirect them to the first tab.
  if (location.pathname === '/settings') {
    return <Navigate to="/settings/general" replace />;
  }

  const renderContent = () => {
    switch (location.pathname) {
      case '/settings/general':
        return <SystemSettings />;
      case '/settings/hospital-profile':
        return <HospitalProfile />;
      case '/settings/users':
        return <UserManagement />;
      case '/settings/departments':
        return <DepartmentSetup />;
      case '/settings/billing':
        return <BillingSettings />;
      case '/settings/pharmacy':
        return <PharmacySettings />;
      case '/settings/laboratory':
        return <LaboratorySettings />;
      case '/settings/teleicu':
        return <TeleICUSettings />;
      case '/settings/notifications':
        return <NotificationsSettings />;
      case '/settings/integrations':
        return <IntegrationsSettings />;
      case '/settings/security':
        return <SecurityAccess />;
      case '/settings/data':
        return <DataManagement />;
      case '/settings/backup':
        return <BackupRestore />;
      case '/settings/audit':
        return <AuditLogs />;
      case '/settings/localization':
        return <LocalizationSettings />;
      case '/settings/templates':
        return <TemplatesSettings />;
      case '/settings/api':
        return <APIWebhooksSettings />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Coming Soon</h2>
            <p className="text-gray-500">This settings module is currently under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-full overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
