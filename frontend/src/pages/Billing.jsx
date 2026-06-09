import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billing';

const INVOICE_TYPES = ['', 'OPD', 'PHARMACY', 'LAB'];
const STATUSES = ['', 'DRAFT', 'ISSUED', 'PAID'];

function StatusBadge({ status }) {
  const colors = {
    DRAFT: 'bg-yellow-100 text-yellow-700',
    ISSUED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  const colors = {
    OPD: 'bg-purple-100 text-purple-700',
    PHARMACY: 'bg-indigo-100 text-indigo-700',
    LAB: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[type] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {type}
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
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading invoices...</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
      {message || 'Error loading invoices. Please try again.'}
    </div>
  );
}

export default function Billing() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', { status: statusFilter, invoice_type: typeFilter }],
    queryFn: () => billingApi.list({ status: statusFilter, invoice_type: typeFilter }),
  });

  const { data: dayEndData } = useQuery({
    queryKey: ['day-end-report'],
    queryFn: () => billingApi.dayEndReport().then((res) => res.data),
  });

  const invoices = data?.data || [];

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <Link
          to="/billing/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm inline-flex items-center gap-1"
        >
          <span>+</span> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Status"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            aria-label="Type"
          >
            <option value="">All Types</option>
            {INVOICE_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/billing/${invoice.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    <Link
                      to={`/patients/${invoice.patient_id}`}
                      className="text-gray-900 hover:text-blue-600"
                    >
                      {invoice.patient_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <TypeBadge type={invoice.invoice_type} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(invoice.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Day-End Report */}
      {dayEndData && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Day-End Report</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Invoices</span>
                  <span className="text-lg font-bold text-gray-900">
                    {dayEndData.total_invoices}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Revenue</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(dayEndData.total_revenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* By Type */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                By Type
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    OPD
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.opd_count}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    PHARMACY
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.pharmacy_count}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    LAB
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.lab_count}
                  </span>
                </div>
              </div>
            </div>

            {/* By Status */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                By Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Draft
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.draft_count}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Issued
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.issued_count}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Paid
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {dayEndData.paid_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
