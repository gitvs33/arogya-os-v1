import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import NewPatient from '../NewPatient';

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
    create: vi.fn(),
  },
}));

import { patientsApi } from '../../api/patients';

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

describe('NewPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders all form fields', () => {
    renderWithProviders(<NewPatient />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pincode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/abha id/i)).toBeInTheDocument();
  });

  it('shows required fields with asterisk', () => {
    renderWithProviders(<NewPatient />);
    // The label 'First Name' has a required span with '*'
    expect(screen.getByText(/first name/i)).toBeInTheDocument();
    // Verify the required indicator span exists (rendered alongside label)
    const asterisks = document.querySelectorAll('.text-red-500');
    expect(asterisks.length).toBeGreaterThan(0);
  });

  it('submits form and navigates on success', async () => {
    const createdPatient = { id: 5, first_name: 'New', last_name: 'Patient' };
    patientsApi.create.mockResolvedValue({ data: createdPatient });
    renderWithProviders(<NewPatient />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/phone/i), '9876543210');

    const submitBtn = screen.getByRole('button', { name: /save patient/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(patientsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          phone: '9876543210',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/patients/5');
    });
  });

  it('displays validation errors from API', async () => {
    const errorResponse = {
      response: {
        data: {
          email: ['Enter a valid email address.'],
          phone: ['Enter a valid phone number.'],
        },
      },
    };
    patientsApi.create.mockRejectedValue(errorResponse);
    renderWithProviders(<NewPatient />);

    // Fill in required field first so native validation doesn't block submission
    await userEvent.type(screen.getByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');

    const submitBtn = screen.getByRole('button', { name: /save patient/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
      expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
    });
  });

  it('shows submitting state on button when saving', async () => {
    patientsApi.create.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<NewPatient />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/phone/i), '9876543210');

    const submitBtn = screen.getByRole('button', { name: /save patient/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  it('renders gender select with options', () => {
    renderWithProviders(<NewPatient />);
    const select = screen.getByLabelText(/gender/i);
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe('SELECT');
  });
});
