import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, Plus, X, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function DepartmentSetup() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    head_of_department: '',
    is_active: true,
  });

  // Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminApi.listDepartments(),
  });
  const departments = response?.data?.results || response?.data || [];

  const { data: usersResponse } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers(),
  });
  const users = usersResponse?.data?.results || usersResponse?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteDeptMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-departments'] }); },
    onError: (err: any) => { setErrorDialog({ isOpen: true, message: err.response?.data?.detail || err.message || 'Failed to delete department.' }); }
  });

  const filteredDepts = departments.filter((dept: any) => 
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.head_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setEditingDept(null);
    setFormData({ name: '', code: '', description: '', head_of_department: '', is_active: true });
  };

  const openEditModal = (dept: any) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      head_of_department: dept.head_of_department || '',
      is_active: dept.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDept) {
      updateMutation.mutate({ id: editingDept.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Department Setup</h1>
            <p className="text-gray-500 mt-1">Manage hospital departments, capacity, and administration.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084e42] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>New Department</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search departments or heads..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
            />
          </div>
        </div>

        {/* Grid View */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading departments...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDepts.map((dept: any) => {
              return (
                <div key={dept.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-50 relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
                        <Building2 size={28} />
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        !dept.is_active 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#0A6253] transition-colors">{dept.name}</h2>
                      <p className="text-sm text-gray-500 font-mono mt-0.5">{dept.code}</p>
                    </div>
                  </div>

                  <div className="p-6 flex-1 space-y-5">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Head of Department</p>
                      <p className="font-semibold text-gray-800 flex items-center gap-2">
                        {dept.head_name ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                              {dept.head_name.split(' ').map((n: string) => n[0]).join('').replace('D', '')}
                            </div>
                            {dept.head_name}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {dept.description || 'No description provided.'}
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditModal(dept)}
                      className="text-sm font-medium text-gray-600 hover:text-[#0A6253] flex items-center gap-1.5"
                    >
                      <Edit3 size={16} />
                      Edit Details
                    </button>
                    <button 
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        title: 'Delete Department',
                        message: `Are you sure you want to delete ${dept.name}?`,
                        onConfirm: () => {
                          deleteDeptMut.mutate(dept.id);
                          setConfirmDialog(p => ({ ...p, isOpen: false }));
                        }
                      })}
                      className="text-gray-400 hover:text-red-600 flex items-center p-1 rounded transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">{editingDept ? 'Edit Department' : 'New Department'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input 
                  type="text" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input 
                  type="text" required
                  value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Head of Department</label>
                <select 
                  value={formData.head_of_department} 
                  onChange={e => setFormData({...formData, head_of_department: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]"
                >
                  <option value="">None</option>
                  {users.map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" id="isActive"
                  checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="rounded border-gray-300 text-[#0A6253] focus:ring-[#0A6253]"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
              </div>
              
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42]">
                  {editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} 
      />

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
