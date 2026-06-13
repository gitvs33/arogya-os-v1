import React from 'react';
import { Link } from 'react-router-dom';
import { Search, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function BillingRefunds() {
  const MOCK_REFUNDS: any[] = [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Refunds</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Requests</h1>
        </div>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm">
          + Initiate Refund
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search refunds..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Refund ID</th>
                <th className="px-6 py-4">Original Invoice</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_REFUNDS.map((refund) => (
                <tr key={refund.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-red-700">
                      <RotateCcw size={16} />
                      {refund.id}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{refund.date}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600 hover:text-blue-600 cursor-pointer">{refund.invoiceId}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{refund.patient}</td>
                  <td className="px-6 py-4 text-gray-600 truncate max-w-[200px]">{refund.reason}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">
                    ₹{refund.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 flex items-center justify-center gap-1.5 w-max mx-auto rounded-full text-[11px] font-bold uppercase tracking-wide ${
                      refund.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      refund.status === 'Pending Approval' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {refund.status === 'Approved' && <CheckCircle size={12} />}
                      {refund.status === 'Pending Approval' && <Clock size={12} />}
                      {refund.status === 'Rejected' && <XCircle size={12} />}
                      {refund.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {refund.status === 'Pending Approval' && (
                        <>
                          <button className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded" title="Approve">
                            <CheckCircle size={18} />
                          </button>
                          <button className="text-red-600 hover:bg-red-50 p-1.5 rounded" title="Reject">
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
