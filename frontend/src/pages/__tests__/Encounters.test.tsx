import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Encounters from '../Encounters';

vi.mock('../../api/encounters', () => ({
  encountersApi: {
    list: vi.fn(),
  },
}));

import { encountersApi } from '../../api/encounters';

const mockEncounters = {
  data: [
    {
      id: 1,
      patient_name: 'Ravi Sharma',
      encounter_type: 'OPD',
      status: 'completed',
      doctor: 'Dr. Mehta',
      department: 'General Medicine',
      scheduled_date: '2026-06-09',
    },
    {
      id: 2,
      patient_name: 'Priya Singh',
      encounter_type: 'IPD',
      status: 'in-progress',
      doctor: 'Dr. Rao',
      department: 'Cardiology',
      scheduled_date: '2026-06-10',
    },
    {
      id: 3,
      patient_name: 'Anita Verma',
      encounter_type: 'EMERGENCY',
      status: 'pending',
      doctor: 'Dr. Sharma',
      department: 'Emergency',
      scheduled_date: '2026-06-08',
    },
  ],
};

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/encounters']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Encounters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    encountersApi.list.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Encounters />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders encounters table with API data', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    expect(screen.getByText('Priya Singh')).toBeInTheDocument();
    expect(screen.getByText('Anita Verma')).toBeInTheDocument();
    expect(screen.getAllByText('OPD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('IPD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('EMERGENCY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('in-progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('pending').length).toBeGreaterThanOrEqual(1);
  });

  it('renders column headers', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText('Patient')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Doctor')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('has a New Encounter button linking to /encounters/new', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText(/New Encounter/)).toBeInTheDocument();
    });

    const button = screen.getByText(/New Encounter/);
    expect(button.closest('a')).toHaveAttribute('href', '/encounters/new');
  });

  it('filters by status when filter dropdown changes', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      expect(encountersApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  it('filters by type when type filter dropdown changes', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: 'OPD' } });

    await waitFor(() => {
      expect(encountersApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ encounter_type: 'OPD' })
      );
    });
  });

  it('shows error state on API failure', async () => {
    encountersApi.list.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<Encounters />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
