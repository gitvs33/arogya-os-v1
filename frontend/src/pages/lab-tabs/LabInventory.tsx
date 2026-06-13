import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  X,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { labInventoryApi } from "../../api/lab/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "Reagent" | "Consumable" | "Equipment" | "All";

interface InventoryItem {
  id: string;
  item_name: string;
  category: "Reagent" | "Consumable" | "Equipment";
  current_stock: number;
  min_threshold: number;
  unit: string;
  expiry_date: string;
  last_restocked: string;
}

interface RestockState {
  itemId: string;
  qty: string;
  loading: boolean;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = ["All", "Reagent", "Consumable", "Equipment"];

const CATEGORY_CONFIG: Record<
  "Reagent" | "Consumable" | "Equipment",
  { classes: string; dot: string }
> = {
  Reagent: {
    classes: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  Consumable: {
    classes: "bg-purple-50 text-purple-700 border border-purple-200",
    dot: "bg-purple-500",
  },
  Equipment: {
    classes: "bg-slate-50 text-slate-700 border border-slate-200",
    dot: "bg-slate-500",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stockPercent = (current: number, min: number): number => {
  if (min === 0) return 100;
  return Math.min(Math.round((current / min) * 100), 200);
};

const stockBarColor = (pct: number): string => {
  if (pct <= 50) return "bg-red-500";
  if (pct <= 100) return "bg-amber-400";
  return "bg-emerald-500";
};

const stockBarWidth = (pct: number): string => {
  // Cap bar display at 100% width even if stock > 2× threshold
  return `${Math.min(pct / 2, 100)}%`;
};

const isLowStock = (item: InventoryItem): boolean =>
  item.current_stock < item.min_threshold;

const isExpiringSoon = (item: InventoryItem): boolean => {
  if (!item.expiry_date) return false;
  const diff =
    new Date(item.expiry_date).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
};

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
  subtext?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon,
  iconBg,
  valueColor,
  subtext,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>
        {value.toLocaleString()}
      </p>
      {subtext && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{subtext}</p>
      )}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const LabInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<Category>("All");
  const [dismissedAlert, setDismissedAlert] = useState<boolean>(false);

  const [restock, setRestock] = useState<RestockState | null>(null);

  // ── Fetch ──
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await labInventoryApi.getInventory();
      setItems(data?.data?.results ?? data?.data ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // ── Derived ──
  const lowStockItems = items.filter(isLowStock);
  const expiringSoonItems = items.filter(isExpiringSoon);
  const okItems = items.filter(
    (i) => !isLowStock(i) && !isExpiringSoon(i)
  );

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.item_name.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      category === "All" || item.category === category;
    return matchSearch && matchCategory;
  });

  // ── Restock ──
  const openRestock = (item: InventoryItem) => {
    setRestock({
      itemId: item.id,
      qty: String(item.min_threshold - item.current_stock > 0
        ? item.min_threshold - item.current_stock
        : 10),
      loading: false,
      error: null,
    });
  };

  const closeRestock = () => setRestock(null);

  const submitRestock = async (item: InventoryItem) => {
    if (!restock) return;
    const qty = parseInt(restock.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      setRestock((r) => r ? { ...r, error: "Enter a valid quantity." } : r);
      return;
    }
    try {
      setRestock((r) => r ? { ...r, loading: true, error: null } : r);
      const newStock = item.current_stock + qty;
      await labInventoryApi.updateInventory(item.id, { current_stock: newStock });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, current_stock: newStock } : i
        )
      );
      setRestock(null);
    } catch (err: unknown) {
      setRestock((r) =>
        r
          ? {
              ...r,
              loading: false,
              error: err instanceof Error ? err.message : "Restock failed.",
            }
          : r
      );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lab Inventory</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage reagents, consumables, and equipment stock
          </p>
        </div>
        <button
          onClick={fetchInventory}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Low Stock Alert Banner */}
      {!dismissedAlert && lowStockItems.length > 0 && !loading && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
          <AlertTriangle
            size={18}
            className="text-red-500 flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">
              Low Stock Alert — {lowStockItems.length} item
              {lowStockItems.length > 1 ? "s" : ""} below minimum threshold
            </p>
            <p className="text-xs text-red-600 mt-0.5 truncate">
              {lowStockItems
                .slice(0, 4)
                .map((i) => i.item_name)
                .join(", ")}
              {lowStockItems.length > 4 &&
                ` +${lowStockItems.length - 4} more`}
            </p>
          </div>
          <button
            onClick={() => setDismissedAlert(true)}
            className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Items"
          value={items.length}
          icon={<Package size={22} className="text-white" />}
          iconBg="bg-[#0A6253]"
          valueColor="text-gray-900"
        />
        <KPICard
          label="Low Stock"
          value={lowStockItems.length}
          icon={<AlertTriangle size={22} className="text-red-600" />}
          iconBg="bg-red-50"
          valueColor="text-red-700"
          subtext="Below minimum threshold"
        />
        <KPICard
          label="Expiring Soon"
          value={expiringSoonItems.length}
          icon={<Clock size={22} className="text-orange-600" />}
          iconBg="bg-orange-50"
          valueColor="text-orange-700"
          subtext="Within 30 days"
        />
        <KPICard
          label="OK"
          value={okItems.length}
          icon={<CheckCircle size={22} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          valueColor="text-emerald-700"
          subtext="Adequate stock"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Search Item
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by item name…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Filter size={12} className="inline mr-1" />
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All Categories" : c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Inventory Items ({filtered.length})
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={32} className="animate-spin text-[#0A6253]" />
            <p className="text-sm text-gray-500">Loading inventory…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">{error}</p>
            <button
              onClick={fetchInventory}
              className="text-sm text-[#0A6253] hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Package size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              No inventory items found
            </p>
            <p className="text-xs text-gray-400">
              Try adjusting your search or category filter
            </p>
          </div>
        )}

        {/* Data */}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    "Item Name",
                    "Category",
                    "Stock / Min",
                    "Stock Level",
                    "Expiry Date",
                    "Last Restocked",
                    "Actions",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const pct = stockPercent(item.current_stock, item.min_threshold);
                  const barColor = stockBarColor(pct);
                  const catCfg = CATEGORY_CONFIG[item.category];
                  const isRestocking = restock?.itemId === item.id;
                  const expiring = isExpiringSoon(item);
                  const low = isLowStock(item);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/60 transition-colors ${
                        low ? "bg-red-50/30" : ""
                      }`}
                    >
                      {/* Item Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-800 truncate max-w-[180px]">
                            {item.item_name}
                          </div>
                          {low && (
                            <span title="Low stock">
                              <AlertTriangle
                                size={13}
                                className="text-red-500 flex-shrink-0"
                              />
                            </span>
                          )}
                          {expiring && (
                            <span title="Expiring soon">
                              <Clock
                                size={13}
                                className="text-orange-500 flex-shrink-0"
                              />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${catCfg.classes}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${catCfg.dot}`}
                          />
                          {item.category}
                        </span>
                      </td>

                      {/* Stock / Min */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            low ? "text-red-600" : "text-gray-800"
                          }`}
                        >
                          {item.current_stock}
                        </span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-500">
                          {item.min_threshold}
                        </span>
                        <span className="text-gray-400 ml-1 text-xs">
                          {item.unit}
                        </span>
                      </td>

                      {/* Stock Bar */}
                      <td className="px-4 py-3 w-36">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: stockBarWidth(pct) }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {pct > 200 ? ">200" : pct}%
                          </span>
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-xs ${
                          expiring ? "text-orange-600 font-semibold" : "text-gray-600"
                        }`}
                      >
                        {formatDate(item.expiry_date)}
                      </td>

                      {/* Last Restocked */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(item.last_restocked)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isRestocking ? (
                          /* Inline Restock Input */
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                value={restock?.qty ?? ""}
                                onChange={(e) =>
                                  setRestock((r) =>
                                    r ? { ...r, qty: e.target.value } : r
                                  )
                                }
                                placeholder="Qty"
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") submitRestock(item);
                                  if (e.key === "Escape") closeRestock();
                                }}
                              />
                              <button
                                onClick={() => submitRestock(item)}
                                disabled={restock?.loading}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-60"
                                style={{ backgroundColor: "#0A6253" }}
                              >
                                {restock?.loading ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <TrendingUp size={11} />
                                )}
                                Add
                              </button>
                              <button
                                onClick={closeRestock}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {restock?.error && (
                              <p className="text-xs text-red-500">
                                {restock.error}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openRestock(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                            style={{
                              borderColor: "#0A6253",
                              color: "#0A6253",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                "#0A6253";
                              (e.currentTarget as HTMLButtonElement).style.color =
                                "#ffffff";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                "transparent";
                              (e.currentTarget as HTMLButtonElement).style.color =
                                "#0A6253";
                            }}
                          >
                            <Plus size={12} />
                            Restock
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
      </div>
    </div>
  );
};

export default LabInventory;
