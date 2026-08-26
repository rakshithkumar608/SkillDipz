"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  fetchScore,
  fetchRoadmapSummary,
  fetchNotifications,
  fetchActivity,
  fetchStreak,
  markAllNotificationsRead,
  uploadResume,
} from "@/lib/dashboard";
import { ScoreGauge } from "@/components/student/ScoreGauge";
import { CircularScoreRing } from "@/components/common/CircularScoreRing";
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Code2,
  FileCheck,
  Flame,
  Loader2,
  Map,
  Mic,
  Search,
  TrendingUp,
  Upload,
  UserCircle,
  Wifi,
  WifiOff,
} from "lucide-react";


// ─── Helpers 

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

import { formatTimeAgo } from "@/lib/dateUtils";

function timeAgo(iso: string): string {
  return formatTimeAgo(iso);
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  switch (type) {
    case "submission":  return <Code2        className={`${cls} text-emerald-400`} />;
    case "assessment":  return <ClipboardList className={`${cls} text-sky-400`} />;
    case "shortlist":   return <Building2    className={`${cls} text-purple-400`} />;
    case "module":      return <BookOpen     className={`${cls} text-amber-400`} />;
    case "interview":   return <UserCircle   className={`${cls} text-rose-400`} />;
    case "project":     return <CheckCircle2 className={`${cls} text-teal-400`} />;
    default:            return <Circle       className={`${cls} text-slate-500`} />;
  }
}

const SCORE_LABELS: Record<
  string,
  {
    label: string;
    weight: string;
    href: string;
    color: string;
    gradient: [string, string];
    hint: string;
  }
> = {
  resume_quality: {
    label: "Resume Quality",
    weight: "15%",
    href: "/student/profile",
    color: "text-amber-400",
    gradient: ["#f59e0b", "#fbbf24"],
    hint: "Profile completeness & verified resume",
  },
  skill_tests: {
    label: "Skill Tests & Practice",
    weight: "35%",
    href: "/student/practice",
    color: "text-sky-400",
    gradient: ["#0284c7", "#6366f1"],
    hint: "MCQ assessments & coding arena solves",
  },
  learning_roadmap: {
    label: "Learning Roadmap",
    weight: "20%",
    href: "/student/roadmap",
    color: "text-emerald-400",
    gradient: ["#059669", "#34d399"],
    hint: "Curriculum progression & completed skills",
  },
  project_strength: {
    label: "Projects",
    weight: "15%",
    href: "/student/projects",
    color: "text-teal-400",
    gradient: ["#0d9488", "#2dd4bf"],
    hint: "Evaluated repo submissions & NLP scores",
  },
  activity_consistency: {
    label: "Consistency",
    weight: "15%",
    href: "/student/activity",
    color: "text-rose-400",
    gradient: ["#e11d48", "#fb7185"],
    hint: "Daily activity streak & active frequency",
  },
};

// ─── Skeleton 

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-800/60 rounded-xl animate-pulse ${className}`} />;
}

// ─── Card wrapper

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0b0f19]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-2xl transition-all duration-200 hover:border-slate-700/60 ${className}`}>
      {children}
    </div>
  );
}

// ─── Upload state 

type UploadStatus = "idle" | "uploading" | "success" | "error";

// ─── Page 

