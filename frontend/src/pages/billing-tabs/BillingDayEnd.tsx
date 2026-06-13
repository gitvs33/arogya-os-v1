import React from 'react';
import { Link } from 'react-router-dom';
import { FileBarChart, Download, DollarSign, Wallet, CreditCard, IndianRupee } from 'lucide-react';

export default function BillingDayEnd() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/billing" className="hover:text-gray-900">Billing</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Day End</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Day End Reconciliation</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-medium hover:bg-[#084d41] shadow-sm">
          <Download size={16} /> Generate EOD Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-[#0A6253]">
            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={20} /></div>
            <span className="font-semibold text-sm uppercase tracking-wide">Total Collected</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">₹0</div>
          <div className="text-sm text-emerald-600 font-medium mt-2">0% vs yesterday</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-orange-600">
            <div className="p-2 bg-orange-50 rounded-lg"><Wallet size={20} /></div>
            <span className="font-semibold text-sm uppercase tracking-wide">Cash Collections</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">₹0</div>
          <div className="text-sm text-gray-500 font-medium mt-2">0 transactions</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-blue-600">
            <div className="p-2 bg-blue-50 rounded-lg"><IndianRupee size={20} /></div>
            <span className="font-semibold text-sm uppercase tracking-wide">UPI / Wallets</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">₹0</div>
          <div className="text-sm text-gray-500 font-medium mt-2">0 transactions</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-purple-600">
            <div className="p-2 bg-purple-50 rounded-lg"><CreditCard size={20} /></div>
            <span className="font-semibold text-sm uppercase tracking-wide">Card Payments</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">₹0</div>
          <div className="text-sm text-gray-500 font-medium mt-2">0 transactions</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileBarChart size={18} className="text-gray-400" /> Collection by Department
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Cardiology</span>
              <span className="font-bold text-gray-900">₹0</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Orthopedics</span>
              <span className="font-bold text-gray-900">₹0</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">General Medicine</span>
              <span className="font-bold text-gray-900">₹0</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileBarChart size={18} className="text-gray-400" /> Summary Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Total Invoices Generated</span>
              <span className="font-bold text-gray-900">0</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Refunds Processed</span>
              <span className="font-bold text-red-600">0 (₹0)</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Pending Approvals</span>
              <span className="font-bold text-orange-500">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
