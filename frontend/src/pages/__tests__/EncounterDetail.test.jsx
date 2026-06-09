import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EncounterDetail from '../EncounterDetail';

vi.mock('../../api/encounters', () => ({
  encountersApi: {
    get: vi.fn(),
    addVitals: vi.fn(),
    addMedication: vi.fn(),
    complete: vi.fn(),
  },
}));

import { encountersApi } from '../../api/encounters';

const mockEncounter = {
  data: {
    id: 1,
    patient_name: 'Ravi Sharma',
    encounter_type: 'OPD',
    status: 'in-progress',
    doctor: 'Dr. Mehta',
    department: 'General Medicine',
    scheduled_date: '2026-06-09',
    chief_complaint: 'Fever and cough since 3 days',
    vitals: [
      { id: 1, systolic_bp: 120, diastolic_bp: 80, heart_rate: 72, temperature: 98.6, SpO2: 98, recorded_at: '2026-06-09T10:30:00Z' },
    ],
    medications: [
      { id: 1, drug_name: 'Paracetamol', dosage: '500mg', frequency: 'TID', duration: '5 days', status: 'active' },
    ],
  },
};

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/encounters/1']}>
        <Routes>
          <Route path="/encounters/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EncounterDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    encountersApi.get.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<EncounterDetail />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders encounter information', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    expect(screen.getByText(/OPD/)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Mehta/)).toBeInTheDocument();
    expect(screen.getByText(/General Medicine/)).toBeInTheDocument();
    expect(screen.getByText(/Fever and cough since 3 days/)).toBeInTheDocument();
  });

  it('renders vitals section', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Vitals')).toBeInTheDocument();
    });

    expect(screen.getByText(/120\/80/)).toBeInTheDocument();
    expect(screen.getByText(/72/)).toBeInTheDocument();
    expect(screen.getByText(/98\.6/)).toBeInTheDocument();
    expect(screen.getByText(/98%/)).toBeInTheDocument();
  });

  it('renders medications list', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('500mg')).toBeInTheDocument();
    expect(screen.getByText('TID')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('shows Add Vitals expandable form', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Vitals')).toBeInTheDocument();
    });

    const addButton = screen.getByText(/add vitals/i);
    fireEvent.click(addButton);

    expect(screen.getByLabelText(/systolic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/diastolic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/heart rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SpO2/i)).toBeInTheDocument();
  });

  it('submits vitals and refetches encounter', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    encountersApi.addVitals.mockResolvedValue({ data: { id: 2 } });

    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Vitals')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText(/add vitals/i));

    // Fill form
    fireEvent.change(screen.getByLabelText(/systolic/i), { target: { value: '130' } });
    fireEvent.change(screen.getByLabelText(/diastolic/i), { target: { value: '85' } });
    fireEvent.change(screen.getByLabelText(/heart rate/i), { target: { value: '75' } });
    fireEvent.change(screen.getByLabelText(/temperature/i), { target: { value: '99.1' } });
    fireEvent.change(screen.getByLabelText(/SpO2/i), { target: { value: '97' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    await waitFor(() => {
      expect(encountersApi.addVitals).toHaveBeenCalledWith('1', {
        systolic_bp: 130,
        diastolic_bp: 85,
        heart_rate: 75,
        temperature: 99.1,
        SpO2: 97,
      });
    });
  });

  it('shows Complete Encounter form', async () => {
    encountersApi.get.mockResolvedValue(mockEncounter);
    renderWithProviders(<EncounterDetail />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    const completeButton = screen.getByRole('button', { name: /complete encounter/i });
    fireEvent.click(completeButton);

    expect(screen.getByLabelText(/diagnosis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm complete/i })).toBeInTheDocument();
  });
});
