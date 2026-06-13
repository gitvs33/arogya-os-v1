import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Filter, Download, MoreVertical, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BillingInvoices() {
  const location = useLocation();
  const path = location.pathname.split('/').pop() || 'invoices';
  
  const titleMap: Record<string, string> = {
    'invoices': 'All Invoices',
    'opd': 'OPD Billing',
    'ipd': 'IPD Billing',
    'pharmacy': 'Pharmacy Billing',
    'laboratory': 'Laboratory Billing',
  };
  
  const title = titleMap[path] || 'Invoices';

  const MOCK_INVOICES: any[] = [];

  const filteredInvoices = path === 'invoices' 
    ? MOCK_INVOICES 
    : MOCK_INVOICES.filter(i => i.type.toLowerCase() === path);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{title}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <Download size={16} /> Export
          </button>
          <button className="px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-medium hover:bg-[#084d41] shadow-sm">
            + Create New Invoice
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by Invoice ID, Patient Name, or MRN..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={16} /> Status
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={16} /> Date Range
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Patient Details</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-[#0A6253] cursor-pointer hover:underline">
                      <FileText size={16} />
                      {inv.id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{inv.patient}</div>
                    <div className="text-xs text-gray-500 mt-0.5">MRN: {inv.mrn}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{inv.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                      {inv.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    ₹{inv.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                      inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                      inv.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                      inv.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No invoices found for this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">Showing 1 to {filteredInvoices.length} of {filteredInvoices.length} entries</span>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-gray-200 rounded text-gray-400 hover:bg-gray-50" disabled><ChevronLeft size={16} /></button>
            <button className="px-3 py-1 bg-[#0A6253] text-white rounded font-medium text-sm">1</button>
            <button className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
