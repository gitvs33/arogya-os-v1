import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor,
  Camera,
  Wifi,
  WifiOff,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Network,
  Activity,
  Eye,
  Stethoscope,
} from "lucide-react";
import { teleicuApi } from "../../api/teleicu";

// ─── Types ────────────────────────────────────────────────────────────────────

type BedStatus = "OCCUPIED" | "AVAILABLE" | "MAINTENANCE";

interface Ward {
  id: number | string;
  name: string;
}

interface CurrentSession {
  patient: {
    full_name: string;
  };
}

interface Bed {
  id: number | string;
  bed_number: string;
  status: BedStatus;
  camera_feed_url: string;
  device_ip: string;
  ward: Ward;
  current_session: CurrentSession | null;
  last_ping: string;
}

interface BedsResponse {
  results: Bed[];
}

type ViewMode = "grid" | "table";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Device is "Online" when the bed is OCCUPIED (live patient session),
 * "Maintenance" when status is MAINTENANCE, and "Offline" otherwise.
 */
function getDeviceStatus(bed: Bed): "Online" | "Offline" | "Maintenance" {
  if (bed.status === "MAINTENANCE") return "Maintenance";
  if (bed.status === "OCCUPIED") return "Online";
  return "Offline";
}

function isCameraLive(bed: Bed): boolean {
  return bed.status === "OCCUPIED" && Boolean(bed.camera_feed_url);
}

function formatLastPing(isoString: string): string {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString();
  } catch {
    return "N/A";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: "Online" | "Offline" | "Maintenance" }> = ({
  status,
}) => {
  if (status === "Online") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
      </span>
    );
  }
  if (status === "Maintenance") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-400" />
      </span>
    );
  }
  return (
    <span className="relative flex h-3 w-3">
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
    </span>
  );
};

const StatusBadge: React.FC<{ status: "Online" | "Offline" | "Maintenance" }> = ({
  status,
}) => {
  const cfg = {
    Online: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    Offline: "bg-red-50 text-red-700 border border-red-200",
    Maintenance: "bg-orange-50 text-orange-700 border border-orange-200",
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg}`}>
      <StatusDot status={status} />
      {status}
    </span>
  );
};

const CameraFeedBadge: React.FC<{ live: boolean }> = ({ live }) => {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Camera className="w-3 h-3" />
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      <Camera className="w-3 h-3" />
      No Feed
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  colorClass,
  bgClass,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgClass}`}>
      <span className={colorClass}>{icon}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── Device Card (grid) ───────────────────────────────────────────────────────

