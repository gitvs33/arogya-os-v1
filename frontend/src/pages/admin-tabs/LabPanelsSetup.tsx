import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Plus, Edit3, FlaskConical, ChevronRight, X, List } from 'lucide-react';

export default function LabPanelsSetup() {
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState<any>(null);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<any>(null);

  const [panelForm, setPanelForm] = useState({ name: '', code: '', description: '', price: '' as number | string, is_active: true });
  const [paramForm, setParamForm] = useState({ name: '', code: '', unit: '', reference_range: '' });

  // Queries
  const { data: panelsResponse, isLoading: panelsLoading } = useQuery({
    queryKey: ['admin-lab-panels'],
    queryFn: () => adminApi.listLabPanels(),
  });
  const panels = panelsResponse?.data?.results || panelsResponse?.data || [];

  const { data: paramsResponse } = useQuery({
    queryKey: ['admin-lab-params', selectedPanel?.id],
    queryFn: () => adminApi.listLabParameters(selectedPanel!.id),
    enabled: !!selectedPanel,
  });
  const parameters = paramsResponse?.data || [];

  // Mutations
  const createPanelMut = useMutation({
    mutationFn: (data: any) => adminApi.createLabPanel(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-lab-panels'] }); setIsPanelModalOpen(false); }
  });
  const updatePanelMut = useMutation({
    mutationFn: ({ id, data }: any) => adminApi.updateLabPanel(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-lab-panels'] }); setIsPanelModalOpen(false); }
  });
  const addParamMut = useMutation({
    mutationFn: ({ panelId, data }: any) => adminApi.addLabParameter(panelId, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['admin-lab-panels'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lab-params'] }); 
      setParamForm({ name: '', code: '', unit: '', reference_range: '' });
    }
  });

  const openPanelModal = (panel?: any) => {
    if (panel) {
      setEditingPanel(panel);
      setPanelForm({ name: panel.name, code: panel.code || '', description: panel.description, is_active: panel.is_active, price: panel.price || 0 });
    } else {
      setEditingPanel(null);
      setPanelForm({ name: '', code: '', description: '', price: '', is_active: true });
    }
    setIsPanelModalOpen(true);
  };

  const handlePanelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPanel) updatePanelMut.mutate({ id: editingPanel.id, data: panelForm });
    else createPanelMut.mutate(panelForm);
  };

  const handleParamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addParamMut.mutate({ panelId: selectedPanel.id, data: paramForm });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lab Tests & Panels</h1>
            <p className="text-gray-500 mt-1">Manage laboratory tests, panels, and parameters.</p>
          </div>
          <button 
            onClick={() => openPanelModal()}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084e42] text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            <span>New Lab Panel</span>
          </button>
        </div>

        {panelsLoading ? (
          <div className="text-center py-12 text-gray-500">Loading lab panels...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {panels.map((panel: any) => (
              <div key={panel.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-[#E8F5F0] text-[#0A6253] rounded-xl">
                    <FlaskConical size={24} />
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${panel.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {panel.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{panel.name}</h3>
                <p className="text-sm font-mono text-gray-500">{panel.code}</p>
                <p className="text-sm text-gray-500 mt-2 flex-1 line-clamp-2">{panel.description || 'No description'}</p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <List size={16} className="text-gray-400" />
                    {panel.parameter_count || 0} Parameters
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openPanelModal(panel)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#0A6253] hover:bg-teal-50 rounded-lg transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => { setSelectedPanel(panel); setIsParamsModalOpen(true); }}
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

      {/* Panel Modal */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{editingPanel ? 'Edit Lab Panel' : 'New Lab Panel'}</h3>
              <button onClick={() => setIsPanelModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
            </div>
            <form onSubmit={handlePanelSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Panel Name</label>
                <input required type="text" value={panelForm.name} onChange={e => setPanelForm({...panelForm, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input required type="text" value={panelForm.code} onChange={e => setPanelForm({...panelForm, code: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input type="number" min="0" value={panelForm.price} onChange={e => setPanelForm({...panelForm, price: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={panelForm.description} onChange={e => setPanelForm({...panelForm, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0A6253]" rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="panelActive" checked={panelForm.is_active} onChange={e => setPanelForm({...panelForm, is_active: e.target.checked})} className="rounded text-[#0A6253]" />
                <label htmlFor="panelActive" className="text-sm font-medium">Active</label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPanelModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={createPanelMut.isPending || updatePanelMut.isPending} className="px-4 py-2 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parameters Modal */}
      {isParamsModalOpen && selectedPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedPanel.name} - Parameters</h3>
                <p className="text-xs text-gray-500">Configure parameters for this panel.</p>
              </div>
              <button onClick={() => setIsParamsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
            </div>
            
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <form onSubmit={handleParamSubmit} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Param Name</label>
                  <input required type="text" value={paramForm.name} onChange={e => setParamForm({...paramForm, name: e.target.value})} className="w-full border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#0A6253] text-sm" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                  <input required type="text" value={paramForm.code} onChange={e => setParamForm({...paramForm, code: e.target.value})} className="w-full border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#0A6253] text-sm" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <input required type="text" value={paramForm.unit} onChange={e => setParamForm({...paramForm, unit: e.target.value})} className="w-full border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#0A6253] text-sm" />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ref. Range</label>
                  <input required type="text" value={paramForm.reference_range} onChange={e => setParamForm({...paramForm, reference_range: e.target.value})} className="w-full border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#0A6253] text-sm" />
                </div>
                <button 
                  type="submit"
                  disabled={addParamMut.isPending}
                  className="px-4 py-1.5 bg-[#0A6253] text-white rounded-lg font-medium hover:bg-[#084e42] text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            </div>

            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Unit</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Ref. Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parameters.map((param: any) => (
                    <tr key={param.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{param.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{param.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{param.unit}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{param.reference_range}</td>
                    </tr>
                  ))}
                  {parameters.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No parameters defined.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
