import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Download, MoreVertical, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BillingPayments() {
  const MOCK_PAYMENTS: any[] = [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Payments</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & Receipts</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <Download size={16} /> Export CSV
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">
            + Record Payment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by Receipt ID or Patient Name..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={16} /> Method
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Receipt ID</th>
                <th className="px-6 py-4">Linked Invoice</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Payment Method</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_PAYMENTS.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-emerald-700 cursor-pointer hover:underline">
                      <CreditCard size={16} />
                      {payment.id}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{payment.date}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600 hover:text-blue-600 cursor-pointer">{payment.invoiceId}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{payment.patient}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">
                    ₹{payment.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                      payment.status === 'Success' ? 'bg-emerald-100 text-emerald-700' :
                      payment.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {payment.status}
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
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">Showing 1 to 5 of 24 entries</span>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-gray-200 rounded text-gray-400 hover:bg-gray-50" disabled><ChevronLeft size={16} /></button>
            <button className="px-3 py-1 bg-emerald-600 text-white rounded font-medium text-sm">1</button>
            <button className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
