import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { Shield, ShieldAlert, ShieldCheck, Search, Users, Settings, FileText, Activity, Save, Plus, AlertCircle, Loader2, X, Trash2, Edit3, Check, Ban } from 'lucide-react';

const ICONS = [ShieldAlert, ShieldCheck, Shield, Users, Settings, FileText, Activity];
const COLORS = [
  { color: 'text-red-600', bg: 'bg-red-50' },
  { color: 'text-[#0A6253]', bg: 'bg-[#0A6253]/10' },
  { color: 'text-blue-600', bg: 'bg-blue-50' },
  { color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { color: 'text-amber-600', bg: 'bg-amber-50' },
  { color: 'text-purple-600', bg: 'bg-purple-50' },
  { color: 'text-pink-600', bg: 'bg-pink-50' },
];

const MODULE_ICONS: Record<string, any> = {
  patients: Users,
  encounters: Activity,
  appointments: Activity,
  billing: FileText,
  pharmacy: Activity,
  lab: Activity,
  ward: Activity,
  nursing: Users,
  teleicu: Activity,
  alerts: ShieldAlert,
  reports: FileText,
  dashboard: Activity,
  sync: Activity,
  admin: Settings,
};

interface Role {
  id: number | string;
  name: string;
  description: string;
  permissions: Record<string, any>;
  is_active?: boolean;
}

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [activeRoleId, setActiveRoleId] = useState<number | string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create role modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Editing permissions state
  const [editedPermissions, setEditedPermissions] = useState<Record<string, any>>({});
  
  // Inline editing state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Delete confirmation state
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: rolesResponse, isLoading: rolesLoading, isError } = useQuery({
    queryKey: ['adminRoles'],
    queryFn: () => adminApi.getRoles().then(res => res.data)
  });

  const { data: metadataResponse, isLoading: metadataLoading } = useQuery({
    queryKey: ['adminPermissionMetadata'],
    queryFn: () => adminApi.getPermissionMetadata().then(res => res.data)
  });

  const isLoading = rolesLoading || metadataLoading;

  // Extract roles array depending on DRF pagination or not
  const roles: Role[] = Array.isArray(rolesResponse) ? rolesResponse : rolesResponse?.results || [];

  const activeRole = roles.find(r => r.id === activeRoleId);

  useEffect(() => {
    if (roles.length > 0 && !activeRoleId) {
      setActiveRoleId(roles[0].id);
    }
  }, [roles, activeRoleId]);

  useEffect(() => {
    if (activeRole) {
      setEditedPermissions(activeRole.permissions || {});
      setEditName(activeRole.name);
      setEditDesc(activeRole.description || '');
      setIsEditingDetails(false);
    }
  }, [activeRole]);

  const createMutation = useMutation({
    mutationFn: (newRole: any) => adminApi.createRole(newRole),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoles'] });
      setIsCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      if (res.data?.id) {
        setActiveRoleId(res.data.id);
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number | string, payload: any }) => 
      adminApi.updateRole(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRoles'] });
      setIsEditingDetails(false);
    }
  });

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    createMutation.mutate({
      name: newRoleName,
      description: newRoleDesc,
      permissions: {},
      is_active: true
    });
  };

  const handleTogglePermission = (moduleId: string, action: string) => {
    setEditedPermissions(prev => {
      const modulePerms = prev[moduleId] || {};
      const currentVal = !!modulePerms[action];
      return {
        ...prev,
        [moduleId]: {
          ...modulePerms,
          [action]: !currentVal
        }
      };
    });
  };

  const handleSavePermissions = () => {
    if (!activeRole) return;
    updateMutation.mutate({
      id: activeRole.id,
      payload: { permissions: editedPermissions }
    });
  };

  const handleSaveDetails = () => {
    if (!activeRole || !editName.trim()) return;
    updateMutation.mutate({
      id: activeRole.id,
      payload: { name: editName.trim(), description: editDesc.trim() }
    });
  };

  const handleDeleteRole = () => {
    if (!deleteConfirmRole) return;
    setIsDeleting(true);
    adminApi.deleteRole(deleteConfirmRole.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['adminRoles'] });
        setDeleteConfirmRole(null);
        if (activeRoleId === deleteConfirmRole.id) {
          setActiveRoleId(null);
        }
      })
      .catch((err) => {
        console.error('Delete failed:', err);
      })
      .finally(() => setIsDeleting(false));
  };

  const handleDiscard = () => {
    if (activeRole) {
      setEditedPermissions(activeRole.permissions || {});
    }
  };

  const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // UI mapping helpers
  const getRoleIcon = (index: number) => ICONS[index % ICONS.length];
  const getRoleColors = (index: number) => COLORS[index % COLORS.length];

  const modulesList = Array.isArray(metadataResponse) ? metadataResponse : metadataResponse?.modules || [];
  const allActionsSet = new Set<string>();
  modulesList.forEach((m: any) => m.actions?.forEach((a: string) => allActionsSet.add(a)));
  
  const COMMON_ACTIONS = ['read', 'write', 'create', 'update', 'delete'];
  const allActions = Array.from(allActionsSet).sort((a, b) => {
    const idxA = COMMON_ACTIONS.indexOf(a);
    const idxB = COMMON_ACTIONS.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
            <p className="text-gray-500 mt-1">Configure access controls and permissions for different staff roles.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Create Custom Role</span>
          </button>
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold">Unable to load roles</h3>
              <p className="text-sm mt-1">The backend endpoint might be unavailable or you might lack permissions.</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Roles List */}
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search roles..." 
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                        <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No roles found.</div>
              ) : (
                filteredRoles.map((role, idx) => {
                  const RoleIcon = getRoleIcon(idx);
                  const colors = getRoleColors(idx);
                  const isActive = activeRoleId === role.id;
                  
                  return (
                    <button
                      key={role.id}
                      onClick={() => setActiveRoleId(role.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                        isActive 
                          ? 'bg-[#0A6253]/5 border-[#0A6253]/20 shadow-sm' 
                          : 'border-transparent hover:bg-gray-50 hover:border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colors.bg} ${colors.color}`}>
                          <RoleIcon size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-semibold text-sm ${isActive ? 'text-[#0A6253]' : 'text-gray-900'}`}>
                            {role.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{role.description || 'No description'}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Permissions Matrix */}
          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-200px)]">
            {activeRole ? (
              <>
                <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-xl bg-[#0A6253]/10 text-[#0A6253] shadow-sm">
                      <Shield size={28} />
                    </div>
                    {isEditingDetails ? (
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full max-w-md px-3 py-2 text-xl font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253]"
                        />
                        <textarea
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          rows={2}
                          className="w-full max-w-md px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveDetails}
                            disabled={updateMutation.isPending || !editName.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084e42] transition-colors disabled:opacity-50"
                          >
                            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Save
                          </button>
                          <button
                            onClick={() => { setIsEditingDetails(false); setEditName(activeRole.name); setEditDesc(activeRole.description || ''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Ban size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-gray-900">{activeRole.name}</h2>
                          <button
                            onClick={() => setIsEditingDetails(true)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Edit name / description"
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>
                        <p className="text-gray-600 mt-1 max-w-xl">{activeRole.description || 'Manage permissions for this role'}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteConfirmRole(activeRole)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    title="Delete role"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Permissions Matrix</h3>
                  
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
                          <th className="py-4 px-6 min-w-[200px]">Module</th>
                          {allActions.map(action => (
                            <th key={action} className="py-4 px-4 text-center capitalize">{action.replace('_', ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {modulesList.map((mod: any) => {
                          const Icon = MODULE_ICONS[mod.id] || ShieldCheck;
                          return (
                          <tr key={mod.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="py-4 px-6 border-r border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-gray-100 rounded text-gray-500">
                                  <Icon size={16} />
                                </div>
                                <span className="font-medium text-gray-800">{mod.name}</span>
                              </div>
                            </td>
                            {allActions.map((action) => {
                              const isActionValid = mod.actions?.includes(action);
                              const isChecked = !!(editedPermissions[mod.id] && editedPermissions[mod.id][action]);
                              const isSystemAdmin = activeRole.name.toLowerCase() === 'system administrator' || activeRole.name.toLowerCase() === 'admin';
                              
                              if (!isActionValid) {
                                return <td key={action} className="py-4 px-4 bg-gray-50/20 text-gray-200 text-center text-xs">-</td>;
                              }

                              return (
                                <td key={action} className="py-4 px-4 text-center">
                                  <label className="relative flex items-center justify-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={isSystemAdmin ? true : isChecked}
                                      disabled={isSystemAdmin || updateMutation.isPending}
                                      onChange={() => handleTogglePermission(mod.id, action)}
                                      className="peer sr-only" 
                                    />
                                    <div className="w-5 h-5 rounded border border-gray-300 bg-white peer-checked:bg-[#0A6253] peer-checked:border-[#0A6253] transition-all flex items-center justify-center peer-disabled:opacity-50">
                                      <svg className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    </div>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
                  <button 
                    onClick={handleDiscard}
                    disabled={updateMutation.isPending}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Discard Changes
                  </button>
                  <button 
                    onClick={handleSavePermissions}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084e42] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Permissions</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Shield size={48} className="text-gray-300 mb-4" />
                <p>Select a role to view or edit permissions</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Create New Role</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateRole} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Ward Nurse"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Describe the responsibilities of this role..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all resize-none"
                />
              </div>
              
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newRoleName.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084e42] transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Create Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-full bg-red-100 text-red-600">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Role</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-1">
                Are you sure you want to delete
              </p>
              <p className="font-semibold text-gray-900 mb-4">
                &ldquo;{deleteConfirmRole.name}&rdquo;
              </p>
              
              {deleteConfirmRole.description && (
                <p className="text-xs text-gray-500 mb-4 italic">{deleteConfirmRole.description}</p>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-amber-700">
                  Users assigned to this role will lose their current permissions until reassigned.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setDeleteConfirmRole(null); setIsDeleting(false); }}
                  disabled={isDeleting}
                  className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRole}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>{isDeleting ? 'Deleting...' : 'Delete Role'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #E5E7EB;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