const DeviceCard: React.FC<{ bed: Bed }> = ({ bed }) => {
  const deviceStatus = getDeviceStatus(bed);
  const cameraLive = isCameraLive(bed);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#0A6253]/30 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#0A6253]/10 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-[#0A6253]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Bed {bed.bed_number}</p>
            <p className="text-xs text-gray-500">{bed.ward.name}</p>
          </div>
        </div>
        <StatusBadge status={deviceStatus} />
      </div>

      {/* Card body */}
      <div className="p-4 flex-1 space-y-3">
        {/* Patient */}
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-gray-700 truncate">
            {bed.current_session?.patient?.full_name ?? (
              <span className="text-gray-400 italic">No patient</span>
            )}
          </span>
        </div>

        {/* Last heartbeat */}
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-gray-600">
            Last ping:{" "}
            <span className="font-medium text-gray-800">
              {formatLastPing(bed.last_ping)}
            </span>
          </span>
        </div>

        {/* Device IP */}
        <div className="flex items-center gap-2 text-sm">
          <Network className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-gray-600 font-mono text-xs">
            {bed.device_ip || "—"}
          </span>
        </div>

        {/* Hub ID */}
        <div className="flex items-center gap-2 text-sm">
          {deviceStatus === "Online" ? (
            <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          <span className="text-gray-600 font-mono text-xs">
            Hub #{String(bed.id).padStart(4, "0")}
          </span>
        </div>

        {/* Camera feed badge */}
        <div className="pt-1">
          <CameraFeedBadge live={cameraLive} />
        </div>
      </div>

      {/* Card footer – actions */}
      <div className="p-3 border-t border-gray-100 grid grid-cols-2 gap-2">
        <button
          disabled={!cameraLive}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            bg-[#0A6253] text-white hover:bg-[#085045] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye className="w-3.5 h-3.5" />
          View Camera
        </button>
        <button
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Check Device
        </button>
      </div>
    </div>
  );
};

// ─── Table Row ────────────────────────────────────────────────────────────────

const TableRow: React.FC<{ bed: Bed; index: number }> = ({ bed, index }) => {
  const deviceStatus = getDeviceStatus(bed);
  const cameraLive = isCameraLive(bed);

  return (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
        Bed {bed.bed_number}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{bed.ward.name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={deviceStatus} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {bed.current_session?.patient?.full_name ?? (
          <span className="text-gray-400 italic">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatLastPing(bed.last_ping)}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">
        {bed.device_ip || "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">
        #{String(bed.id).padStart(4, "0")}
      </td>
      <td className="px-4 py-3">
        <CameraFeedBadge live={cameraLive} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            disabled={!cameraLive}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md
              bg-[#0A6253] text-white hover:bg-[#085045] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye className="w-3 h-3" />
            Camera
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md
              border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Stethoscope className="w-3 h-3" />
            Check
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const WARD_OPTIONS = [
  "All",
  "Cardiac ICU",
  "Neuro ICU",
  "Respiratory ICU",
] as const;

type WardFilter = (typeof WARD_OPTIONS)[number];

const TeleICUDevices: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [wardFilter, setWardFilter] = useState<WardFilter>("All");
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery<BedsResponse>({
    queryKey: ["teleicu-beds"],
    queryFn: () => teleicuApi.getBeds().then(r => r.data),
    refetchInterval: 30000,
  });

  const beds = data?.results ?? [];

  // KPI counts
  const kpiOnline = beds.filter((b) => getDeviceStatus(b) === "Online").length;
  const kpiOffline = beds.filter((b) => getDeviceStatus(b) === "Offline").length;
  const kpiMaintenance = beds.filter(
    (b) => getDeviceStatus(b) === "Maintenance"
  ).length;

  // Filtered beds
  const filteredBeds = useMemo(() => {
    let list = beds;

    if (wardFilter !== "All") {
      list = list.filter(
        (b) => b.ward.name.toLowerCase() === wardFilter.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.bed_number.toLowerCase().includes(q) ||
          b.ward.name.toLowerCase().includes(q) ||
          b.device_ip?.toLowerCase().includes(q) ||
          b.current_session?.patient?.full_name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [beds, wardFilter, search]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* KPI skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-52 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
          <XCircle className="w-10 h-10 text-red-500" />
          <p className="font-semibold text-red-700">Failed to load device data</p>
          <p className="text-sm text-red-500">Could not reach the TeleICU service.</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#0A6253]" />
            Bedside Devices
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time monitoring of all ICU bedside hardware
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
              border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors
              disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#0A6253]" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Devices"
          value={beds.length}
          icon={<Monitor className="w-6 h-6" />}
          colorClass="text-[#0A6253]"
          bgClass="bg-[#0A6253]/10"
        />
        <KpiCard
          label="Online"
          value={kpiOnline}
          icon={<CheckCircle2 className="w-6 h-6" />}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />
        <KpiCard
          label="Offline"
          value={kpiOffline}
          icon={<XCircle className="w-6 h-6" />}
          colorClass="text-red-500"
          bgClass="bg-red-50"
        />
        <KpiCard
          label="Maintenance"
          value={kpiMaintenance}
          icon={<AlertTriangle className="w-6 h-6" />}
          colorClass="text-orange-500"
          bgClass="bg-orange-50"
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Ward filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {WARD_OPTIONS.map((ward) => (
            <button
              key={ward}
              onClick={() => setWardFilter(ward)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                wardFilter === ward
                  ? "bg-white text-[#0A6253] shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {ward}
              {ward !== "All" && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  wardFilter === ward ? "bg-[#0A6253]/10 text-[#0A6253]" : "bg-gray-200 text-gray-500"
                }`}>
                  {beds.filter((b) =>
                    b.ward.name.toLowerCase() === ward.toLowerCase()
                  ).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search beds, patients, IPs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-52
                focus:outline-none focus:ring-2 focus:ring-[#0A6253]/30 focus:border-[#0A6253]
                placeholder:text-gray-400"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-[#0A6253] text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`p-2 transition-colors ${
                viewMode === "table"
                  ? "bg-[#0A6253] text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Results count ── */}
      <p className="text-xs text-gray-500 -mt-2">
        Showing{" "}
        <span className="font-semibold text-gray-700">{filteredBeds.length}</span>{" "}
        of <span className="font-semibold text-gray-700">{beds.length}</span> devices
      </p>

      {/* ── No results ── */}
      {filteredBeds.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No devices found</p>
          <p className="text-xs mt-1">Try adjusting your search or filter.</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {viewMode === "grid" && filteredBeds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBeds.map((bed) => (
            <DeviceCard key={bed.id} bed={bed} />
          ))}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && filteredBeds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    "Bed",
                    "Ward",
                    "Status",
                    "Patient",
                    "Last Ping",
                    "Device IP",
                    "Hub ID",
                    "Camera",
                    "Actions",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBeds.map((bed, i) => (
                  <TableRow key={bed.id} bed={bed} index={i} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filteredBeds.length} device{filteredBeds.length !== 1 ? "s" : ""} listed
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Online
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Offline
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                Maintenance
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeleICUDevices;
