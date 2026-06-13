import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Bell,
  RefreshCw,
  Clock,
  User,
  MapPin,
  Activity,
} from "lucide-react";
import { teleicuApi } from "../../api/teleicu";
import client from "../../api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "CRITICAL" | "WARNING" | "INFO";
type FilterTab = "ALL" | Severity | "ACKNOWLEDGED";

interface AlertPatient {
  id: number | string;
  full_name: string;
}

interface TeleICUAlert {
  id: number | string;
  patient: AlertPatient;
  bed_location: string;
  alert_type: string;
  parameter: string;
  description: string;
  severity: Severity;
  timestamp: string;
  is_acknowledged: boolean;
}

interface AlertsResponse {
  results: TeleICUAlert[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function relativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const config: Record<
    Severity,
    { label: string; icon: React.ReactNode; cls: string }
  > = {
    CRITICAL: {
      label: "Critical",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      cls: "bg-red-100 text-red-700 border border-red-200",
    },
    WARNING: {
      label: "Warning",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      cls: "bg-orange-100 text-orange-700 border border-orange-200",
    },
    INFO: {
      label: "Info",
      icon: <Info className="w-3.5 h-3.5" />,
      cls: "bg-blue-100 text-blue-700 border border-blue-200",
    },
  };

  const { label, icon, cls } = config[severity];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
};

const StatusBadge: React.FC<{ acknowledged: boolean }> = ({ acknowledged }) =>
  acknowledged ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle className="w-3.5 h-3.5" />
      Acknowledged
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
      <Clock className="w-3.5 h-3.5" />
      Active
    </span>
  );

// ─── Critical Alert Card ──────────────────────────────────────────────────────

