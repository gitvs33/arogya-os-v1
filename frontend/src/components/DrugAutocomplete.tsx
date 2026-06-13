import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pharmacyApi } from '../api/pharmacy';
import { getStoredUser } from '../api/client';

interface DrugResult {
  id: string;
  name: string;
  generic_name: string;
  category: string;
  strength: string;
}

interface InventoryInfo {
  drug_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  reorder_level: number;
}

function getStockBadge(inv: InventoryInfo | undefined): { label: string; color: string; price: string } | null {
  if (!inv) return null;
  const qty = Number(inv.quantity);
  if (qty <= 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50', price: `₹${Number(inv.unit_price).toFixed(2)}` };
  if (qty <= Number(inv.reorder_level)) return { label: `Only ${qty} left`, color: 'text-amber-600 bg-amber-50', price: `₹${Number(inv.unit_price).toFixed(2)}` };
  return { label: `In Stock: ${qty}`, color: 'text-emerald-600 bg-emerald-50', price: `₹${Number(inv.unit_price).toFixed(2)}` };
}

export default function DrugAutocomplete({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync internal query when value changes externally
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch hospital's drug catalog
  const { data: drugsData } = useQuery({
    queryKey: ['drug-autocomplete', debouncedQuery],
    queryFn: () => pharmacyApi.listDrugs({ search: debouncedQuery, page_size: 50 }),
    enabled: debouncedQuery.length > 0,
    select: (res: any) => res.data?.results || res.data || [],
  });

  // Fetch inventory for stock badges (fetch once)
  const { data: inventoryData } = useQuery({
    queryKey: ['drug-autocomplete-inventory'],
    queryFn: () => pharmacyApi.listInventory({ page_size: 500 }),
    select: (res: any) => {
      const items: InventoryInfo[] = (res.data?.results || res.data || []).map((i: any) => ({
        drug_id: i.drug?.id || i.drug,
        quantity: Number(i.quantity),
        unit: i.unit,
        unit_price: Number(i.unit_price),
        reorder_level: Number(i.reorder_level),
      }));
      return items;
    },
  });

  const drugList: DrugResult[] = drugsData || [];
  const inventoryMap = new Map<string, InventoryInfo>();
  (inventoryData || []).forEach((inv: InventoryInfo) => inventoryMap.set(inv.drug_id, inv));

  // Group by category
  const grouped = drugList.reduce((acc: Record<string, DrugResult[]>, drug) => {
    const cat = drug.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(drug);
    return acc;
  }, {});

  // Flatten for keyboard navigation
  const flatItems: any[] = [];
  Object.entries(grouped).forEach(([category, items]) => {
    flatItems.push({ category, isHeader: true });
    (items as DrugResult[]).forEach(drug => flatItems.push({ drug, category, isHeader: false }));
  });

  const totalItems = flatItems.length;

  const selectDrug = useCallback((drug: DrugResult) => {
    setQuery(drug.name);
    onChange(drug.name);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsOpen(val.trim().length > 0);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || totalItems === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1 >= totalItems ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev <= 0 ? totalItems - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && !flatItems[activeIndex].isHeader) {
          selectDrug(flatItems[activeIndex].drug);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-index]');
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleBlur = () => setTimeout(() => { setIsOpen(false); setActiveIndex(-1); }, 200);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id="drug-name"
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim()) setIsOpen(true); }}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="Search hospital drug catalog..."
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        autoComplete="off"
      />

      {isOpen && flatItems.length > 0 && (
        <div ref={listRef} className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {flatItems.map((item, idx) =>
            item.isHeader ? (
              <div key={`h-${item.category}`} data-index={idx}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 sticky top-0">
                {item.category}
              </div>
            ) : (
              <button key={item.drug.id} type="button" data-index={idx}
                onMouseDown={(e) => { e.preventDefault(); selectDrug(item.drug); }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                  idx === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.drug.name}</span>
                  {item.drug.generic_name && (
                    <span className="ml-2 text-xs text-gray-400">({item.drug.generic_name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const badge = getStockBadge(inventoryMap.get(item.drug.id));
                    return badge ? (
                      <>
                        <span className="text-xs text-gray-400">{badge.price}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-400 bg-gray-100">
                        No Stock
                      </span>
                    );
                  })()}
                </div>
              </button>
            )
          )}
        </div>
      )}

      {isOpen && query.trim() && drugList.length === 0 && !debouncedQuery && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
          Searching...
        </div>
      )}

      {isOpen && query.trim() && drugList.length === 0 && debouncedQuery && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
          No drugs found in catalog. Type to search or add new drug in Pharmacy Stock.
        </div>
      )}
    </div>
  );
}
