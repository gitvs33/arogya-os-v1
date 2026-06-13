import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video,
  Phone,
  Plus,
  X,
  Search,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle2,
  Activity,
  CalendarClock,
  Users,
  Timer,
  ChevronDown,
} from "lucide-react";
import { teleicuApi } from "../../api/teleicu";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallType = "VIDEO" | "AUDIO";
type ConsultStatus = "ACTIVE" | "SCHEDULED" | "COMPLETED";

interface Patient {
  id: string | number;
  full_name: string;
}

interface Doctor {
  full_name: string;
}

interface Consult {
  id: string | number;
  patient: Patient;
  bed_location: string;
  doctor: Doctor;
  specialty: string;
  call_type: CallType;
  status: ConsultStatus;
  started_at: string;
  meeting_link: string;
}

interface ConsultsResponse {
  results: Consult[];
}

interface NewConsultForm {
  patient_search: string;
  specialty: string;
  call_type: CallType;
}

type FilterTab = "All" | ConsultStatus;

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: FilterTab[] = ["All", "ACTIVE", "SCHEDULED", "COMPLETED"];

const SPECIALTIES = [
  "Cardiology",
  "Neurology",
  "Pulmonology",
  "Nephrology",
  "Gastroenterology",
  "Endocrinology",
  "Infectious Disease",
  "Critical Care",
  "Hematology",
  "Oncology",
];

