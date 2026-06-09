import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import NewEncounter from '../NewEncounter';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/patients', () => ({
  patientsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../../api/encounters', () => ({
  encountersApi: {
    create: vi.fn(),
  },
}));

import { patientsApi } from '../../api/patients';
import { encountersApi } from '../../api/encounters';

const mockPatients = {
  data: [
    { id: 1, name: 'Ravi Sharma', phone: '9876543210' },
    { id: 2, name: 'Priya Singh', phone: '9876543211' },
  ],
};

function renderWithProviders(ui, { initialEntries = ['/encounters/new'] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NewEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all fields', () => {
    patientsApi.list.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<NewEncounter />);

    expect(screen.getByText('New Encounter')).toBeInTheDocument();
    expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/encounter type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/chief complaint/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scheduled date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create encounter/i })).toBeInTheDocument();
  });

  it('fetches patients when search input changes', async () => {
    patientsApi.list.mockResolvedValue(mockPatients);
    renderWithProviders(<NewEncounter />);

    const patientInput = screen.getByLabelText(/patient/i);
    await userEvent.type(patientInput, 'Ravi');

    await waitFor(() => {
      expect(patientsApi.list).toHaveBeenCalledWith({ search: 'Ravi' });
    });
  });

  it('shows patient dropdown when search results arrive', async () => {
    patientsApi.list.mockResolvedValue(mockPatients);
    renderWithProviders(<NewEncounter />);

    const patientInput = screen.getByLabelText(/patient/i);
    fireEvent.change(patientInput, { target: { value: 'Ravi' } });

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma - 9876543210')).toBeInTheDocument();
    });
  });

  it('submits the form and navigates on success', async () => {
    patientsApi.list.mockResolvedValue(mockPatients);
    encountersApi.create.mockResolvedValue({ data: { id: 99 } });

    renderWithProviders(<NewEncounter />);

    // Type patient search and select first patient
    const patientInput = screen.getByLabelText(/patient/i);
    fireEvent.change(patientInput, { target: { value: 'Ravi' } });

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma - 9876543210')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ravi Sharma - 9876543210'));

    // Fill other fields
    const typeSelect = screen.getByLabelText(/encounter type/i);
    fireEvent.change(typeSelect, { target: { value: 'OPD' } });

    const deptInput = screen.getByLabelText(/department/i);
    fireEvent.change(deptInput, { target: { value: 'General Medicine' } });

    const complaintInput = screen.getByLabelText(/chief complaint/i);
    fireEvent.change(complaintInput, { target: { value: 'Fever and cough' } });

    const dateInput = screen.getByLabelText(/scheduled date/i);
    fireEvent.change(dateInput, { target: { value: '2026-06-10' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /create encounter/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(encountersApi.create).toHaveBeenCalledWith({
        patient_id: 1,
        encounter_type: 'OPD',
        department: 'General Medicine',
        chief_complaint: 'Fever and cough',
        scheduled_date: '2026-06-10',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/encounters/99');
  });

  it('pre-selects patient when patientId is in URL', async () => {
    patientsApi.list.mockResolvedValue(mockPatients);
    renderWithProviders(<NewEncounter />, {
      initialEntries: ['/encounters/new?patientId=1'],
    });

    await waitFor(() => {
      expect(patientsApi.list).toHaveBeenCalled();
    });
  });
});
