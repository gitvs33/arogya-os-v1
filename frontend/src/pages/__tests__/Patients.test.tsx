import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Patients from '../Patients';

vi.mock('../../api/patients', () => ({
  patientsApi: {
    list: vi.fn(),
  },
}));

import { patientsApi } from '../../api/patients';

const mockPatientsPage1 = {
  count: 25,
  next: 'http://localhost:8000/api/patients/?page=2',
  previous: null,
  results: [
    { id: 1, first_name: 'Ravi', last_name: 'Sharma', phone: '9876543210', gender: 'M', age: 35, city: 'Mumbai' },
    { id: 2, first_name: 'Priya', last_name: 'Singh', phone: '9876543211', gender: 'F', age: 28, city: 'Delhi' },
    { id: 3, first_name: 'Amit', last_name: 'Kumar', phone: '9876543212', gender: 'M', age: 42, city: 'Bangalore' },
    { id: 4, first_name: 'Sunita', last_name: 'Devi', phone: '9876543213', gender: 'F', age: 55, city: 'Chennai' },
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

describe('Patients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    patientsApi.list.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Patients />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders patient list from API', async () => {
    patientsApi.list.mockResolvedValue({ data: mockPatientsPage1 });
    renderWithProviders(<Patients />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    expect(screen.getByText('Priya Singh')).toBeInTheDocument();
    expect(screen.getByText('Amit Kumar')).toBeInTheDocument();
    expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    // Check gender values - there are 2 M and 2 F in the data
    const genderM = screen.getAllByText('M');
    expect(genderM.length).toBe(2);
    const genderF = screen.getAllByText('F');
    expect(genderF.length).toBe(2);
  });

  it('renders search bar and filters on input', async () => {
    patientsApi.list.mockResolvedValue({ data: mockPatientsPage1 });
    renderWithProviders(<Patients />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search patients/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search patients/i);
    await userEvent.type(searchInput, 'Ravi');

    await waitFor(() => {
      expect(patientsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Ravi' })
      );
    });
  });

  it('has link to new patient page', async () => {
    patientsApi.list.mockResolvedValue({ data: mockPatientsPage1 });
    renderWithProviders(<Patients />);

    await waitFor(() => {
      const newBtn = screen.getByText(/new patient/i);
      expect(newBtn).toBeInTheDocument();
      expect(newBtn.closest('a')).toHaveAttribute('href', '/patients/new');
    });
  });

  it('navigates to patient detail on row click', async () => {
    patientsApi.list.mockResolvedValue({ data: mockPatientsPage1 });
    renderWithProviders(<Patients />);

    await waitFor(() => {
      expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    });

    // The name is wrapped in a Link
    const nameLink = screen.getByText('Ravi Sharma').closest('a');
    expect(nameLink).toHaveAttribute('href', '/patients/1');
  });

  it('shows pagination controls when multiple pages exist', async () => {
    patientsApi.list.mockResolvedValue({ data: mockPatientsPage1 });
    renderWithProviders(<Patients />);

    await waitFor(() => {
      expect(screen.getByText(/next/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/previous/i)).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    patientsApi.list.mockRejectedValue(new Error('Failed to load'));
    renderWithProviders(<Patients />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });
});
