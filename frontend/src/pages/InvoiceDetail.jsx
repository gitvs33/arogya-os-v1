import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billing';

function StatusBadge({ status }) {
  const colors = {
    DRAFT: 'bg-yellow-100 text-yellow-700',
    ISSUED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
        colors[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading invoice...</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
      {message || 'Error loading invoice. Please try again.'}
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [lineItemForm, setLineItemForm] = useState({
    description: '',
    quantity: 1,
    unit_price: '',
  });

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => billingApi.get(id).then((res) => res.data),
  });

  const issueMutation = useMutation({
    mutationFn: () => billingApi.issue(id),
    onSuccess: (res) => {
      queryClient.setQueryData(['invoice', id], res.data);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => billingApi.markPaid(id),
    onSuccess: (res) => {
      queryClient.setQueryData(['invoice', id], res.data);
    },
  });

  const addLineItemMutation = useMutation({
    mutationFn: (data) => billingApi.addLineItem(id, data),
    onSuccess: (res) => {
      queryClient.setQueryData(['invoice', id], res.data);
      setShowLineItemForm(false);
      setLineItemForm({ description: '', quantity: 1, unit_price: '' });
    },
  });

  const handleAddLineItem = (e) => {
    e.preventDefault();
    addLineItemMutation.mutate({
      description: lineItemForm.description,
      quantity: parseInt(lineItemForm.quantity, 10),
      unit_price: parseFloat(lineItemForm.unit_price),
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!invoice) return null;

  const canIssue = invoice.status === 'DRAFT';
  const canMarkPaid = invoice.status === 'ISSUED';
  const isPaid = invoice.status === 'PAID';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/billing"
        className="text-sm text-gray-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
      >
        ← Back to Billing
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice {invoice.invoice_number}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {formatDate(invoice.created_at)}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      {/* Invoice Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Invoice Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 font-medium">Invoice Number</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {invoice.invoice_number}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Patient</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {invoice.patient_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Type</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {invoice.invoice_type}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Status</p>
            <p className="mt-1">
              <StatusBadge status={invoice.status} />
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Issued At</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {formatDate(invoice.issued_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Paid At</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {formatDate(invoice.paid_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {canIssue && (
          <button
            onClick={() => issueMutation.mutate()}
            disabled={issueMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium inline-flex items-center gap-2"
          >
            {issueMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Issuing...
              </>
            ) : (
              'Issue Invoice'
            )}
          </button>
        )}
        {canMarkPaid && (
          <button
            onClick={() => markPaidMutation.mutate()}
            disabled={markPaidMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium inline-flex items-center gap-2"
          >
            {markPaidMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </>
            ) : (
              'Mark Paid'
            )}
          </button>
        )}
        {!isPaid && (
          <button
            onClick={() => setShowLineItemForm(!showLineItemForm)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {showLineItemForm ? 'Cancel' : 'Add Line Item'}
          </button>
        )}
      </div>

      {/* Add Line Item Form */}
      {showLineItemForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Add Line Item
          </h3>
          <form onSubmit={handleAddLineItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <input
                  id="description"
                  type="text"
                  value={lineItemForm.description}
                  onChange={(e) =>
                    setLineItemForm({ ...lineItemForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  placeholder="Item description"
                  required
                  aria-label="Description"
                />
              </div>
              <div>
                <label
                  htmlFor="quantity"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  value={lineItemForm.quantity}
                  onChange={(e) =>
                    setLineItemForm({ ...lineItemForm, quantity: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  aria-label="Quantity"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="unit_price"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Unit Price
                </label>
                <input
                  id="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={lineItemForm.unit_price}
                  onChange={(e) =>
                    setLineItemForm({ ...lineItemForm, unit_price: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  placeholder="0.00"
                  aria-label="Unit Price"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addLineItemMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {addLineItemMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Line Items
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                Description
              </th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Qty</th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">
                Unit Price
              </th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.line_items?.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  No line items added yet.
                </td>
              </tr>
            ) : (
              invoice.line_items?.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="max-w-xs ml-auto space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax</span>
            <span className="text-gray-900">{formatCurrency(invoice.tax)}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-base font-bold text-blue-600">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
