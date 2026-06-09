import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Prescriptions from '../Prescriptions';

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
      medications: [
        { id: 1, drug_name: 'Paracetamol', dosage: '500mg', frequency: 'TID', duration: '5 days', status: 'active' },
        { id: 2, drug_name: 'Amoxicillin', dosage: '250mg', frequency: 'BID', duration: '7 days', status: 'active' },
      ],
    },
    {
      id: 2,
      patient_name: 'Priya Singh',
      medications: [
        { id: 3, drug_name: 'Metformin', dosage: '1000mg', frequency: 'BID', duration: '30 days', status: 'active' },
      ],
    },
    {
      id: 3,
      patient_name: 'Anita Verma',
      medications: [],
    },
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

describe('Prescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    encountersApi.list.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Prescriptions />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('aggregates medications across all encounters', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Prescriptions />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getAllByText('Ravi Sharma').length).toBe(2);
    expect(screen.getByText('Priya Singh')).toBeInTheDocument();
  });

  it('renders column headers', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Prescriptions />);

    await waitFor(() => {
      expect(screen.getByText('Patient')).toBeInTheDocument();
    });

    expect(screen.getByText('Drug')).toBeInTheDocument();
    expect(screen.getByText('Dosage')).toBeInTheDocument();
    expect(screen.getByText('Frequency')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('filters prescriptions by patient search', async () => {
    encountersApi.list.mockResolvedValue(mockEncounters);
    renderWithProviders(<Prescriptions />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Priya' } });

    await waitFor(() => {
      expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Priya Singh')).toBeInTheDocument();
    expect(screen.queryByText('Ravi Sharma')).not.toBeInTheDocument();
  });

  it('shows empty state when no medications found', async () => {
    encountersApi.list.mockResolvedValue({ data: [] });
    renderWithProviders(<Prescriptions />);

    await waitFor(() => {
      expect(screen.getByText(/no prescriptions/i)).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    encountersApi.list.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<Prescriptions />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
