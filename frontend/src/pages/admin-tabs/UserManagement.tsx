import React, { useState } from 'react';
import { Search, Plus, MoreVertical, Edit2, Trash2, Mail, Phone, X, AlertCircle, Loader2, UserX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { ConfirmDialog } from '../../components/ConfirmDialog';

// Helper functions to handle flexible backend formats
const getUserName = (user: any) => {
  if (user.name) return user.name;
  const first = user.first_name || '';
  const last = user.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || 'Unknown User';
};

const getUserRole = (user: any) => {
  if (typeof user.role === 'string') return user.role;
  return user.role?.name || 'Unassigned';
};

const getUserDept = (user: any) => {
  if (typeof user.department === 'string') return user.department;
  return user.department?.name || 'Unassigned';
};

const getUserStatus = (user: any) => {
  if (user.status) return user.status;
  return user.is_active === false ? 'Inactive' : 'Active';
};

const DEPARTMENTS = ['Surgery', 'Emergency', 'Cardiology', 'HR', 'IT', 'General'];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Forms state
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: '', department: DEPARTMENTS[5] });
  const [editForm, setEditForm] = useState({ role: '', department: '' });

  // Fetch roles
  const { data: rolesResponse } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await adminApi.getRoles();
      return res.data;
    }
  });

  const rolesList = Array.isArray(rolesResponse) 
    ? rolesResponse 
    : (rolesResponse?.results || []);
  
  const roleNames = rolesList.map((r: any) => r.name);

  // Fetch users
  const { data: responseData, isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await adminApi.getUsers();
      return res.data;
    }
  });

  const rawUsers = Array.isArray(responseData) 
    ? responseData 
    : (responseData?.results || []);

  const users = rawUsers.map((u: any) => ({
    ...u,
    parsedName: getUserName(u),
    parsedRole: getUserRole(u),
    parsedDept: getUserDept(u),
    parsedStatus: getUserStatus(u),
    parsedEmail: u.email || 'no-email@medos.com',
    parsedAvatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserName(u))}&background=0A6253&color=fff`,
  }));

  const filteredUsers = users.filter((user: any) => 
    user.parsedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.parsedRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.parsedDept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Handlers to build backend-shaped payload ──────────────────────
  const buildCreatePayload = (form: typeof createForm) => {
    const nameParts = form.name.trim().split(/\s+/);
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';
    const username = form.email.split('@')[0] || first_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // Look up role UUID from name
    const matchedRole = rolesList.find((r: any) => r.name === form.role);
    return {
      username,
      email: form.email,
      password: form.password,
      first_name,
      last_name,
      role_id: matchedRole?.id || null,
      department: form.department,
    };
  };

  const buildEditPayload = (form: typeof editForm) => {
    const matchedRole = rolesList.find((r: any) => r.name === form.role);
    return {
      role_id: matchedRole?.id || null,
      department: form.department,
    };
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => adminApi.createUser(buildCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: '', department: DEPARTMENTS[5] });
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number, data: typeof editForm }) =>
      adminApi.updateUser(id, buildEditPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditModalOpen(false);
      setUserToEdit(null);
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string | number) => adminApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createForm);
  };

  const handleCreateFormChange = (patch: Partial<typeof createForm>) => {
    setCreateForm(prev => ({ ...prev, ...patch }));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userToEdit) {
      editMutation.mutate({ id: userToEdit.id, data: editForm });
    }
  };

  const openEditModal = (user: any) => {
    setUserToEdit(user);
    setEditForm({ role: user.parsedRole, department: user.parsedDept });
    setIsEditModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 mt-1">Manage hospital staff, their roles, and system access.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084e42] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Add User</span>
          </button>
        </div>

        {/* Filters and Search Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name, role, or department..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <select className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 text-gray-700 font-medium">
              <option>All Departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 text-gray-700 font-medium">
              <option>Status: All</option>
              <option>Active</option>
              <option>On Leave</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        {/* State Handling (Loading / Error) */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="py-4 px-6"><div className="h-3 w-12 bg-gray-200 rounded animate-pulse" /></th>
                    <th className="py-4 px-6"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse" /></th>
                    <th className="py-4 px-6"><div className="h-3 w-14 bg-gray-200 rounded animate-pulse" /></th>
                    <th className="py-4 px-6"><div className="h-3 w-10 bg-gray-200 rounded animate-pulse" /></th>
                    <th className="py-4 px-6 text-right"><div className="h-3 w-12 bg-gray-200 rounded animate-pulse ml-auto" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
                            <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5">
                          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                          <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 rounded-xl border border-red-100 p-8 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <h3 className="text-lg font-bold text-red-800">Failed to load users</h3>
            <p className="text-red-600 mt-1">{error instanceof Error ? error.message : 'An unknown error occurred.'}</p>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
              className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !isError && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-sm font-semibold text-gray-600">
                    <th className="py-4 px-6">User</th>
                    <th className="py-4 px-6">Role & Dept</th>
                    <th className="py-4 px-6">Contact</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <img src={user.parsedAvatar} alt={user.parsedName} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" />
                          <div>
                            <p className="font-semibold text-gray-900 group-hover:text-[#0A6253] transition-colors">{user.parsedName}</p>
                            <p className="text-xs text-gray-500">ID: #{user.id.toString().padStart(4, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-800">{user.parsedRole}</p>
                        <p className="text-sm text-gray-500">{user.parsedDept}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-gray-400" />
                            <span>{user.parsedEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          user.parsedStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          user.parsedStatus === 'On Leave' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {user.parsedStatus === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>}
                          {user.parsedStatus === 'On Leave' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>}
                          {user.parsedStatus === 'Inactive' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                          {user.parsedStatus}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-gray-400 hover:text-[#0A6253] hover:bg-[#0A6253]/10 rounded-lg transition-colors" 
                            title="Edit Roles/Departments"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: user.is_active === false ? 'Reactivate User' : 'Deactivate User',
                                message: `Are you sure you want to ${user.is_active === false ? 'reactivate' : 'deactivate'} ${user.parsedName}?`,
                                onConfirm: () => {
                                  deactivateMutation.mutate(user.id);
                                  setConfirmDialog(p => ({ ...p, isOpen: false }));
                                }
                              });
                            }}
                            disabled={deactivateMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50" 
                            title={user.is_active === false ? "Reactivate" : "Deactivate"}
                          >
                            <UserX size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Delete User',
                                message: `Are you sure you want to permanently delete ${user.parsedName}? This action cannot be undone.`,
                                onConfirm: () => {
                                  deleteMutation.mutate(user.id);
                                  setConfirmDialog(p => ({ ...p, isOpen: false }));
                                }
                              });
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" 
                            title="Permanent Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                  <Search className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-lg font-medium text-gray-900">No users found</p>
                  <p>We couldn't find anyone matching your search criteria.</p>
                </div>
              )}
            </div>
            
            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <span className="text-sm text-gray-500">Showing <span className="font-medium text-gray-900">{filteredUsers.length > 0 ? 1 : 0}</span> to <span className="font-medium text-gray-900">{filteredUsers.length}</span> of <span className="font-medium text-gray-900">{users.length}</span> results</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={createForm.name}
                  onChange={(e) => handleCreateFormChange({name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                  placeholder="e.g. Dr. Sarah Jenkins"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={createForm.email}
                  onChange={(e) => handleCreateFormChange({email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                  placeholder="sarah.j@medos.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  value={createForm.password}
                  onChange={(e) => handleCreateFormChange({password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                  placeholder="Set initial password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={createForm.role}
                  onChange={(e) => handleCreateFormChange({role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                >
                  {roleNames.map((role: string) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select 
                  value={createForm.department}
                  onChange={(e) => handleCreateFormChange({department: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                >
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              
              {createMutation.isError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>{createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create user.'}</p>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="flex-1 bg-[#0A6253] hover:bg-[#084e42] text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Edit Role & Department</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-4 mb-2">
                 <img src={userToEdit.parsedAvatar} alt={userToEdit.parsedName} className="w-12 h-12 rounded-full shadow-sm object-cover" />
                 <div>
                   <p className="font-semibold text-gray-900">{userToEdit.parsedName}</p>
                   <p className="text-sm text-gray-500">{userToEdit.parsedEmail}</p>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                >
                  {roleNames.includes(editForm.role) ? null : <option value={editForm.role}>{editForm.role}</option>}
                  {roleNames.map((role: string) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select 
                  value={editForm.department}
                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all"
                >
                  {DEPARTMENTS.includes(editForm.department) ? null : <option value={editForm.department}>{editForm.department}</option>}
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              
              {editMutation.isError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>{editMutation.error instanceof Error ? editMutation.error.message : 'Failed to update user.'}</p>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={editMutation.isPending}
                  className="flex-1 bg-[#0A6253] hover:bg-[#084e42] text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {editMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
                  Save Changes
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
    </div>
  );
}
