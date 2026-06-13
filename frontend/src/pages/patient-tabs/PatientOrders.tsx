import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../api/patients';
import { Plus, MoreVertical, FileText } from 'lucide-react';

export default function PatientOrders({ patientId }: { patientId: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['patient-orders', patientId],
    queryFn: () => patientsApi.getOrders(patientId).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const list = Array.isArray(orders) ? orders : (orders?.results || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">Service Orders</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
          <Plus size={16} /> New Order
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Order Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Ordered By</th>
              <th className="px-6 py-4">Ordered At</th>
              <th className="px-6 py-4">Completed At</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No orders recorded.</td>
              </tr>
            ) : (
              list.map((o: any) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      {o.order_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{o.category?.toLowerCase() || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      o.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      o.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">Dr. User {o.ordered_by}</td>
                  <td className="px-6 py-4 text-gray-600">{new Date(o.ordered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4 text-gray-600">{o.completed_at ? new Date(o.completed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-700"><MoreVertical size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
