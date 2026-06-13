import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flag,
  Filter,
  Calendar,
  Search,
  RefreshCw,
  ChevronDown,
  FileDown,
} from "lucide-react";
import { labOrdersApi } from "../../api/lab/index";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabReport {
  id: string;
  lab_id: string;
  patient_name: string;
  patient_id: string;
  test_panel: string;
  completed_at: string;
  reported_by: string;
  status: "COMPLETED" | "CRITICAL" | "PENDING" | "FLAGGED";
  department: string;
}

interface KPIs {
  total: number;
  completed: number;
  pending: number;
  critical: number;
}

interface Filters {
  from: string;
  to: string;
  department: string;
  search: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  "All Departments",
  "Hematology",
  "Biochemistry",
  "Microbiology",
  "Immunology",
  "Pathology",
  "Radiology",
  "Genetics",
];

const STATUS_CONFIG: Record<
  LabReport["status"],
  { label: string; classes: string; icon: React.ReactNode }
> = {
  COMPLETED: {
    label: "Completed",
    classes: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: <CheckCircle size={12} />,
  },
  CRITICAL: {
    label: "Critical",
    classes: "bg-red-50 text-red-700 border border-red-200",
    icon: <AlertTriangle size={12} />,
  },
  PENDING: {
    label: "Pending",
    classes: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: <Clock size={12} />,
  },
  FLAGGED: {
    label: "Flagged",
    classes: "bg-orange-50 text-orange-700 border border-orange-200",
    icon: <Flag size={12} />,
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const today = (): string => new Date().toISOString().split("T")[0];
const thirtyDaysAgo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon,
  iconBg,
  valueColor,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>{value.toLocaleString()}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const LabReports: React.FC = () => {
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"CSV" | "PDF" | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  const [filters, setFilters] = useState<Filters>({
    from: thirtyDaysAgo(),
    to: today(),
    department: "All Departments",
    search: "",
  });

  // ── Fetch ──
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await labOrdersApi.listOrders({ status: "COMPLETED" });
      setReports(data?.data?.results ?? data?.data ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load lab reports."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ── Filtered data ──
  const filtered = reports.filter((r) => {
    const completedDate = r.completed_at?.split("T")[0] ?? "";
    const inDateRange =
      (!filters.from || completedDate >= filters.from) &&
      (!filters.to || completedDate <= filters.to);
    const inDept =
      filters.department === "All Departments" ||
      r.department === filters.department;
    const inSearch =
      !filters.search ||
      r.patient_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      r.lab_id.toLowerCase().includes(filters.search.toLowerCase()) ||
      r.test_panel.toLowerCase().includes(filters.search.toLowerCase());
    return inDateRange && inDept && inSearch;
  });

  // ── KPIs ──
  const kpis: KPIs = {
    total: filtered.length,
    completed: filtered.filter((r) => r.status === "COMPLETED").length,
    pending: filtered.filter((r) => r.status === "PENDING").length,
    critical: filtered.filter((r) => r.status === "CRITICAL" || r.status === "FLAGGED").length,
  };

  // ── Export ──
  const handleExport = async (format: "CSV" | "PDF") => {
    try {
      setExporting(format);
      setShowExportMenu(false);
      await labOrdersApi.exportReport({
        format,
        from: filters.from,
        to: filters.to,
        department:
          filters.department === "All Departments" ? undefined : filters.department,
      });
    } catch {
      // silently handled — production would show a toast
    } finally {
      setExporting(null);
    }
  };

  // ── Actions ──
  const handleDownload = (report: LabReport) => {
    console.log("Download PDF for", report.lab_id);
  };
  const handleShare = (report: LabReport) => {
    console.log("Share report", report.lab_id);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lab Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            View and export completed laboratory reports
          </p>
        </div>

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu((prev) => !prev)}
            disabled={!!exporting || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-all disabled:opacity-60"
            style={{ backgroundColor: "#0A6253" }}
          >
            {exporting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Exporting {exporting}…
              </>
            ) : (
              <>
                <FileDown size={15} />
                Export
                <ChevronDown size={14} />
              </>
            )}
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => handleExport("CSV")}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText size={14} /> Export CSV
              </button>
              <button
                onClick={() => handleExport("PDF")}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileDown size={14} /> Export PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Search
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                placeholder="Patient, Lab ID, Test…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              From
            </label>
            <input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              To
            </label>
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              max={today()}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Filter size={12} className="inline mr-1" />
              Department
            </label>
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters((f) => ({ ...f, department: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Reports"
          value={kpis.total}
          icon={<FileText size={22} className="text-white" />}
          iconBg="bg-[#0A6253]"
          valueColor="text-gray-900"
        />
        <KPICard
          label="Completed"
          value={kpis.completed}
          icon={<CheckCircle size={22} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          valueColor="text-emerald-700"
        />
        <KPICard
          label="Pending"
          value={kpis.pending}
          icon={<Clock size={22} className="text-amber-600" />}
          iconBg="bg-amber-50"
          valueColor="text-amber-700"
        />
        <KPICard
          label="Critical Flags"
          value={kpis.critical}
          icon={<AlertTriangle size={22} className="text-red-600" />}
          iconBg="bg-red-50"
          valueColor="text-red-700"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Reports ({filtered.length})
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={32} className="animate-spin text-[#0A6253]" />
            <p className="text-sm text-gray-500">Loading reports…</p>
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
              onClick={fetchReports}
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
              <FileText size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No reports found</p>
            <p className="text-xs text-gray-400">
              Try adjusting filters or date range
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
                    "Lab ID",
                    "Patient",
                    "Test Panel",
                    "Completed At",
                    "Reported By",
                    "Status",
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
                {filtered.map((report) => {
                  const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.COMPLETED;
                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Lab ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-[#0A6253] bg-emerald-50 px-2 py-0.5 rounded">
                          {report.lab_id}
                        </span>
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 truncate max-w-[140px]">
                          {report.patient_name}
                        </div>
                        <div className="text-xs text-gray-400">{report.patient_id}</div>
                      </td>

                      {/* Test Panel */}
                      <td className="px-4 py-3">
                        <span className="text-gray-700 truncate block max-w-[160px]">
                          {report.test_panel}
                        </span>
                      </td>

                      {/* Completed At */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                        {formatDate(report.completed_at)}
                      </td>

                      {/* Reported By */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {report.reported_by}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.classes}`}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(report)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#0A6253] hover:bg-emerald-50 transition-colors"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={() => handleShare(report)}
                            title="Share"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Share2 size={15} />
                          </button>
                        </div>
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

export default LabReports;
