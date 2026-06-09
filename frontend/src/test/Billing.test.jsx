import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Billing from '../pages/Billing';

// Mock the billing API
vi.mock('../api/billing', () => ({
  billingApi: {
    list: vi.fn(),
    dayEndReport: vi.fn(),
  },
}));

import { billingApi } from '../api/billing';

const mockInvoices = [
  {
    id: 1,
    invoice_number: 'INV-001',
    patient_name: 'John Doe',
    patient_id: 1,
    invoice_type: 'OPD',
    status: 'DRAFT',
    total: 1500.00,
    created_at: '2026-06-09T10:00:00Z',
  },
  {
    id: 2,
    invoice_number: 'INV-002',
    patient_name: 'Jane Smith',
    patient_id: 2,
    invoice_type: 'PHARMACY',
    status: 'ISSUED',
    total: 250.50,
    created_at: '2026-06-09T11:00:00Z',
  },
  {
    id: 3,
    invoice_number: 'INV-003',
    patient_name: 'Bob Wilson',
    patient_id: 3,
    invoice_type: 'LAB',
    status: 'PAID',
    total: 3200.00,
    created_at: '2026-06-08T09:00:00Z',
  },
];

const mockDayEndReport = {
  total_invoices: 15,
  total_revenue: 45250.00,
  opd_count: 8,
  pharmacy_count: 4,
  lab_count: 3,
  draft_count: 2,
  issued_count: 5,
  paid_count: 8,
};

function renderWithProviders(ui, { route = '/billing' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/billing" element={ui} />
          <Route path="/billing/:id" element={<div>Invoice Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Billing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingApi.list.mockResolvedValue({ data: mockInvoices });
    billingApi.dayEndReport.mockResolvedValue({ data: mockDayEndReport });
  });

  describe('Invoice List', () => {
    it('renders the page title', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('Billing')).toBeInTheDocument();
      });
    });

    it('renders invoice table with headers', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('Invoice #')).toBeInTheDocument();
        expect(screen.getByText('Patient')).toBeInTheDocument();
        expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
      });
    });

    it('displays invoices from the API', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('INV-001')).toBeInTheDocument();
        expect(screen.getByText('INV-002')).toBeInTheDocument();
        expect(screen.getByText('INV-003')).toBeInTheDocument();
      });
    });

    it('displays patient names in the table', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('displays formatted totals', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('₹1,500.00')).toBeInTheDocument();
        expect(screen.getByText('₹250.50')).toBeInTheDocument();
        expect(screen.getByText('₹3,200.00')).toBeInTheDocument();
      });
    });
  });

  describe('Status and Type display', () => {
    it('shows status badges with correct styling', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        const draftBadge = screen.getByText('DRAFT');
        const issuedBadge = screen.getByText('ISSUED');
        const paidBadge = screen.getByText('PAID');

        expect(draftBadge.className).toContain('yellow');
        expect(issuedBadge.className).toContain('blue');
        expect(paidBadge.className).toContain('green');
      });
    });

    it('shows invoice type badges', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getAllByText('OPD').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('PHARMACY').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('LAB').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Filters', () => {
    it('renders status filter dropdown', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });
    });

    it('renders type filter dropdown', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByLabelText('Type')).toBeInTheDocument();
      });
    });

    it('calls API with status filter when changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Status'), 'PAID');
      await waitFor(() => {
        expect(billingApi.list).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'PAID' })
        );
      });
    });

    it('calls API with type filter when changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByLabelText('Type')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Type'), 'LAB');
      await waitFor(() => {
        expect(billingApi.list).toHaveBeenCalledWith(
          expect.objectContaining({ invoice_type: 'LAB' })
        );
      });
    });

    it('clears status filter when empty option is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Billing />);
      await waitFor(() => screen.getByLabelText('Status'));

      // First select, then deselect
      await user.selectOptions(screen.getByLabelText('Status'), 'PAID');
      await user.selectOptions(screen.getByLabelText('Status'), '');
      await waitFor(() => {
        expect(billingApi.list).toHaveBeenLastCalledWith(
          expect.not.objectContaining({ status: 'PAID' })
        );
      });
    });
  });

  describe('New Invoice Button', () => {
    it('renders New Invoice button', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /new invoice/i })).toBeInTheDocument();
      });
    });
  });

  describe('Day-End Report Section', () => {
    it('renders the day-end report section heading', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('Day-End Report')).toBeInTheDocument();
      });
    });

    it('displays total invoices count', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('displays total revenue', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText('₹45,250.00')).toBeInTheDocument();
      });
    });

    it('displays breakdown by type', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getAllByText('OPD').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays breakdown by status', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Issued').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while fetching', () => {
      billingApi.list.mockImplementation(() => new Promise(() => {}));
      renderWithProviders(<Billing />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      billingApi.list.mockRejectedValue(new Error('Network error'));
      renderWithProviders(<Billing />);
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('links invoice rows to detail page', async () => {
      renderWithProviders(<Billing />);
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /INV-001/ });
        expect(link).toHaveAttribute('href', '/billing/1');
      });
    });
  });
});
