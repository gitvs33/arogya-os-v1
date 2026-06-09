import { useState, useRef, useEffect, useCallback } from 'react';
import drugs from '../data/indian_generic_drugs.json';

export default function DrugAutocomplete({ value, onChange, disabled }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync internal query when value changes externally (e.g. form reset)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Group filtered drugs by category
  const filtered = query.trim()
    ? drugs
        .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 50)
    : [];

  const grouped = filtered.reduce((acc, drug) => {
    if (!acc[drug.category]) acc[drug.category] = [];
    acc[drug.category].push(drug);
    return acc;
  }, {});

  // Flatten for keyboard navigation: each item is { drug, category, isHeader? }
  const flatItems = [];
  Object.entries(grouped).forEach(([category, items]) => {
    flatItems.push({ category, isHeader: true });
    items.forEach((drug) => flatItems.push({ drug, category, isHeader: false }));
  });

  const totalItems = flatItems.length;

  const selectDrug = useCallback(
    (drug) => {
      setQuery(drug.name);
      onChange(drug.name);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange]
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsOpen(val.trim().length > 0);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || totalItems === 0) {
      if (e.key === 'Enter' && !isOpen) {
        // Let form submit normally when dropdown is closed
        return;
      }
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev + 1;
          return next >= totalItems ? 0 : next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? totalItems - 1 : next;
        });
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
      if (items[activeIndex]) {
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Close on blur (with delay for click)
  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 200);
  };

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
        placeholder="Start typing a drug name..."
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        autoComplete="off"
      />

      {isOpen && flatItems.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {flatItems.map((item, idx) =>
            item.isHeader ? (
              <div
                key={`h-${item.category}`}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 sticky top-0"
                data-index={idx}
              >
                {item.category}
              </div>
            ) : (
              <button
                key={item.drug.name}
                type="button"
                data-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectDrug(item.drug);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  idx === activeIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{item.drug.name}</span>
                <span className="ml-2 text-xs text-gray-400">{item.drug.category}</span>
              </button>
            )
          )}
        </div>
      )}

      {isOpen && query.trim() && flatItems.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
          No matching drugs found
        </div>
      )}
    </div>
  );
}
