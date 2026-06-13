import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Plus, Edit3, Bed, ChevronRight, X, LayoutGrid, Trash2, AlertTriangle } from 'lucide-react';

export default function WardSetup() {
  const queryClient = useQueryClient();
  const [selectedWard, setSelectedWard] = useState<any>(null);
  const [isWardModalOpen, setIsWardModalOpen] = useState(false);
  const [isBedsModalOpen, setIsBedsModalOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const [wardForm, setWardForm] = useState({ name: '', description: '', is_active: true, bed_charge_per_day: '' as number | string });
  const [bulkBedsCount, setBulkBedsCount] = useState(1);

  // Queries
  const { data: wardsResponse, isLoading: wardsLoading } = useQuery({
    queryKey: ['admin-wards'],
    queryFn: () => adminApi.listWards(),
  });
  const wards = wardsResponse?.data?.results || wardsResponse?.data || [];

  const { data: bedsResponse } = useQuery({
    queryKey: ['admin-ward-beds', selectedWard?.id],
    queryFn: () => adminApi.listBeds(selectedWard!.id),
    enabled: !!selectedWard,
  });
  const beds = (bedsResponse?.data || []).slice().sort((a: any, b: any) => 
    String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true })
  );

  // Mutations
  const createWardMut = useMutation({
    mutationFn: (data: any) => adminApi.createWard(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-wards'] }); setIsWardModalOpen(false); }
  });
  const updateWardMut = useMutation({
    mutationFn: ({ id, data }: any) => adminApi.updateWard(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-wards'] }); setIsWardModalOpen(false); }
  });
  const bulkCreateBedsMut = useMutation({
    mutationFn: ({ wardId, count }: any) => adminApi.bulkCreateBeds(wardId, count),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['admin-wards'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ward-beds'] }); 
      setBulkBedsCount(1);
    }
  });
  const updateBedStatusMut = useMutation({
    mutationFn: ({ wardId, bedId, status }: any) => adminApi.updateBedStatus(wardId, bedId, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ward-beds'] }); }
  });
  const deleteWardMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteWard(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-wards'] }); },
    onError: (err: any) => { setErrorDialog({ isOpen: true, message: err.response?.data?.detail || err.message || 'Error deleting ward' }); }
  });
  const deleteBedMut = useMutation({
    mutationFn: ({ wardId, bedId }: any) => adminApi.deleteBed(wardId, bedId),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['admin-wards'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ward-beds'] }); 
    },
    onError: (err: any) => { setErrorDialog({ isOpen: true, message: err.response?.data?.detail || err.message || 'Error deleting bed' }); }
  });

  const openWardModal = (ward?: any) => {
    if (ward) {
      setEditingWard(ward);
      setWardForm({ name: ward.name, description: ward.description, is_active: ward.is_active, bed_charge_per_day: ward.bed_charge_per_day ?? '' });
    } else {
      setEditingWard(null);
      setWardForm({ name: '', description: '', is_active: true, bed_charge_per_day: '' });
    }
    setIsWardModalOpen(true);
  };

  const handleWardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWard) updateWardMut.mutate({ id: editingWard.id, data: wardForm });
    else createWardMut.mutate(wardForm);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ward Setup</h1>
            <p className="text-gray-500 mt-1">Manage hospital wards and bed inventory.</p>
          </div>
          <button 
            onClick={() => openWardModal()}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084e42] text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            <span>New Ward</span>
          </button>
        </div>

        {wardsLoading ? (
          <div className="text-center py-12 text-gray-500">Loading wards...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wards.map((ward: any) => (
              <div key={ward.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-[#E8F5F0] text-[#0A6253] rounded-xl">
                    <LayoutGrid size={24} />
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ward.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {ward.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{ward.name}</h3>
                <p className="text-sm text-gray-500 mt-1 flex-1">{ward.description || 'No description'}</p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Bed size={16} className="text-gray-400" />
                    {ward.bed_count || 0} Beds Total
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        title: 'Delete Ward',
                        message: `Are you sure you want to delete ${ward.name}? All unoccupied beds will be deleted permanently.`,
                        onConfirm: () => {
                          deleteWardMut.mutate(ward.id);
                          setConfirmDialog(prev => ({...prev, isOpen: false}));
                        }
                      })} 
                      disabled={deleteWardMut.isPending}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                      title="Delete Ward"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button onClick={() => openWardModal(ward)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#0A6253] hover:bg-teal-50 rounded-lg transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => { setSelectedWard(ward); setIsBedsModalOpen(true); }}
                      className="w-8 h-8 flex items-center justify-center text-[#0A6253] bg-[#E8F5F0] hover:bg-[#D1EAE0] rounded-lg transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ward Modal */}
      {isWardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{editingWard ? 'Edit Ward' : 'New Ward'}</h3>
              <button onClick={() => setIsWardModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
            </div>
            <form onSubmit={handleWardSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward Name</label>
                <input required type="text" value={wardForm.name} onChange={e => setWardForm({...wardForm, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={wardForm.description} onChange={e => setWardForm({...wardForm, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bed Charge Per Day (₹)</label>
                <input required type="number" min="0" step="1" value={wardForm.bed_charge_per_day} onChange={e => setWardForm({...wardForm, bed_charge_per_day: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="wardActive" checked={wardForm.is_active} onChange={e => setWardForm({...wardForm, is_active: e.target.checked})} className="rounded text-[#0A6253]" />
                <label htmlFor="wardActive" className="text-sm font-medium">Active</label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsWardModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={createWardMut.isPending || updateWardMut.isPending} className="px-4 py-2 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Beds Modal */}
      {isBedsModalOpen && selectedWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedWard.name} - Manage Beds</h3>
                <p className="text-xs text-gray-500">Total beds: {beds.length}</p>
              </div>
              <button onClick={() => setIsBedsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
            </div>
            
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Bulk Add Beds</label>
                <input type="number" min="1" max="50" value={bulkBedsCount} onChange={e => setBulkBedsCount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253] text-sm" />
              </div>
              <button 
                onClick={() => bulkCreateBedsMut.mutate({ wardId: selectedWard.id, count: bulkBedsCount })}
                disabled={bulkCreateBedsMut.isPending}
                className="px-4 py-2 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42] text-sm disabled:opacity-50"
              >
                + Add {bulkBedsCount} Beds
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {beds.map((bed: any) => (
                  <div key={bed.id} className="relative bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm group">
                    <button 
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        title: 'Delete Bed',
                        message: `Are you sure you want to delete bed ${bed.bed_number}?`,
                        onConfirm: () => {
                          deleteBedMut.mutate({ wardId: selectedWard.id, bedId: bed.id });
                          setConfirmDialog(prev => ({...prev, isOpen: false}));
                        }
                      })}
                      disabled={deleteBedMut.isPending || bed.status === 'Occupied'}
                      className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded hidden group-hover:block disabled:opacity-50"
                      title={bed.status === 'Occupied' ? "Cannot delete occupied bed" : "Delete Bed"}
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="font-bold text-gray-900 mb-1 mt-2">{bed.bed_number}</div>
                    <select
                      value={bed.status}
                      onChange={(e) => updateBedStatusMut.mutate({ wardId: selectedWard.id, bedId: bed.id, status: e.target.value })}
                      className={`text-xs w-full p-1 rounded border outline-none ${
                        bed.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        bed.status === 'Occupied' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                ))}
                {beds.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">No beds configured for this ward.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-full shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 leading-tight">{confirmDialog.title}</h3>
                  <p className="text-gray-600 text-sm mt-2">{confirmDialog.message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorDialog.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-full shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 leading-tight">Action Failed</h3>
                  <p className="text-gray-600 text-sm mt-2">{errorDialog.message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setErrorDialog({ isOpen: false, message: '' })}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
