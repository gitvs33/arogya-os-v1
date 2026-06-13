import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { billingApi } from '../../api/billing';
import { FileText, Download, Plus } from 'lucide-react';

export default function PatientBilling({ patientId }: { patientId: string }) {
  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['patient-invoices', patientId],
    queryFn: () => patientsApi.getInvoices(patientId).then((res) => res.data),
  });

  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState({ type: 'OPD', department: '', dueDate: '' });

  const mutation = useMutation({
    mutationFn: (data: any) => billingApi.create(data).then(res => res.data),
    onSuccess: () => {
      refetch();
      setShowModal(false);
      setForm({ type: 'OPD', department: '', dueDate: '' });
    },
    onError: (err: any) => {
      alert("Failed to create invoice: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      patient: patientId,
      invoice_type: form.type,
      department: form.department,
      due_date: form.dueDate || undefined,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(invoices) ? invoices : (invoices?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Billing & Invoices</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Invoice No</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No invoices recorded.</td>
              </tr>
            ) : (
              list.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      {inv.invoice_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-gray-600">{inv.invoice_type}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">₹{parseFloat(inv.total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      inv.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[#0A6253] hover:text-teal-700 font-medium text-xs flex items-center gap-1 justify-end w-full">
                      <Download size={14} /> Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Invoice</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Invoice Type</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253]"
                  value={form.type}
                  onChange={e => setForm({...form, type: e.target.value})}
                  required
                >
                  <option value="OPD">OPD Consultation</option>
                  <option value="IPD">Inpatient</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="LAB">Laboratory</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
                <input 
                  type="text"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253]"
                  value={form.department}
                  onChange={e => setForm({...form, department: e.target.value})}
                  placeholder="E.g., Cardiology"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Due Date</label>
                <input 
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0A6253] focus:ring-1 focus:ring-[#0A6253]"
                  value={form.dueDate}
                  onChange={e => setForm({...form, dueDate: e.target.value})}
                />
              </div>
              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={mutation.isPending}
                  className="px-4 py-2 bg-[#0A6253] text-white text-sm font-semibold rounded-lg hover:bg-[#084d41] disabled:opacity-50"
                >
                  {mutation.isPending ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
