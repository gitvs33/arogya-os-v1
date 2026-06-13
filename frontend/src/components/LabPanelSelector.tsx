import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { labCatalogApi } from '../api/lab/catalogApi';

interface PanelInfo {
  id: string;
  name: string;
  short_name: string;
  category: string;
  price: number | null;
  standard_tat_hours: number | null;
  is_panel: boolean;
}

export default function LabPanelSelector({ value, onChange, onPanelSelect }: { value: string; onChange: (v: string) => void; onPanelSelect?: (panel: PanelInfo) => void }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch hospital's lab panel catalog
  const { data: panelsData } = useQuery({
    queryKey: ['lab-panels-autocomplete', debouncedQuery],
    queryFn: () => labCatalogApi.listPanels({ search: debouncedQuery, page_size: 50 }),
    enabled: debouncedQuery.length > 0,
    select: (res: any) => res.data?.results || res.data || [],
  });

  const panelList: PanelInfo[] = panelsData || [];

  // Track selected panel name for display
  const selectedPanel = panelList.find(p => p.id === value);

  // Keep initial query sync — show selected name when value is set externally
  useEffect(() => {
    if (value && !query) {
      // Try to fetch the selected panel's name if we don't have it yet
      labCatalogApi.getPanel(value).then(res => {
        const p = res.data;
        if (p) setQuery(p.name || p.short_name || '');
      }).catch(() => {});
    }
  }, [value]);

  // Group by category
  const grouped = panelList.reduce((acc: Record<string, PanelInfo[]>, panel) => {
    const cat = panel.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(panel);
    return acc;
  }, {});

  // Flatten for keyboard navigation
  const flatItems: any[] = [];
  Object.entries(grouped).forEach(([category, items]) => {
    flatItems.push({ category, isHeader: true });
    (items as PanelInfo[]).forEach(panel => flatItems.push({ panel, category, isHeader: false }));
  });

  const totalItems = flatItems.length;

  const selectPanel = useCallback((panel: PanelInfo) => {
    onChange(panel.id);
    if (onPanelSelect) onPanelSelect(panel);
    setQuery(panel.name);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [onChange, onPanelSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val !== (selectedPanel?.name || '')) {
      onChange(''); // clear selection if query changed away from selected
    }
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
          selectPanel(flatItems[activeIndex].panel);
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

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'HEMATOLOGY': 'bg-red-100 text-red-700',
      'BIOCHEMISTRY': 'bg-blue-100 text-blue-700',
      'MICROBIOLOGY': 'bg-green-100 text-green-700',
      'PATHOLOGY': 'bg-purple-100 text-purple-700',
      'IMMUNOLOGY': 'bg-cyan-100 text-cyan-700',
      'SEROLOGY': 'bg-amber-100 text-amber-700',
      'TOXICOLOGY': 'bg-orange-100 text-orange-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim()) setIsOpen(true); }}
        onBlur={handleBlur}
        placeholder="Search hospital lab panels..."
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
              <button key={item.panel.id} type="button" data-index={idx}
                onMouseDown={(e) => { e.preventDefault(); selectPanel(item.panel); }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                  idx === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.panel.name}</span>
                  {item.panel.short_name && (
                    <span className="ml-2 text-xs text-gray-400">({item.panel.short_name})</span>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryColor(item.panel.category)}`}>
                      {item.panel.category}
                    </span>
                    {item.panel.is_panel && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                        Panel
                      </span>
                    )}
                    {item.panel.standard_tat_hours && (
                      <span className="text-[10px] text-gray-400">{item.panel.standard_tat_hours}h TAT</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.panel.price ? (
                    <span className="text-xs font-medium text-gray-700">₹{Number(item.panel.price).toLocaleString('en-IN')}</span>
                  ) : null}
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          )}
        </div>
      )}

      {isOpen && query.trim() && panelList.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
          {debouncedQuery
            ? 'No matching lab tests found. Contact admin to add test panels.'
            : 'Searching...'}
        </div>
      )}
    </div>
  );
}
