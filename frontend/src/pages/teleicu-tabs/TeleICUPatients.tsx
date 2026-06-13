import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Wind,
  Droplets,
  User,
  Bed,
  Activity,
  Users,
  AlertTriangle,
  CheckCircle2,
  Eye,
  LogOut,
  Loader2,
  AlertCircle,
  InboxIcon,
  Stethoscope,
  Clock,
} from "lucide-react";
import { teleicuApi } from "../../api/teleicu";

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = "M" | "F" | "O" | string;

interface Patient {
  id: string | number;
  full_name: string;
  age: number;
  gender: Gender;
}

interface Ward {
  name: string;
}

interface Bed {
  bed_number: string | number;
  ward: Ward;
}

interface ICUSession {
  id: string | number;
  patient: Patient;
  bed: Bed;
  acuity_status: string;
  support_type: string;
  is_active: boolean;
  created_at: string;
  assigned_doctor?: string;
}

interface SessionsResponse {
  results: ICUSession[];
}

type FilterTab = "All" | "Critical" | "Stable" | "On Ventilator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDurationDays(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function genderLabel(gender: Gender): string {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return "Other";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

function StatCard({ label, value, icon, color, bgColor, borderColor }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border ${borderColor} p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className={`${bgColor} ${color} rounded-xl p-3 flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const lower = status?.toLowerCase() ?? "";

  if (lower === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Critical
      </span>
    );
  }
  if (lower === "unstable") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        Unstable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Stable
    </span>
  );
}

interface SupportBadgeProps {
  type: string;
}

function SupportBadge({ type }: SupportBadgeProps) {
  const lower = type?.toLowerCase() ?? "";

  if (lower.includes("ventilator") || lower === "vent") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        <Wind className="w-3 h-3" />
        Ventilator
      </span>
    );
  }
  if (lower.includes("oxygen") || lower === "o2") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        <Droplets className="w-3 h-3" />
        Oxygen
      </span>
    );
  }
  if (!type || lower === "none" || lower === "n/a") {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      {type}
    </span>
  );
}

interface AcuityDotsProps {
  acuity: string;
}

function AcuityDots({ acuity }: AcuityDotsProps) {
  const num = parseInt(acuity ?? "0", 10);
  const total = 5;
  if (isNaN(num)) {
    return <span className="text-gray-400 text-xs">{acuity || "—"}</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full border transition-colors ${
            i < num
              ? num >= 4
                ? "bg-red-500 border-red-600"
                : num >= 3
                ? "bg-orange-400 border-orange-500"
                : "bg-emerald-500 border-emerald-600"
              : "bg-gray-100 border-gray-200"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500 font-medium">{num}/{total}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeleICUPatients() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
    queryKey: ["teleicu-sessions"],
    queryFn: () => teleicuApi.getSessions().then(r => r.data),
    refetchInterval: 30_000,
  });

  const sessions: ICUSession[] = Array.isArray(data) ? data : (data?.results ?? []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = sessions.length;
    const critical = sessions.filter(
      (s) => s.acuity_status?.toLowerCase() === "critical"
    ).length;
    const stable = sessions.filter(
      (s) => s.acuity_status?.toLowerCase() === "stable"
    ).length;
    const onVentilator = sessions.filter((s) => {
      const t = s.support_type?.toLowerCase() ?? "";
      return t.includes("ventilator") || t === "vent";
    }).length;
    return { total, critical, stable, onVentilator };
  }, [sessions]);

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = sessions;

    if (activeTab === "Critical") {
      list = list.filter(
        (s) => s.acuity_status?.toLowerCase() === "critical"
      );
    } else if (activeTab === "Stable") {
      list = list.filter((s) => s.acuity_status?.toLowerCase() === "stable");
    } else if (activeTab === "On Ventilator") {
      list = list.filter((s) => {
        const t = s.support_type?.toLowerCase() ?? "";
        return t.includes("ventilator") || t === "vent";
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) =>
        s.patient?.full_name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sessions, activeTab, searchQuery]);

  const tabs: FilterTab[] = ["All", "Critical", "Stable", "On Ventilator"];

  const tabCounts: Record<FilterTab, number> = {
    All: sessions.length,
    Critical: stats.critical,
    Stable: stats.stable,
    "On Ventilator": stats.onVentilator,
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0A6253]/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#0A6253] animate-spin" />
        </div>
        <p className="text-gray-500 font-medium">Loading ICU patients…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-gray-800 font-semibold">Failed to load ICU data</p>
          <p className="text-gray-500 text-sm mt-1">
            Something went wrong while fetching sessions.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 rounded-lg bg-[#0A6253] text-white text-sm font-medium hover:bg-[#085246] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Admitted"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          color="text-[#0A6253]"
          bgColor="bg-[#0A6253]/10"
          borderColor="border-gray-100"
        />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-red-600"
          bgColor="bg-red-50"
          borderColor="border-red-100"
        />
        <StatCard
          label="Stable"
          value={stats.stable}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-100"
        />
        <StatCard
          label="On Ventilator"
          value={stats.onVentilator}
          icon={<Wind className="w-5 h-5" />}
          color="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-100"
        />
      </div>

      {/* ── Filter & Search bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 pt-5 pb-4 border-b border-gray-100">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab
                    ? "bg-white text-[#0A6253] shadow-sm border border-gray-100"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab
                      ? "bg-[#0A6253]/10 text-[#0A6253]"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all w-56 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <InboxIcon className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No patients found</p>
            {(searchQuery || activeTab !== "All") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("All");
                }}
                className="text-[#0A6253] text-sm font-medium hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Patient",
                    "ICU / Bed",
                    "Status",
                    "Support",
                    "Acuity",
                    "Assigned Doctor",
                    "Duration",
                    "Actions",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((session) => {
                  const { patient, bed } = session;
                  const days = getDurationDays(session.created_at);

                  return (
                    <tr
                      key={session.id}
                      className="group hover:bg-gray-50/70 transition-colors"
                    >
                      {/* Patient column */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#0A6253]/10 text-[#0A6253] font-semibold text-sm flex items-center justify-center flex-shrink-0 select-none">
                            {getInitials(patient?.full_name ?? "?")}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">
                              {patient?.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {patient?.age ? `${patient.age} yrs` : "—"}{" "}
                              {patient?.gender
                                ? `· ${genderLabel(patient.gender)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ICU / Bed */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-start gap-2">
                          <Bed className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800 leading-tight">
                              {bed?.ward?.name ?? "—"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Bed {bed?.bed_number ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge status={session.acuity_status} />
                      </td>

                      {/* Support type */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <SupportBadge type={session.support_type} />
                      </td>

                      {/* Acuity */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <AcuityDots acuity={session.acuity_status} />
                      </td>

                      {/* Assigned Doctor */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {session.assigned_doctor ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#0A6253]/10 flex items-center justify-center flex-shrink-0">
                              <Stethoscope className="w-3 h-3 text-[#0A6253]" />
                            </div>
                            <span className="text-gray-700 font-medium">
                              {session.assigned_doctor}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-xs">Unassigned</span>
                          </div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-700 font-medium">
                            {days}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {days === 1 ? "day" : "days"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="View patient"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A6253]/10 text-[#0A6253] text-xs font-semibold hover:bg-[#0A6253]/20 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            title="Discharge patient"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Discharge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-600">
                  {filtered.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-600">
                  {sessions.length}
                </span>{" "}
                patients
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Activity className="w-3.5 h-3.5 text-[#0A6253]" />
                Auto-refreshes every 30 s
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
