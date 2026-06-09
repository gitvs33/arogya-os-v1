import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import NewPatient from './pages/NewPatient';
import Encounters from './pages/Encounters';
import EncounterDetail from './pages/EncounterDetail';
import TeleICU from './pages/TeleICU';
import NewEncounter from './pages/NewEncounter';
import Prescriptions from './pages/Prescriptions';
import Billing from './pages/Billing';
import InvoiceDetail from './pages/InvoiceDetail';
import Alerts from './pages/Alerts';

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
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/new" element={<NewPatient />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/teleicu" element={<TeleICU />} />
            <Route path="/encounters" element={<Encounters />} />
            <Route path="/encounters/new" element={<NewEncounter />} />
            <Route path="/encounters/:id" element={<EncounterDetail />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/:id" element={<InvoiceDetail />} />
            <Route path="/alerts" element={<Alerts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
