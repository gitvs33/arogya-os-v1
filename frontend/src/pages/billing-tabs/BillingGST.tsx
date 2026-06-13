import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Calculator, ReceiptText, Calendar } from 'lucide-react';

export default function BillingGST() {
  const MOCK_GST: any[] = [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">GST Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GST Ledger</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 shadow-sm">
            <Calendar size={16} /> June 2026
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            <Download size={16} /> Download GSTR-1
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Total Base Amount</div>
          <div className="text-2xl font-bold text-gray-900">₹0.00</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-2">
            <Calculator size={16} className="text-blue-500" /> Total Tax Collected
          </div>
          <div className="flex gap-6 mt-1">
            <div>
              <div className="text-2xl font-bold text-blue-600">₹0.00</div>
              <div className="text-xs text-gray-500 font-medium">CGST</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">₹0.00</div>
              <div className="text-xs text-gray-500 font-medium">SGST</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Total Invoice Value</div>
          <div className="text-2xl font-bold text-emerald-600">₹0.00</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4 text-right">Base Amount</th>
                <th className="px-6 py-4 text-right">CGST</th>
                <th className="px-6 py-4 text-right">SGST</th>
                <th className="px-6 py-4 text-right bg-gray-50 border-l border-gray-200">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_GST.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-blue-700">
                      <ReceiptText size={16} />
                      {row.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{row.date}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{row.patient}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-600">₹{row.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right font-medium text-blue-600">₹{row.cgst.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right font-medium text-indigo-600">₹{row.sgst.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900 bg-gray-50 border-l border-gray-200">₹{row.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
