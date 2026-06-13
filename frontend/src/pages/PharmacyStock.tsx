import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '../api/pharmacy';
import { getStoredUser } from '../api/client';

interface Drug {
  id: string;
  name: string;
  generic_name: string;
  brand_names: string;
  category: string;
  dosage_form: string;
  strength: string;
  is_controlled: boolean;
  requires_prescription: boolean;
  created_at: string;
}

interface InventoryItem {
  id: string;
  drug: Drug;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit: string;
  unit_price: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  'ANALGESIC', 'ANTIBIOTIC', 'ANTIVIRAL', 'CARDIOVASCULAR',
  'CNS', 'DIABETIC', 'GASTROINTESTINAL', 'RESPIRATORY',
  'VITAMIN', 'VACCINE', 'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  ANALGESIC: 'Analgesic', ANTIBIOTIC: 'Antibiotic', ANTIVIRAL: 'Antiviral',
  CARDIOVASCULAR: 'Cardiovascular', CNS: 'CNS', DIABETIC: 'Diabetic',
  GASTROINTESTINAL: 'Gastrointestinal', RESPIRATORY: 'Respiratory',
  VITAMIN: 'Vitamin & Supplement', VACCINE: 'Vaccine', OTHER: 'Other',
};

function getStockStatus(item: InventoryItem): { label: string; color: string } {
  const qty = Number(item.quantity);
  const reorder = Number(item.reorder_level);
  if (qty <= 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
  if (qty <= reorder) return { label: 'Low Stock', color: 'text-amber-600 bg-amber-50' };
  return { label: 'In Stock', color: 'text-emerald-600 bg-emerald-50' };
}

function getExpiryStatus(expiry: string): { label: string; color: string } {
  if (!expiry) return { label: 'No expiry', color: 'text-gray-400' };
  const d = new Date(expiry);
  const now = new Date();
  const months = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (d < now) return { label: 'Expired', color: 'text-red-600 bg-red-50' };
  if (months <= 3) return { label: 'Expiring Soon', color: 'text-orange-600 bg-orange-50' };
  return { label: 'Valid', color: 'text-emerald-600' };
}

export default function PharmacyStock() {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const hospitalId = user?.hospital?.id;

  const [activeTab, setActiveTab] = useState<'drugs' | 'inventory' | 'low-stock'>('drugs');
  const [search, setSearch] = useState('');
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [editInventoryId, setEditInventoryId] = useState<string | null>(null);
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);

  // Drug form state
  const [drugForm, setDrugForm] = useState({ name: '', generic_name: '', brand_names: '', category: 'OTHER', dosage_form: '', strength: '' });

  // Inventory form state
  const [invForm, setInvForm] = useState({ batch_number: '', quantity: 1, unit: 'Tablets', unit_price: '' as number | string, expiry_date: '', reorder_level: 10, drug_id: '' });

  // ── Queries ────────────────────────────────────────────────────────
  const { data: drugsData, isLoading: drugsLoading } = useQuery({
    queryKey: ['pharmacy-drugs', search],
    queryFn: () => pharmacyApi.listDrugs({ search, page_size: 200 }),
    select: (res: any) => res.data?.results || res.data || [],
  });

  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['pharmacy-inventory'],
    queryFn: () => pharmacyApi.listInventory({ page_size: 500 }),
    select: (res: any) => res.data?.results || res.data || [],
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['pharmacy-low-stock'],
    queryFn: () => pharmacyApi.lowStock(),
    enabled: activeTab === 'low-stock',
    select: (res: any) => res.data?.results || res.data || [],
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const createDrug = useMutation({
    mutationFn: (data: any) => pharmacyApi.createDrug(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pharmacy-drugs'] }); setShowAddDrug(false); setDrugForm({ name: '', generic_name: '', brand_names: '', category: 'OTHER', dosage_form: '', strength: '' }); },
  });

  const createInventory = useMutation({
    mutationFn: (data: any) => pharmacyApi.createInventory(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pharmacy-inventory'] }); setShowAddInventory(false); resetInvForm(); },
  });

  const updateInventory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => pharmacyApi.updateInventory(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pharmacy-inventory'] }); setEditInventoryId(null); resetInvForm(); },
  });

  const deleteInventory = useMutation({
    mutationFn: (id: string) => pharmacyApi.updateInventory(id, { is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmacy-inventory'] }),
  });

  function resetInvForm() {
    setInvForm({ batch_number: '', quantity: 1, unit: 'Tablets', unit_price: '', expiry_date: '', reorder_level: 10, drug_id: '' });
  }

  function handleAddInventory(drugId: string) {
    setSelectedDrugId(drugId);
    resetInvForm();
    setShowAddInventory(true);
  }

  function handleEditInventory(item: InventoryItem) {
    setEditInventoryId(item.id);
    setSelectedDrugId(item.drug.id);
    setInvForm({
      batch_number: item.batch_number,
      quantity: Number(item.quantity),
      unit: item.unit,
      unit_price: Number(item.unit_price),
      expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
      reorder_level: Number(item.reorder_level),
      drug_id: item.drug.id,
    });
    setShowAddInventory(true);
  }

  function handleSubmitInventory(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...invForm, drug_id: selectedDrugId || invForm.drug_id, quantity: Number(invForm.quantity), unit_price: Number(invForm.unit_price), reorder_level: Number(invForm.reorder_level) };
    if (editInventoryId) {
      updateInventory.mutate({ id: editInventoryId, data: payload });
    } else {
      createInventory.mutate(payload);
    }
  }

  function handleSubmitDrug(e: React.FormEvent) {
    e.preventDefault();
    createDrug.mutate(drugForm);
  }

  const invList: InventoryItem[] = inventoryData || [];
  const lowStockList: InventoryItem[] = lowStockData || [];
  const drugList: Drug[] = drugsData || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Stock</h1>
          <p className="text-sm text-gray-500 mt-1">Manage drug catalog and inventory</p>
        </div>
        {activeTab === 'drugs' && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddDrug(true)}>
            + Add Drug
          </button>
        )}
        {activeTab === 'inventory' && (
          <button className="btn-primary flex items-center gap-2" onClick={() => { resetInvForm(); setShowAddInventory(true); }}>
            + Add Stock
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'drugs', label: 'Drug Catalog' },
          { key: 'inventory', label: `Inventory (${invList.length})` },
          { key: 'low-stock', label: `Low Stock (${lowStockList.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#0A6253] text-[#0A6253]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── DRUG CATALOG TAB ─────────────────────────────────────── */}
      {activeTab === 'drugs' && (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search drugs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A6253] outline-none"
            />
          </div>

          {drugsLoading ? (
            <div className="text-gray-500 text-center py-12">Loading...</div>
          ) : drugList.length === 0 ? (
            <div className="text-gray-400 text-center py-12">
              <p className="text-lg">No drugs found</p>
              <p className="text-sm mt-1">Add your first drug to the catalog</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600 font-semibold">
                    <th className="px-4 py-3">Drug Name</th>
                    <th className="px-4 py-3">Generic</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Brand Names</th>
                    <th className="px-4 py-3">Controlled?</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drugList.map((drug) => {
                    const inv = invList.find((i) => i.drug.id === drug.id);
                    return (
                      <tr key={drug.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{drug.name}</td>
                        <td className="px-4 py-3 text-gray-600">{drug.generic_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {CATEGORY_LABELS[drug.category] || drug.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{drug.brand_names || '—'}</td>
                        <td className="px-4 py-3">{drug.is_controlled ? '⚠️ Yes' : 'No'}</td>
                        <td className="px-4 py-3 text-right">
                          {inv ? (
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              In Stock
                            </span>
                          ) : (
                            <button
                              className="text-xs text-[#0A6253] hover:text-[#084d41] font-medium"
                              onClick={() => handleAddInventory(drug.id)}
                            >
                              + Add to Inventory
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Drug Modal */}
          {showAddDrug && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Drug</h2>
                <form onSubmit={handleSubmitDrug} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Drug Name *</label>
                    <input type="text" required value={drugForm.name} onChange={(e) => setDrugForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Generic Name</label>
                    <input type="text" value={drugForm.generic_name} onChange={(e) => setDrugForm(p => ({ ...p, generic_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select value={drugForm.category} onChange={(e) => setDrugForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                        {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
                      <input type="text" value={drugForm.strength} onChange={(e) => setDrugForm(p => ({ ...p, strength: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Brand Names (comma-separated)</label>
                    <input type="text" value={drugForm.brand_names} onChange={(e) => setDrugForm(p => ({ ...p, brand_names: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setShowAddDrug(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button type="submit" disabled={createDrug.isPending}
                      className="px-4 py-2 text-sm bg-[#0A6253] text-white rounded-lg hover:bg-[#085045] disabled:opacity-50">
                      {createDrug.isPending ? 'Adding...' : 'Add Drug'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── INVENTORY TAB ────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <>
          {invLoading ? (
            <div className="text-gray-500 text-center py-12">Loading...</div>
          ) : invList.length === 0 ? (
            <div className="text-gray-400 text-center py-12">
              <p className="text-lg">No inventory items</p>
              <p className="text-sm mt-1">Add stock from the Drugs tab or click "Add Stock" above</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600 font-semibold">
                    <th className="px-4 py-3">Drug</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invList.map((item) => {
                    const stock = getStockStatus(item);
                    const expiry = getExpiryStatus(item.expiry_date);
                    return (
                      <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.drug.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{item.batch_number || '—'}</td>
                        <td className="px-4 py-3 font-medium">{Number(item.quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                        <td className="px-4 py-3">₹{Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {item.expiry_date ? (
                            <span className={`text-xs font-medium ${expiry.color}`}>
                              {new Date(item.expiry_date).toLocaleDateString('en-IN')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${stock.color}`}>
                            {stock.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button className="text-xs text-[#0A6253] hover:text-[#084d41]"
                              onClick={() => handleEditInventory(item)}>Edit</button>
                            <button className="text-xs text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm('Deactivate this stock item?')) deleteInventory.mutate(item.id); }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── LOW STOCK TAB ────────────────────────────────────────── */}
      {activeTab === 'low-stock' && (
        <>
          {lowStockList.length === 0 ? (
            <div className="text-emerald-600 bg-emerald-50 rounded-xl p-8 text-center">
              <p className="text-lg font-medium">✅ All items are adequately stocked</p>
              <p className="text-sm mt-1">No items below reorder level.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lowStockList.map((item) => {
                const qty = Number(item.quantity);
                const reorder = Number(item.reorder_level);
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{item.drug.name}</p>
                      <p className="text-sm text-gray-500">{item.batch_number} — {item.unit}</p>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span className="text-amber-600 font-medium">Stock: {qty}</span>
                        <span className="text-gray-400">Reorder at: {reorder}</span>
                        {item.expiry_date && (
                          <span className="text-gray-400">Exp: {new Date(item.expiry_date).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                    <button className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
                      onClick={() => handleEditInventory(item)}>Restock</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Add / Edit Inventory Modal ──────────────────────────── */}
      {showAddInventory && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editInventoryId ? 'Edit Stock' : 'Add to Inventory'}
            </h2>
            <form onSubmit={handleSubmitInventory} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Drug ID</label>
                <input type="text" value={selectedDrugId || invForm.drug_id} disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-400 bg-gray-50" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input type="number" min="0" step="1" required value={invForm.quantity}
                    onChange={(e) => setInvForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <select value={invForm.unit} onChange={(e) => setInvForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option>Tablets</option><option>Capsules</option><option>ml</option>
                    <option>mg</option><option>Inhalers</option><option>Sachets</option>
                    <option>Vials</option><option>Injection</option><option>Bottle</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={invForm.unit_price}
                    onChange={e => setInvForm(p => ({ ...p, unit_price: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                  <input type="number" min="0" value={invForm.reorder_level}
                    onChange={(e) => setInvForm(p => ({ ...p, reorder_level: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Batch Number</label>
                  <input type="text" value={invForm.batch_number}
                    onChange={(e) => setInvForm(p => ({ ...p, batch_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                  <input type="date" value={invForm.expiry_date}
                    onChange={(e) => setInvForm(p => ({ ...p, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0A6253]" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowAddInventory(false); setEditInventoryId(null); resetInvForm(); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createInventory.isPending || updateInventory.isPending}
                  className="px-4 py-2 text-sm bg-[#0A6253] text-white rounded-lg hover:bg-[#085045] disabled:opacity-50">
                  {createInventory.isPending || updateInventory.isPending ? 'Saving...' : editInventoryId ? 'Update Stock' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
