"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  getCompanyInterviews,
  type CompanyInterviewSession,
} from "@/lib/interviewApi";
import {
  Calendar,
  Clock,
  Video,
  User,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Briefcase,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function statusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        cls: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      };
    case "waiting":
      return {
        label: "Waiting (Joinable)",
        cls: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
      };
    case "in_progress":
      return {
        label: "In Progress",
        cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      };
    case "completed":
      return {
        label: "Completed",
        cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
      };
    case "terminated":
      return {
        label: "Terminated (Violation)",
        cls: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        cls: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      };
    default:
      return {
        label: status,
        cls: "bg-slate-800 text-slate-300 border-white/10",
      };
  }
}

export default function CompanyInterviewsPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const [sessions, setSessions] = useState<CompanyInterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "scheduled" | "completed" | "terminated"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanyInterviews();
      setSessions(data.sessions ?? []);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to load scheduled interviews.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (_hasHydrated && user?.role === "COMPANY") {
      loadInterviews();
    }
  }, [_hasHydrated, user, loadInterviews]);

  const filteredSessions = sessions.filter((s) => {
    if (activeFilter === "scheduled" && s.status !== "scheduled" && s.status !== "waiting") {
      return false;
    }
    if (activeFilter === "completed" && s.status !== "completed") {
      return false;
    }
    if (activeFilter === "terminated" && s.status !== "terminated") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (s.student_name || "").toLowerCase().includes(q);
      const matchEmail = (s.student_email || "").toLowerCase().includes(q);
      const matchCollege = (s.student_college || "").toLowerCase().includes(q);
      const matchRole = (s.target_role || "").toLowerCase().includes(q);
      return matchName || matchEmail || matchCollege || matchRole;
    }
    return true;
  });

  // Hydration Skeleton 
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-6xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/10">
            <Video className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Company Interview Requests
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time directory of all scheduled candidate interviews, meeting links, and proctoring status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadInterviews}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/company/browse"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
          >
            <Users className="w-3.5 h-3.5" />
            Schedule More Candidates
          </Link>
        </div>
      </div>

      {/* 2. Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-white/10 w-fit">
          {[
            { key: "all", label: `All (${sessions.length})` },
            {
              key: "scheduled",
              label: `Scheduled (${
                sessions.filter((s) => s.status === "scheduled" || s.status === "waiting").length
              })`,
            },
            {
              key: "completed",
              label: `Completed (${sessions.filter((s) => s.status === "completed").length})`,
            },
            {
              key: "terminated",
              label: `Terminated (${sessions.filter((s) => s.status === "terminated").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === tab.key
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, role, college..."
            className="w-full bg-[#0e1117] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadInterviews}
            className="text-xs font-semibold underline hover:text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. List Content */}
      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
          <p className="text-xs text-slate-400">Loading interview requests…</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl bg-slate-900/40 border border-white/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            {searchQuery
              ? `No interviews matching "${searchQuery}"`
              : "No Interview Requests Yet"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When you schedule an interview with candidates from Browse Candidates or Student Database, the requests will appear here in real time.
          </p>
          <Link
            href="/company/browse"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white transition-colors mt-2"
          >
            Browse Candidates
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((session) => {
            const badge = statusBadge(session.status);
            const scheduledDate = session.scheduled_at
              ? new Date(session.scheduled_at)
              : null;

            return (
              <div
                key={session.session_id}
                className="p-5 rounded-2xl bg-[#0e1117] border border-white/10 hover:border-sky-500/30 transition-all space-y-4 shadow-lg shadow-black/20"
              >
                {/* Top: Candidate info & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {session.student_name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {session.student_college || session.student_email || "Student Candidate"}
                    </p>
                    {session.target_role && (
                      <span className="inline-block mt-1 text-[11px] font-semibold text-sky-400">
                        {session.target_role}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shrink-0 ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Round Type
                    </span>
                    <span className="font-semibold text-slate-200 capitalize">
                      {session.interview_type} Round
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Duration
                    </span>
                    <span className="font-semibold text-slate-200">
                      {session.duration_mins} Minutes
                    </span>
                  </div>

                  <div className="col-span-2 space-y-1 pt-1 border-t border-white/5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Date & Time
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        {scheduledDate
                          ? scheduledDate.toLocaleString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "TBD"}
                      </span>
                    </div>
                  </div>

                  {session.interviewer_name && (
                    <div className="col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Interviewer
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{session.interviewer_name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action / Link */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  {session.video_call_url ? (
                    <a
                      href={session.video_call_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Open Meeting Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      SkillDipz Proctored Room
                    </span>
                  )}

                  {session.overall_score != null && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400">
                        Score: {session.overall_score}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
