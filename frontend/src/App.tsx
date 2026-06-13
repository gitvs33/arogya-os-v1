import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuspendedAccount from './pages/SuspendedAccount';
import ChangePassword from './pages/ChangePassword';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import NewPatient from './pages/NewPatient';
import Encounters from './pages/Encounters';
import EncounterDetail from './pages/EncounterDetail';
import TeleICU from './pages/TeleICU';
import TeleICUPatients from './pages/teleicu-tabs/TeleICUPatients';
import TeleICUAlerts from './pages/teleicu-tabs/TeleICUAlerts';
import Appointments from './pages/Appointments';
import WardIPD from './pages/WardIPD';
import NursingStationView from './pages/NursingStationView';
import MorningRoundView from './pages/MorningRoundView';
import TeleICUConsults from './pages/teleicu-tabs/TeleICUConsults';
import TeleICUDevices from './pages/teleicu-tabs/TeleICUDevices';
import NewEncounter from './pages/NewEncounter';
import Prescriptions from './pages/Prescriptions';
import PharmacyStock from './pages/PharmacyStock';
import Billing from './pages/Billing';
import InvoiceDetail from './pages/InvoiceDetail';
import Alerts from './pages/Alerts';
import AIScribe from './pages/AIScribe';
import Laboratory from './pages/Laboratory';
import LabQueue from './pages/LabQueue';
import LabOrderDetail from './pages/LabOrderDetail';
import ReportsAnalytics from './pages/ReportsAnalytics';
import AdminPanel from './pages/AdminPanel';
import SystemSettingsPanel from './pages/SystemSettingsPanel';
import BillingInvoices from './pages/billing-tabs/BillingInvoices';
import BillingPayments from './pages/billing-tabs/BillingPayments';
import BillingRefunds from './pages/billing-tabs/BillingRefunds';
import BillingGST from './pages/billing-tabs/BillingGST';
import BillingDayEnd from './pages/billing-tabs/BillingDayEnd';
import BillingInsurance from './pages/billing-tabs/BillingInsurance';
import { getStoredUser } from './api/client';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getStoredUser();
  if (user && user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/suspended" element={<SuspendedAccount />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/new" element={<NewPatient />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/patients/:id/edit" element={<NewPatient />} />
            <Route path="/ward" element={<WardIPD />} />
            <Route path="/ward/nursing-station" element={<NursingStationView />} />
            <Route path="/ward/morning-round" element={<MorningRoundView />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/teleicu" element={<TeleICU />} />
            <Route path="/teleicu/patients" element={<TeleICUPatients />} />
            <Route path="/teleicu/alerts" element={<TeleICUAlerts />} />
            <Route path="/teleicu/consults" element={<TeleICUConsults />} />
            <Route path="/teleicu/devices" element={<TeleICUDevices />} />
            <Route path="/encounters" element={<Encounters />} />
            <Route path="/encounters/new" element={<NewEncounter />} />
            <Route path="/encounters/:id" element={<EncounterDetail />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/pharmacy/stock" element={<PharmacyStock />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/invoice/:id" element={<InvoiceDetail />} />
            <Route path="/billing/invoices" element={<BillingInvoices />} />
            <Route path="/billing/opd" element={<BillingInvoices />} />
            <Route path="/billing/ipd" element={<BillingInvoices />} />
            <Route path="/billing/pharmacy" element={<BillingInvoices />} />
            <Route path="/billing/laboratory" element={<BillingInvoices />} />
            <Route path="/billing/payments" element={<BillingPayments />} />
            <Route path="/billing/refunds" element={<BillingRefunds />} />
            <Route path="/billing/gst" element={<BillingGST />} />
            <Route path="/billing/day-end" element={<BillingDayEnd />} />
            <Route path="/billing/insurance" element={<BillingInsurance />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/laboratory" element={<Laboratory />} />
            <Route path="/laboratory/queue" element={<LabQueue />} />
            <Route path="/laboratory/orders/:id" element={<LabOrderDetail />} />
            <Route path="/reports" element={<ReportsAnalytics />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/settings" element={<SystemSettingsPanel />} />
            <Route path="/settings/*" element={<SystemSettingsPanel />} />
            <Route path="/ai-scribe" element={<AIScribe />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
