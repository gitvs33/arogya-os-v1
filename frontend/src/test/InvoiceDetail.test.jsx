import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvoiceDetail from '../pages/InvoiceDetail';

vi.mock('../api/billing', () => ({
  billingApi: {
    get: vi.fn(),
    issue: vi.fn(),
    markPaid: vi.fn(),
    addLineItem: vi.fn(),
  },
}));

import { billingApi } from '../api/billing';

const mockInvoice = {
  id: 1,
  invoice_number: 'INV-001',
  patient_name: 'John Doe',
  patient_id: 1,
  invoice_type: 'OPD',
  status: 'DRAFT',
  subtotal: 1400.00,
  tax: 100.00,
  total: 1500.00,
  created_at: '2026-06-09T10:00:00Z',
  issued_at: null,
  paid_at: null,
  line_items: [
    {
      id: 1,
      description: 'Consultation Fee',
      quantity: 1,
      unit_price: 1000.00,
      total: 1000.00,
    },
    {
      id: 2,
      description: 'Medication - Paracetamol',
      quantity: 2,
      unit_price: 200.00,
      total: 400.00,
    },
  ],
};

function renderWithProviders(ui, { route = '/billing/1' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/billing/:id" element={ui} />
          <Route path="/billing" element={<div>Billing List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InvoiceDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingApi.get.mockResolvedValue({ data: mockInvoice });
    billingApi.issue.mockResolvedValue({ data: { ...mockInvoice, status: 'ISSUED' } });
    billingApi.markPaid.mockResolvedValue({ data: { ...mockInvoice, status: 'PAID' } });
    billingApi.addLineItem.mockResolvedValue({
      data: { ...mockInvoice, line_items: [...mockInvoice.line_items, { id: 3, description: 'New Item', quantity: 1, unit_price: 500, total: 500 }], subtotal: 1900, tax: 100, total: 2000 }
    });
  });

  describe('Invoice Info Card', () => {
    it('renders invoice number', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('INV-001')).toBeInTheDocument();
      });
    });

    it('renders patient name', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('renders invoice type', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('OPD')).toBeInTheDocument();
      });
    });

    it('renders invoice status with badge', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        const statuses = screen.getAllByText('DRAFT');
        expect(statuses.length).toBeGreaterThanOrEqual(1);
        expect(statuses[0].className).toContain('yellow');
      });
    });

    it('renders dates', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getAllByText(/created/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/9 Jun 2026/)).toBeInTheDocument();
      });
    });
  });

  describe('Line Items Table', () => {
    it('renders table headers for line items', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Qty')).toBeInTheDocument();
        expect(screen.getByText('Unit Price')).toBeInTheDocument();
        expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays line item descriptions', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('Consultation Fee')).toBeInTheDocument();
        expect(screen.getByText('Medication - Paracetamol')).toBeInTheDocument();
      });
    });

    it('displays line item quantities', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('displays unit prices', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('₹200.00')).toBeInTheDocument();
      });
    });

    it('displays line item totals', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('₹400.00')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Section', () => {
    it('displays subtotal', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        const subtotalLabel = screen.getByText('Subtotal');
        expect(subtotalLabel).toBeInTheDocument();
      });
    });

    it('displays tax', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('Tax')).toBeInTheDocument();
      });
    });

    it('displays total', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('₹1,500.00')).toBeInTheDocument();
      });
    });

    it('shows correct subtotal amount', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('₹1,400.00')).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('renders Issue button for DRAFT invoice', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /issue/i })).toBeInTheDocument();
      });
    });

    it('does not render Issue button for PAID invoice', async () => {
      billingApi.get.mockResolvedValue({ data: { ...mockInvoice, status: 'PAID' } });
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /issue/i })).not.toBeInTheDocument();
      });
    });

    it('renders Mark Paid button for ISSUED invoice', async () => {
      billingApi.get.mockResolvedValue({ data: { ...mockInvoice, status: 'ISSUED' } });
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark paid/i })).toBeInTheDocument();
      });
    });

    it('does not render Mark Paid for DRAFT invoice', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
      });
    });

    it('calls issue API when Issue button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /issue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /issue/i }));
      await waitFor(() => {
        expect(billingApi.issue).toHaveBeenCalledWith('1');
      });
    });

    it('calls markPaid API when Mark Paid is clicked', async () => {
      billingApi.get.mockResolvedValue({ data: { ...mockInvoice, status: 'ISSUED' } });
      const user = userEvent.setup();
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark paid/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /mark paid/i }));
      await waitFor(() => {
        expect(billingApi.markPaid).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Add Line Item', () => {
    it('renders Add Line Item button', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add line item/i })).toBeInTheDocument();
      });
    });

    it('shows form when Add Line Item is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InvoiceDetail />);
      await waitFor(async () => {
        expect(await screen.findByRole('button', { name: /add line item/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /add line item/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/unit price/i)).toBeInTheDocument();
      });
    });

    it('calls addLineItem API on form submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add line item/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /add line item/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });
      await user.type(screen.getByLabelText(/description/i), 'New Test Item');
      await user.clear(screen.getByLabelText(/quantity/i));
      await user.type(screen.getByLabelText(/quantity/i), '2');
      await user.clear(screen.getByLabelText(/unit price/i));
      await user.type(screen.getByLabelText(/unit price/i), '500');
      await user.click(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => {
        expect(billingApi.addLineItem).toHaveBeenCalledWith('1', {
          description: 'New Test Item',
          quantity: 2,
          unit_price: 500,
        });
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator', () => {
      billingApi.get.mockImplementation(() => new Promise(() => {}));
      renderWithProviders(<InvoiceDetail />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      billingApi.get.mockRejectedValue(new Error('Failed to load'));
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });
  });

  describe('Back Navigation', () => {
    it('renders back to billing link', async () => {
      renderWithProviders(<InvoiceDetail />);
      await waitFor(() => {
        expect(screen.getByText(/← back/i)).toBeInTheDocument();
      });
    });
  });
});