export default function OverviewPage() {
  const { user } = useAuthStore();
  const {
    score, roadmapSummary, notifications, unreadCount,
    activity, streak, isLoading, error,
    setScore, setRoadmapSummary, setNotifications,
    setActivity, setStreak, setLoading, setError, markAllRead,
  } = useDashboardStore();

  const { isConnected } = useWebSocket(user?.id);

  // ─── Resume upload state 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, r, n, a, st] = await Promise.all([
          fetchScore(),
          fetchRoadmapSummary(),
          fetchNotifications(),
          fetchActivity(5),
          fetchStreak(),
        ]);
        setScore(s);
        setRoadmapSummary(r);
        setNotifications(n.items, n.unread_count);
        setActivity(a);
        setStreak(st);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllRead = async () => {
    markAllRead();
    await markAllNotificationsRead();
  };

  // ─── Resume upload handlers
  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF or Word documents are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5 MB.");
      return;
    }

    setUploadStatus("uploading");
    setUploadError(null);
    try {
      await uploadResume(file);
      const r = await fetchRoadmapSummary();
      setRoadmapSummary(r);
      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 3000);
    } catch (err: unknown) {
      setUploadStatus("error");
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setTimeout(() => setUploadStatus("idle"), 4000);
    }
  };

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const uploadBtnLabel: Record<UploadStatus, string> = {
    idle:      "Upload Resume",
    uploading: "Uploading…",
    success:   "Uploaded ✓",
    error:     "Try Again",
  };

  const uploadBtnClass = [
    "flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-200 focus:outline-none",
    uploadStatus === "success"
      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
      : uploadStatus === "error"
      ? "bg-red-500/20 border-red-500/40 text-red-400"
      : "bg-emerald-400 hover:bg-emerald-300 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20 font-bold",
  ].join(" ");

  const totalSkills = roadmapSummary?.total_skills ?? 0;
  const completedSkills = roadmapSummary?.completed_skills ?? 0;
  const remainingGaps = Math.max(0, totalSkills - completedSkills);
  const targetRole = roadmapSummary?.role || score?.target_role || "Target Role Not Set";

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto space-y-6 text-slate-200">

      {/* ── Header  */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric",
              month: "long", day: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {streak && streak.current_streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">
                {streak.current_streak}d streak
              </span>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isConnected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400"
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isConnected ? "Live" : "Offline"}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            id="upload-resume-btn"
            onClick={handleUploadClick}
            disabled={uploadStatus === "uploading"}
            className={uploadBtnClass}
          >
            {uploadStatus === "uploading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{uploadBtnLabel[uploadStatus]}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Top Metric Cards Grid (100% Real-Time Backend Data) ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Employability Score / Match Index */}
        <Card className="flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                {score?.overall_score ?? 0}%
              </span>
            )}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">
            STANDARD MATCH INDEX
          </span>
        </Card>

        {/* Card 2: Skill Milestones Passed */}
        <Card className="flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <span className="text-3xl sm:text-4xl font-extrabold text-blue-400 tracking-tight">
                {completedSkills}
              </span>
            )}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300">
              <FileCheck className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">
            SKILL MILESTONES PASSED
          </span>
        </Card>

        {/* Card 3: Current Streak — live from /students/me/streak */}
        <Card className="flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
          <div className="flex items-start justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="flex flex-col">
                <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight">
                  {streak?.current_streak ?? 0}
                  <span className="text-base font-medium text-slate-500 ml-1">days</span>
                </span>
                {streak && streak.longest_streak > 0 && (
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Best: {streak.longest_streak}d
                  </span>
                )}
              </div>
            )}
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Flame className={`w-4 h-4 text-amber-400 ${(streak?.current_streak ?? 0) > 0 ? "animate-pulse" : ""}`} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              CURRENT STREAK
            </span>
            <Link
              href="/student/activity"
              className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold transition-colors"
            >
              View →
            </Link>
          </div>
        </Card>

        {/* Card 4: In-Demand Gaps Remaining */}
        <Card className="flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="flex flex-col">
                <span className="text-3xl sm:text-4xl font-extrabold text-rose-400 tracking-tight">
                  {remainingGaps}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  of {totalSkills} total
                </span>
              </div>
            )}
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">
            IN-DEMAND GAPS REMAINING
          </span>
        </Card>

      </div>


      {/* ── Main Section: Skill Indices & Target Placement Goal ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Left: Real Score Components Breakdown */}
        <Card className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <h2 className="text-sm font-bold text-white tracking-wide">Skill Indices Check</h2>
                <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50 font-medium">
                  5 Real-time Metrics
                </span>
              </div>
              {score?.last_updated && (
                <span className="text-xs text-slate-400">Updated {timeAgo(score.last_updated)}</span>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/40">
                    <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : score ? (
              <div className="space-y-2.5">
                {Object.entries(SCORE_LABELS).map(([key, meta]) => {
                  const val = score.components[key as keyof typeof score.components] ?? 0;
                  return (
                    <Link
                      key={key}
                      href={meta.href}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700/80 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <CircularScoreRing
                          value={val}
                          gradientId={`ring-overview-${key}`}
                          colorGradient={meta.gradient}
                          size={46}
                          strokeWidth={4}
                          textColor={meta.color}
                          showDecimal={true}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-800/90 px-2 py-0.5 rounded-full border border-slate-700/50 font-medium shrink-0">
                              {meta.weight}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {meta.hint}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 shrink-0 text-slate-500 group-hover:text-emerald-400 transition-colors">
                        <span className="text-xs font-semibold hidden sm:inline">Open</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {!isLoading && score?.is_empty && (
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-slate-400 text-center">
              Complete your first skill test, coding challenge, or project to begin raising your skill indices.
            </div>
          )}
        </Card>

        {/* Right: Real Target Placement Goal & Score Gauge */}
        <Card className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <h2 className="text-sm font-bold text-white tracking-wide">Target Placement Goal</h2>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                {score && score.overall_score >= 75 ? "Placement Ready" : "In Progress"}
              </span>
            </div>

            {/* Target Role Box */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-white">
                  {targetRole}
                </span>
              </div>
              {roadmapSummary?.next_skill && (
                <p className="text-xs text-emerald-400 font-medium">
                  Up next skill: <span className="text-white">{roadmapSummary.next_skill}</span>
                </p>
              )}
              {!roadmapSummary?.resume_uploaded && (
                <p className="text-xs text-slate-400 italic">
                  Upload your resume to calculate your target role gaps.
                </p>
              )}
            </div>

            {/* Gauge Center Representation */}
            <div className="flex flex-col items-center justify-center py-1">
              <ScoreGauge score={score?.overall_score ?? 0} isLoading={isLoading} />
              <p className="text-[11px] text-slate-400 text-center mt-1">
                Weighted calculation across 5 real-time skill performance indices
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <Link
              href="/student/skill-gap"
              className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-semibold rounded-xl transition-all"
            >
              <Search className="w-4 h-4 text-sky-400" />
              Gap Analysis
            </Link>
            <Link
              href="/student/practice"
              className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-400/20"
            >
              <Code2 className="w-4 h-4" />
              Skill Tests & Practice
            </Link>
          </div>
        </Card>

      </div>

      {/* ── Lower Section: Learning Roadmap & Recent Activity ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Roadmap Summary */}
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Map className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white">Learning Roadmap</h2>
            </div>
            <Link
              href="/student/roadmap"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !roadmapSummary?.resume_uploaded ? (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">Upload your resume to start</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate your custom learning roadmap tailored to target role requirements.
                </p>
              </div>
              <button
                onClick={handleUploadClick}
                className="px-4 py-2 bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl hover:bg-emerald-300 transition-all shrink-0"
              >
                Upload Resume
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  {completedSkills} of {totalSkills} skills completed ({roadmapSummary.progress_pct}%)
                </p>
                {roadmapSummary.next_skill && (
                  <p className="text-xs text-emerald-400 font-medium">
                    Up next: {roadmapSummary.next_skill}
                  </p>
                )}
              </div>
              <Link
                href="/student/roadmap"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-all"
              >
                Continue →
              </Link>
            </div>
          )}
        </Card>

        {/* Notifications / Activity */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white">Recent Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <BellOff className="w-3 h-3" /> Read all
              </button>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : notifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No notifications yet</p>
          ) : (
            <ul className="space-y-2.5">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/40 text-xs flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{n.title}</p>
                    <p className="text-slate-400 truncate mt-0.5">{n.body}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>

    </div>
  );
}