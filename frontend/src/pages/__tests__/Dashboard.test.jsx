import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

// Mock the API module
vi.mock('../../api/dashboard', () => ({
  dashboardApi: {
    stats: vi.fn(),
  },
}));

import { dashboardApi } from '../../api/dashboard';

const mockStats = {
  total_patients: 1250,
  today_encounters: 34,
  active_alerts: 7,
  pending_invoices: 12,
  recent_encounters: [
    { id: 1, patient_name: 'Ravi Sharma', patient_id: 1, doctor: 'Dr. Mehta', type: 'checkup', time: '2026-06-09T10:30:00Z' },
    { id: 2, patient_name: 'Priya Singh', patient_id: 2, doctor: 'Dr. Mehta', type: 'follow-up', time: '2026-06-09T09:15:00Z' },
    { id: 3, patient_name: 'Anita Verma', patient_id: 3, doctor: 'Dr. Rao', type: 'emergency', time: '2026-06-09T08:00:00Z' },
  ],
};

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    dashboardApi.stats.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<Dashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders stats cards from API data', async () => {
    dashboardApi.stats.mockResolvedValue({ data: mockStats });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
    });

    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText("Today's Encounters")).toBeInTheDocument();

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Pending Invoices')).toBeInTheDocument();
  });

  it('renders recent encounters table', async () => {
    dashboardApi.stats.mockResolvedValue({ data: mockStats });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Encounters')).toBeInTheDocument();
    });

    expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    expect(screen.getByText('Priya Singh')).toBeInTheDocument();
    expect(screen.getByText('Anita Verma')).toBeInTheDocument();
    expect(screen.getByText('checkup')).toBeInTheDocument();
    expect(screen.getByText('follow-up')).toBeInTheDocument();
    expect(screen.getByText('emergency')).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    dashboardApi.stats.mockResolvedValue({ data: mockStats });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    expect(screen.getByText('New Patient')).toBeInTheDocument();
    expect(screen.getByText('New Encounter')).toBeInTheDocument();
    expect(screen.getByText('View Billing')).toBeInTheDocument();
  });

  it('renders error alert on failure', async () => {
    dashboardApi.stats.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
