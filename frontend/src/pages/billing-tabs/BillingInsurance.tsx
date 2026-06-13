import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Search, Filter, MoreVertical, FileText, CheckCircle, Clock } from 'lucide-react';

export default function BillingInsurance() {
  const MOCK_CLAIMS: any[] = [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Insurance & TPA</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Claims Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            + New Claim
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Total Pending Claims</div>
          <div className="text-2xl font-bold text-gray-900">0</div>
          <div className="text-sm text-orange-500 font-medium mt-1">₹0 outstanding</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Settled This Month</div>
          <div className="text-2xl font-bold text-emerald-600">0</div>
          <div className="text-sm text-emerald-600 font-medium mt-1">₹0 settled</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Rejection Rate</div>
          <div className="text-2xl font-bold text-red-600">0%</div>
          <div className="text-sm text-gray-500 font-medium mt-1">No data</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by Claim ID, Patient, or Provider..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={16} /> Provider
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={16} /> Status
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Claim ID</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Linked Invoice</th>
                <th className="px-6 py-4 text-right">Claim Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_CLAIMS.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-blue-700 cursor-pointer hover:underline">
                      <ShieldCheck size={16} />
                      {claim.id}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{claim.date}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{claim.provider}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{claim.patient}</td>
                  <td className="px-6 py-4 font-mono text-gray-600 hover:text-blue-600 cursor-pointer">{claim.invoiceId}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">
                    ₹{claim.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 flex items-center justify-center gap-1.5 w-max mx-auto rounded-full text-[11px] font-bold uppercase tracking-wide ${
                      claim.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      claim.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                      claim.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {claim.status === 'Approved' && <CheckCircle size={12} />}
                      {claim.status === 'Pending' && <Clock size={12} />}
                      {claim.status}
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
      </div>
    </div>
  );
}
