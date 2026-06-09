import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Alerts from '../pages/Alerts';

vi.mock('../api/alerts', () => ({
  alertsApi: {
    list: vi.fn(),
    acknowledge: vi.fn(),
    resolve: vi.fn(),
  },
}));

import { alertsApi } from '../api/alerts';

const mockAlerts = [
  {
    id: 1,
    alert_type: 'ALLERGY',
    severity: 'CRITICAL',
    patient_name: 'John Doe',
    patient_id: 1,
    message: 'Severe allergic reaction to Penicillin',
    status: 'ACTIVE',
    created_at: '2026-06-09T10:00:00Z',
  },
  {
    id: 2,
    alert_type: 'LAB_RESULT',
    severity: 'WARNING',
    patient_name: 'Jane Smith',
    patient_id: 2,
    message: 'Abnormal liver function tests',
    status: 'ACTIVE',
    created_at: '2026-06-09T09:00:00Z',
  },
  {
    id: 3,
    alert_type: 'VITAL_SIGN',
    severity: 'INFO',
    patient_name: 'Bob Wilson',
    patient_id: 3,
    message: 'Blood pressure slightly elevated',
    status: 'ACKNOWLEDGED',
    created_at: '2026-06-08T14:00:00Z',
  },
  {
    id: 4,
    alert_type: 'MEDICATION',
    severity: 'WARNING',
    patient_name: 'Alice Brown',
    patient_id: 4,
    message: 'Drug interaction detected',
    status: 'RESOLVED',
    created_at: '2026-06-08T11:00:00Z',
  },
];

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Alerts Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alertsApi.list.mockResolvedValue({ data: mockAlerts });
    alertsApi.acknowledge.mockResolvedValue({ data: { ...mockAlerts[0], status: 'ACKNOWLEDGED' } });
    alertsApi.resolve.mockResolvedValue({ data: { ...mockAlerts[0], status: 'RESOLVED' } });
  });

  describe('Alert List', () => {
    it('renders the page title', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByText('Alerts')).toBeInTheDocument();
      });
    });

    it('renders alert table with headers', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Severity').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Patient')).toBeInTheDocument();
        expect(screen.getByText('Message')).toBeInTheDocument();
        expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Date')).toBeInTheDocument();
      });
    });

    it('displays alerts from the API', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getAllByText('ALLERGY').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('LAB RESULT').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('VITAL SIGN').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('MEDICATION').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays patient names', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });
    });
  });

  describe('Severity Color Coding', () => {
    it('applies red styling for CRITICAL severity', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        const critical = screen.getByText('CRITICAL');
        expect(critical.className).toContain('red');
      });
    });

    it('applies yellow styling for WARNING severity', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        const warnings = screen.getAllByText('WARNING');
        warnings.forEach(w => {
          expect(w.className).toContain('yellow');
        });
      });
    });

    it('applies blue styling for INFO severity', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        const info = screen.getByText('INFO');
        expect(info.className).toContain('blue');
      });
    });
  });

  describe('Filters', () => {
    it('renders type filter dropdown', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByLabelText('Type')).toBeInTheDocument();
      });
    });

    it('renders severity filter dropdown', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      });
    });

    it('renders status filter dropdown', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });
    });

    it('calls API with type filter when changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Alerts />);
      await waitFor(() => screen.getByLabelText('Type'));

      await user.selectOptions(screen.getByLabelText('Type'), 'ALLERGY');
      await waitFor(() => {
        expect(alertsApi.list).toHaveBeenCalledWith(
          expect.objectContaining({ alert_type: 'ALLERGY' })
        );
      });
    });

    it('calls API with severity filter when changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Alerts />);
      await waitFor(() => screen.getByLabelText('Severity'));

      await user.selectOptions(screen.getByLabelText('Severity'), 'CRITICAL');
      await waitFor(() => {
        expect(alertsApi.list).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'CRITICAL' })
        );
      });
    });

    it('calls API with status filter when changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Alerts />);
      await waitFor(() => screen.getByLabelText('Status'));

      await user.selectOptions(screen.getByLabelText('Status'), 'ACTIVE');
      await waitFor(() => {
        expect(alertsApi.list).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'ACTIVE' })
        );
      });
    });
  });

  describe('Action Buttons', () => {
    it('renders Acknowledge button for active alerts', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        const acknowledgeButtons = screen.getAllByRole('button', { name: /acknowledge/i });
        expect(acknowledgeButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('renders Acknowledge only for ACTIVE alerts (not RESOLVED)', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        // 2 alerts are ACTIVE, 1 is ACKNOWLEDGED, 1 is RESOLVED
        // Acknowledge should only appear for the 2 ACTIVE alerts
        const acknowledgeButtons = screen.getAllByRole('button', { name: /acknowledge/i });
        expect(acknowledgeButtons).toHaveLength(2);
      });
    });

    it('renders Resolve button for active and acknowledged alerts', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        // 2 ACTIVE + 1 ACKNOWLEDGED = 3 resolve buttons
        const resolveButtons = screen.getAllByRole('button', { name: /resolve/i });
        expect(resolveButtons).toHaveLength(3);
      });
    });

    it('calls acknowledge API when Acknowledge is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /acknowledge/i }).length).toBeGreaterThan(0);
      });
      await user.click(screen.getAllByRole('button', { name: /acknowledge/i })[0]);
      await waitFor(() => {
        expect(alertsApi.acknowledge).toHaveBeenCalledWith(1);
      });
    });

    it('calls resolve API when Resolve is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /resolve/i }).length).toBeGreaterThan(0);
      });
      await user.click(screen.getAllByRole('button', { name: /resolve/i })[0]);
      await waitFor(() => {
        expect(alertsApi.resolve).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator', () => {
      alertsApi.list.mockImplementation(() => new Promise(() => {}));
      renderWithProviders(<Alerts />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      alertsApi.list.mockRejectedValue(new Error('Failed to fetch'));
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    it('displays alert messages', async () => {
      renderWithProviders(<Alerts />);
      await waitFor(() => {
        expect(screen.getByText('Severe allergic reaction to Penicillin')).toBeInTheDocument();
        expect(screen.getByText('Abnormal liver function tests')).toBeInTheDocument();
        expect(screen.getByText('Blood pressure slightly elevated')).toBeInTheDocument();
      });
    });
  });
});