const CriticalAlertCard: React.FC<{
  alert: TeleICUAlert;
  onAcknowledge: (id: number | string) => void;
  acknowledging: boolean;
}> = ({ alert, onAcknowledge, acknowledging }) => (
  <div className="relative flex items-start gap-4 p-4 bg-white rounded-xl border-l-4 border-red-500 shadow-sm hover:shadow-md transition-shadow">
    {/* Blinking dot */}
    <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>

    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
      <AlertTriangle className="w-5 h-5 text-red-600" />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="font-semibold text-gray-900 text-sm">
          {alert.patient.full_name}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="w-3 h-3" />
          {alert.bed_location}
        </span>
      </div>
      <p className="text-xs font-medium text-red-700 mb-0.5">{alert.alert_type}</p>
      <p className="text-xs text-gray-600 mb-1">{alert.description}</p>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
          <Activity className="w-3 h-3" />
          {alert.parameter}
        </span>
        <span className="text-xs text-gray-400">
          {relativeTime(alert.timestamp)}
        </span>
      </div>
    </div>

    {!alert.is_acknowledged && (
      <button
        onClick={() => onAcknowledge(alert.id)}
        disabled={acknowledging}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {acknowledging ? "..." : "Acknowledge"}
      </button>
    )}
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  colorCls: string;
  bgCls: string;
  borderCls: string;
}> = ({ label, value, icon, colorCls, bgCls, borderCls }) => (
  <div
    className={`flex items-center gap-4 p-5 bg-white rounded-xl border ${borderCls} shadow-sm`}
  >
    <div className={`w-12 h-12 rounded-xl ${bgCls} flex items-center justify-center flex-shrink-0`}>
      <span className={colorCls}>{icon}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const TeleICUAlerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [acknowledging, setAcknowledging] = useState<Set<number | string>>(
    new Set()
  );

  // ── Fetch alerts ────────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery<AlertsResponse, Error>({
    queryKey: ["teleicu", "alerts"],
    queryFn: () => teleicuApi.getAlerts().then(r => r.data),
    refetchInterval: 10000,
  });

  const alerts: TeleICUAlert[] = data?.results ?? [];

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalActive = alerts.filter((a) => !a.is_acknowledged).length;
  const critical = alerts.filter(
    (a) => a.severity === "CRITICAL" && !a.is_acknowledged
  ).length;
  const warnings = alerts.filter(
    (a) => a.severity === "WARNING" && !a.is_acknowledged
  ).length;
  const acknowledged = alerts.filter((a) => a.is_acknowledged).length;

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredAlerts = alerts.filter((a) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "ACKNOWLEDGED") return a.is_acknowledged;
    return a.severity === activeFilter && !a.is_acknowledged;
  });

  // ── Critical unacknowledged (for top cards) ─────────────────────────────────
  const criticalUnacked = alerts.filter(
    (a) => a.severity === "CRITICAL" && !a.is_acknowledged
  );

  // ── Acknowledge handler ─────────────────────────────────────────────────────
  const handleAcknowledge = async (id: number | string) => {
    setAcknowledging((prev) => new Set(prev).add(id));
    try {
      await client.post(`/teleicu/alerts/${id}/acknowledge/`);
      await queryClient.invalidateQueries({ queryKey: ["teleicu", "alerts"] });
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Filter tab config ───────────────────────────────────────────────────────
  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "ALL", label: "All", count: alerts.length },
    { key: "CRITICAL", label: "Critical", count: critical },
    { key: "WARNING", label: "Warning", count: warnings },
    { key: "ACKNOWLEDGED", label: "Acknowledged", count: acknowledged },
  ];

  const filterTabColor: Record<FilterTab, string> = {
    ALL: "text-[#0A6253] border-[#0A6253]",
    CRITICAL: "text-red-600 border-red-500",
    WARNING: "text-orange-600 border-orange-500",
    INFO: "text-blue-600 border-blue-500",
    ACKNOWLEDGED: "text-emerald-600 border-emerald-500",
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 text-[#0A6253] animate-spin" />
        <p className="text-gray-500 text-sm">Loading alerts…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-red-600 font-semibold">Failed to load alerts</p>
        <p className="text-gray-400 text-xs">{error?.message}</p>
        <button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["teleicu", "alerts"] })
          }
          className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0A6253] text-white hover:bg-[#084d40] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A6253]/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#0A6253]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Alerts Management</h2>
            <p className="text-xs text-gray-500">
              Auto-refreshes every 10 seconds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Updating…
            </span>
          )}
          <button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["teleicu", "alerts"] })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Active Alerts"
          value={totalActive}
          icon={<Bell className="w-6 h-6" />}
          colorCls="text-[#0A6253]"
          bgCls="bg-[#0A6253]/10"
          borderCls="border-[#0A6253]/20"
        />
        <KpiCard
          label="Critical"
          value={critical}
          icon={<AlertTriangle className="w-6 h-6" />}
          colorCls="text-red-600"
          bgCls="bg-red-100"
          borderCls="border-red-200"
        />
        <KpiCard
          label="Warnings"
          value={warnings}
          icon={<AlertCircle className="w-6 h-6" />}
          colorCls="text-orange-600"
          bgCls="bg-orange-100"
          borderCls="border-orange-200"
        />
        <KpiCard
          label="Acknowledged"
          value={acknowledged}
          icon={<CheckCircle className="w-6 h-6" />}
          colorCls="text-emerald-600"
          bgCls="bg-emerald-100"
          borderCls="border-emerald-200"
        />
      </div>

      {/* ── Critical Alert Cards ── */}
      {criticalUnacked.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <h3 className="text-sm font-semibold text-red-700">
              {criticalUnacked.length} Critical Alert
              {criticalUnacked.length > 1 ? "s" : ""} Requiring Immediate
              Attention
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {criticalUnacked.map((alert) => (
              <CriticalAlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                acknowledging={acknowledging.has(alert.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Filter Tabs + Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex items-center gap-0 border-b border-gray-100 px-4 overflow-x-auto">
          {filterTabs.map(({ key, label, count }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? `${filterTabColor[key]} bg-transparent`
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {count !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                      isActive
                        ? key === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : key === "WARNING"
                          ? "bg-orange-100 text-orange-700"
                          : key === "ACKNOWLEDGED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-[#0A6253]/10 text-[#0A6253]"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle className="w-12 h-12 text-emerald-300" />
            <p className="text-gray-500 font-medium">No alerts in this category</p>
            <p className="text-gray-400 text-xs">
              {activeFilter === "ALL"
                ? "All systems are operating normally."
                : `No ${activeFilter.toLowerCase()} alerts at this time.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Severity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Patient / Bed
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Alert Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Parameter
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide max-w-xs">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      alert.severity === "CRITICAL" && !alert.is_acknowledged
                        ? "bg-red-50/40"
                        : ""
                    }`}
                  >
                    {/* Severity */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SeverityBadge severity={alert.severity} />
                    </td>

                    {/* Patient / Bed */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0A6253]/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-[#0A6253]" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm leading-tight">
                            {alert.patient.full_name}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {alert.bed_location}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Alert Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-700 font-medium text-sm">
                        {alert.alert_type}
                      </span>
                    </td>

                    {/* Parameter */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                          alert.severity === "CRITICAL"
                            ? "bg-red-100 text-red-700"
                            : alert.severity === "WARNING"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        <Activity className="w-3 h-3" />
                        {alert.parameter}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
                        {alert.description}
                      </p>
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="text-gray-700 text-xs font-medium">
                          {formatTimestamp(alert.timestamp)}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {relativeTime(alert.timestamp)}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge acknowledged={alert.is_acknowledged} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {alert.is_acknowledged ? (
                        <span className="text-xs text-gray-400 italic">
                          Done
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledging.has(alert.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            alert.severity === "CRITICAL"
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-[#0A6253] hover:bg-[#084d40] text-white"
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {acknowledging.has(alert.id)
                            ? "Acknowledging…"
                            : "Acknowledge"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filteredAlerts.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-medium text-gray-600">
                {filteredAlerts.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-600">{alerts.length}</span>{" "}
              alerts
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Next refresh in ~10s
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeleICUAlerts;