const STATUS_CONFIG: Record<
  ConsultStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  SCHEDULED: {
    label: "Scheduled",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDuration(startedAt: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return "—";
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  return `${mins}m`;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function avgDuration(consults: Consult[]): string {
  const completed = consults.filter(
    (c) => c.status === "COMPLETED" && c.started_at
  );
  if (completed.length === 0) return "—";
  const totalMins =
    completed.reduce((acc, c) => {
      const start = new Date(c.started_at);
      const now = new Date();
      return acc + Math.floor((now.getTime() - start.getTime()) / 60000);
    }, 0) / completed.length;
  const hrs = Math.floor(totalMins / 60);
  const mins = Math.round(totalMins % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${Math.round(totalMins)}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
  pulse?: boolean;
}

function KpiCard({ icon, label, value, accent = "bg-white", pulse }: KpiCardProps) {
  return (
    <div
      className={`${accent} rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {pulse && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: ConsultStatus;
  isLive?: boolean;
}

function StatusBadge({ status, isLive }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {isLive ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      )}
      {cfg.label}
    </span>
  );
}

interface CallTypeBadgeProps {
  type: CallType;
}

function CallTypeBadge({ type }: CallTypeBadgeProps) {
  if (type === "VIDEO") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
        <Video className="w-3 h-3" />
        Video
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
      <Phone className="w-3 h-3" />
      Audio
    </span>
  );
}

// ─── New Consult Modal ────────────────────────────────────────────────────────

interface NewConsultModalProps {
  onClose: () => void;
  onSubmit: (form: NewConsultForm) => void;
  isLoading: boolean;
}

function NewConsultModal({ onClose, onSubmit, isLoading }: NewConsultModalProps) {
  const [form, setForm] = useState<NewConsultForm>({
    patient_search: "",
    specialty: "",
    call_type: "VIDEO",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: "#0A6253" }}
        >
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">
              New Tele-Consultation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Patient Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name or ID…"
                value={form.patient_search}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patient_search: e.target.value }))
                }
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": "#0A6253" } as React.CSSProperties}
                required
              />
            </div>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Specialist Specialty
            </label>
            <div className="relative">
              <select
                value={form.specialty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specialty: e.target.value }))
                }
                className="w-full appearance-none px-4 py-2.5 pr-9 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                style={{ "--tw-ring-color": "#0A6253" } as React.CSSProperties}
                required
              >
                <option value="">Select specialty…</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Call Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call Type
            </label>
            <div className="flex gap-3">
              {(["VIDEO", "AUDIO"] as CallType[]).map((type) => {
                const isSelected = form.call_type === type;
                return (
                  <label
                    key={type}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                      isSelected
                        ? "border-[#0A6253] bg-[#0A6253]/5 text-[#0A6253]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="call_type"
                      value={type}
                      checked={isSelected}
                      onChange={() =>
                        setForm((f) => ({ ...f, call_type: type }))
                      }
                      className="sr-only"
                    />
                    {type === "VIDEO" ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    {type === "VIDEO" ? "Video Call" : "Audio Call"}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: "#0A6253" }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting…
                </span>
              ) : (
                "Start Consult"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeleICUConsults() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [showModal, setShowModal] = useState(false);
  const [joiningId, setJoiningId] = useState<string | number | null>(null);
  const [endingId, setEndingId] = useState<string | number | null>(null);

  // ── Queries ──
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
    queryKey: ["teleicu-consults"],
    queryFn: () => teleicuApi.getConsults().then(r => r.data),
    refetchInterval: 30000,
  });

  const consults: Consult[] = Array.isArray(data) ? data : (data?.results ?? []);

  // ── Mutations ──
  const createConsultMutation = useMutation({
    mutationFn: (payload: NewConsultForm) => teleicuApi.createConsult(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teleicu-consults"] });
      setShowModal(false);
    },
  });

  const startCallMutation = useMutation({
    mutationFn: (id: string | number) => teleicuApi.startCall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teleicu-consults"] });
      setJoiningId(null);
    },
    onError: () => setJoiningId(null),
  });

  const endCallMutation = useMutation({
    mutationFn: (id: string | number) => teleicuApi.endCall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teleicu-consults"] });
      setEndingId(null);
    },
    onError: () => setEndingId(null),
  });

  // ── KPI Calculations ──
  const activeCalls = consults.filter((c) => c.status === "ACTIVE").length;
  const scheduled = consults.filter((c) => c.status === "SCHEDULED").length;
  const completedToday = consults.filter(
    (c) => c.status === "COMPLETED" && isToday(c.started_at)
  ).length;
  const avgDur = avgDuration(consults);

  // ── Filtered Data ──
  const filtered = useMemo(() => {
    if (activeFilter === "All") return consults;
    return consults.filter((c) => c.status === activeFilter);
  }, [consults, activeFilter]);

  const filterCounts = useMemo(() => {
    return {
      All: consults.length,
      ACTIVE: consults.filter((c) => c.status === "ACTIVE").length,
      SCHEDULED: consults.filter((c) => c.status === "SCHEDULED").length,
      COMPLETED: consults.filter((c) => c.status === "COMPLETED").length,
    };
  }, [consults]);

  // ── Handlers ──
  const handleJoin = (consult: Consult) => {
    setJoiningId(consult.id);
    startCallMutation.mutate(consult.id);
    if (consult.meeting_link) {
      window.open(consult.meeting_link, "_blank", "noopener,noreferrer");
    }
  };

  const handleEnd = (id: string | number) => {
    setEndingId(id);
    endCallMutation.mutate(id);
  };

  const handleCreateConsult = (form: NewConsultForm) => {
    createConsultMutation.mutate(form);
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── New Consult Modal ── */}
      {showModal && (
        <NewConsultModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateConsult}
          isLoading={createConsultMutation.isPending}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tele-Consultations
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage remote specialist consultations for ICU patients
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
            style={{ background: "#0A6253" }}
          >
            <Plus className="w-4 h-4" />
            New Consult
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
            }
            label="Active Calls"
            value={activeCalls}
            pulse={activeCalls > 0}
          />
          <KpiCard
            icon={
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-blue-600" />
              </div>
            }
            label="Scheduled"
            value={scheduled}
          />
          <KpiCard
            icon={
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
            }
            label="Completed Today"
            value={completedToday}
          />
          <KpiCard
            icon={
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
            }
            label="Avg Duration"
            value={avgDur}
          />
        </div>

        {/* ── Main Panel ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {FILTER_TABS.map((tab) => {
                const isActive = activeFilter === tab;
                const count = filterCounts[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "All"
                      ? "All"
                      : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        isActive
                          ? "bg-[#0A6253] text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              Auto-refresh every 30s
            </button>
          </div>

          {/* ── Loading ── */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#0A6253] rounded-full animate-spin" />
              <p className="text-sm">Loading consultations…</p>
            </div>
          )}

          {/* ── Error ── */}
          {isError && (
            <div className="py-16 flex flex-col items-center gap-3 text-red-500">
              <X className="w-8 h-8" />
              <p className="text-sm font-medium">Failed to load consultations</p>
              <button
                onClick={() => refetch()}
                className="text-xs underline text-gray-500 hover:text-gray-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Empty ── */}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <Users className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                No consultations found
              </p>
              <p className="text-xs text-gray-400">
                {activeFilter !== "All"
                  ? `No ${activeFilter.toLowerCase()} consultations`
                  : "Start a new consult to get started"}
              </p>
            </div>
          )}

          {/* ── Table ── */}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {[
                      "Patient",
                      "Specialist",
                      "Call Type",
                      "Status",
                      "Started At",
                      "Duration",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((consult) => {
                    const isActive = consult.status === "ACTIVE";
                    const isJoining = joiningId === consult.id;
                    const isEnding = endingId === consult.id;
                    const initials = getInitials(consult.patient.full_name);

                    return (
                      <tr
                        key={consult.id}
                        className={`group transition-colors hover:bg-gray-50/80 ${
                          isActive ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        {/* Patient */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: "#0A6253" }}
                            >
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 leading-tight">
                                {consult.patient.full_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {consult.bed_location}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Specialist */}
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-gray-700">
                            {consult.doctor.full_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {consult.specialty}
                          </p>
                        </td>

                        {/* Call Type */}
                        <td className="px-4 py-3.5">
                          <CallTypeBadge type={consult.call_type} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge
                            status={consult.status}
                            isLive={isActive}
                          />
                        </td>

                        {/* Started At */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-700 font-medium tabular-nums">
                            {formatTime(consult.started_at)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(consult.started_at)}
                          </p>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3.5">
                          {isActive ? (
                            <span className="text-emerald-600 font-semibold tabular-nums flex items-center gap-1">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              {formatDuration(consult.started_at)}
                            </span>
                          ) : (
                            <span className="text-gray-500 tabular-nums">
                              {consult.status === "SCHEDULED"
                                ? "—"
                                : formatDuration(consult.started_at)}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <>
                                {/* Join Button */}
                                <button
                                  onClick={() => handleJoin(consult)}
                                  disabled={isJoining}
                                  className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-sm"
                                  style={{ background: "#0A6253" }}
                                  title="Join call"
                                >
                                  {/* Pulsing ring for live */}
                                  <span className="absolute inset-0 rounded-lg ring-2 ring-emerald-400/60 animate-ping opacity-50 pointer-events-none" />
                                  {isJoining ? (
                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : consult.call_type === "VIDEO" ? (
                                    <Video className="w-3.5 h-3.5" />
                                  ) : (
                                    <Phone className="w-3.5 h-3.5" />
                                  )}
                                  Join
                                </button>

                                {/* End Call Button */}
                                <button
                                  onClick={() => handleEnd(consult.id)}
                                  disabled={isEnding}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors active:scale-95 disabled:opacity-60"
                                  title="End call"
                                >
                                  {isEnding ? (
                                    <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                  ) : (
                                    <PhoneOff className="w-3.5 h-3.5" />
                                  )}
                                  End
                                </button>
                              </>
                            )}

                            {consult.status === "SCHEDULED" && (
                              <button
                                onClick={() => handleJoin(consult)}
                                disabled={isJoining}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors active:scale-95 disabled:opacity-60"
                                title="Start scheduled call"
                              >
                                {isJoining ? (
                                  <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                                ) : (
                                  <PhoneCall className="w-3.5 h-3.5" />
                                )}
                                Start
                              </button>
                            )}

                            {consult.status === "COMPLETED" && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-gray-300" />
                                Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing {filtered.length} of {consults.length} consultation
                {consults.length !== 1 ? "s" : ""}
              </span>
              <span>Auto-refreshes every 30 seconds</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
