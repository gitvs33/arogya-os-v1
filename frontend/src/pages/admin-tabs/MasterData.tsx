import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { 
  Building2, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  Filter,
  MoreVertical,
  X
} from 'lucide-react';

const CATEGORIES = [
  { id: 'room_types', label: 'Room Types', icon: Building2 },
  { id: 'encounter_types', label: 'Encounter Types', icon: Clock },
];

export default function MasterData() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].id);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [activeCategory, setActiveCategory] = useState('room_types');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [formData, setFormData] = useState({ code: '', name: '', description: '', status: 'Active' });

  // Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-master-data', activeCategory],
    queryFn: () => adminApi.listMasterData(activeCategory),
  });
  const currentData = response?.data?.results || response?.data || [];

  const filteredData = currentData.filter((item: any) => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: any) => adminApi.createMasterData({ ...data, category: activeCategory }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-master-data'] }); setIsModalOpen(false); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => adminApi.updateMasterData(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-master-data'] }); setIsModalOpen(false); }
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteMasterData(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-master-data'] }); }
  });

  const openModal = (entry?: any) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({ code: entry.code, name: entry.name, description: entry.description || '', status: entry.is_active ? 'Active' : 'Inactive' });
    } else {
      setEditingEntry(null);
      setFormData({ code: '', name: '', description: '', status: 'Active' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: formData.code,
      name: formData.name,
      description: formData.description,
      is_active: formData.status === 'Active'
    };
    if (editingEntry) updateMut.mutate({ id: editingEntry.id, data: payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="flex h-full bg-[#F8F9FA] rounded-xl overflow-hidden shadow-sm border border-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Master Data</h2>
          <p className="text-sm text-gray-500 mt-1">Manage system lookups</p>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#0A6253]/10 text-[#0A6253]' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#0A6253]' : 'text-gray-400'}`} />
                  {category.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#F8F9FA] min-w-0">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
              />
            </div>
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084f43] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-[#0A6253]/20"
          >
            <Plus className="w-4 h-4" />
            Add Record
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading data...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">No records found.</td></tr>
                ) : (
                  filteredData.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{row.description}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          row.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                            : 'bg-red-50 text-red-700 border border-red-200/50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(row)} className="p-1.5 text-gray-400 hover:text-[#0A6253] hover:bg-[#0A6253]/10 rounded-md transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Delete Entry',
                                message: 'Are you sure you want to delete this entry?',
                                onConfirm: () => {
                                  deleteMut.mutate(row.id);
                                  setConfirmDialog(p => ({ ...p, isOpen: false }));
                                }
                              });
                            }} 
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{editingEntry ? 'Edit Record' : 'Add Record'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} 
      />
    </div>
  );
}
