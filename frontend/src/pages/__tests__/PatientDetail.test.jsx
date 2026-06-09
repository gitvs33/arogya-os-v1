import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientDetail from '../PatientDetail';

vi.mock('../../api/patients', () => ({
  patientsApi: {
    get: vi.fn(),
    getEncounters: vi.fn(),
    getAlerts: vi.fn(),
    getInvoices: vi.fn(),
  },
}));

import { patientsApi } from '../../api/patients';

const mockPatient = {
  id: 1,
  first_name: 'Ravi',
  last_name: 'Sharma',
  date_of_birth: '1991-05-15',
  gender: 'M',
  phone: '9876543210',
  email: 'ravi@example.com',
  address: '123 Main St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  age: 35,
};

const mockEncounters = [
  { id: 1, date: '2026-06-09', type: 'checkup', doctor: 'Dr. Mehta', diagnosis: 'Hypertension' },
  { id: 2, date: '2026-06-01', type: 'follow-up', doctor: 'Dr. Mehta', diagnosis: 'Diabetes' },
];

const mockAlerts = [
  { id: 1, severity: 'high', message: 'Allergic to Penicillin', created_at: '2026-06-01' },
  { id: 2, severity: 'low', message: 'Needs vaccination update', created_at: '2026-05-15' },
];

const mockInvoices = [
  { id: 1, invoice_no: 'INV-001', amount: 1500, status: 'paid', date: '2026-06-01' },
  { id: 2, invoice_no: 'INV-002', amount: 3200, status: 'pending', date: '2026-06-08' },
];

function renderWithProviders(ui, { route = '/patients/1' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/patients/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PatientDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    patientsApi.get.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PatientDetail />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders patient info card', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
    expect(screen.getByText(/ravi@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Mumbai/)).toBeInTheDocument();
    expect(screen.getByText(/Maharashtra/)).toBeInTheDocument();
  });

  it('renders tabs for Encounters, Alerts, Invoices', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      expect(screen.getByText('Encounters')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });
  });

  it('shows encounters table by default', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    // Wait for encounters tab to render with unique diagnosis text
    await waitFor(() => {
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
    });

    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    // Dr. Mehta appears in 2 rows, so use getAllByText
    expect(screen.getAllByText('Dr. Mehta').length).toBe(2);
  });

  it('switches to alerts tab on click', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      expect(screen.getByText('Encounters')).toBeInTheDocument();
    });

    const alertsTab = screen.getByText('Alerts');
    alertsTab.click();

    await waitFor(() => {
      expect(screen.getByText('Allergic to Penicillin')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });
  });

  it('switches to invoices tab and shows data', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      expect(screen.getByText('Encounters')).toBeInTheDocument();
    });

    const invoicesTab = screen.getByText('Invoices');
    invoicesTab.click();

    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('INV-002')).toBeInTheDocument();
      expect(screen.getByText('paid')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  it('has start encounter button linking to new encounter', async () => {
    patientsApi.get.mockResolvedValue({ data: mockPatient });
    patientsApi.getEncounters.mockResolvedValue({ data: mockEncounters });
    patientsApi.getAlerts.mockResolvedValue({ data: mockAlerts });
    patientsApi.getInvoices.mockResolvedValue({ data: mockInvoices });
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      const btn = screen.getByText(/start encounter/i);
      expect(btn).toBeInTheDocument();
      expect(btn.closest('a')).toHaveAttribute('href', '/encounters/new?patientId=1');
    });
  });

  it('shows error state on API failure', async () => {
    patientsApi.get.mockRejectedValue(new Error('Patient not found'));
    renderWithProviders(<PatientDetail />);

    await waitFor(() => {
      expect(screen.getByText('Patient not found')).toBeInTheDocument();
    });
  });
});
