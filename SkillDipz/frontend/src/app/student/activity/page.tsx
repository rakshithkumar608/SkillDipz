"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import {
  ActivityCalendar,
  fetchActivity,
  fetchActivityCalendar,
} from "@/lib/dashboard";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Code2,
  Flame,
  Mic,
  RefreshCcw,
  Trophy,
  Wifi,
  WifiOff,
  Activity,
  Calendar,
  UserCircle,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowRightLeft,
  Terminal,
  FileText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActivityType =
  | "submission"
  | "assessment"
  | "shortlist"
  | "module"
  | "interview"
  | "project"
  | "resume";

type FilterType = ActivityType | "all" | "daily";

// Constants
const PAGE_SIZE = 20;

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "daily", label: "Daily Tasks" },
  { key: "submission", label: "Code" },
  { key: "assessment", label: "Tests" },
  { key: "resume", label: "Resume" },
  { key: "project", label: "Projects" },
  { key: "shortlist", label: "Shortlists" },
  { key: "interview", label: "Interviews" },
  { key: "module", label: "Modules" },
];

// Category-specific Heatmap colour levels (Cyan, Purple, Teal, Emerald)
const HEAT_COLORS_MAP: Record<string, string[]> = {
  all: [
    "bg-slate-800/60 border border-slate-700/30",
    "bg-emerald-950/80 border border-emerald-800/40 text-emerald-300",
    "bg-emerald-800/90 border border-emerald-600/50 text-emerald-200",
    "bg-emerald-600 border border-emerald-400/60 text-white shadow-sm shadow-emerald-600/30",
    "bg-emerald-400 border border-emerald-300 text-slate-950 shadow-md shadow-emerald-400/50 font-bold",
  ],
  submission: [
    "bg-slate-800/60 border border-slate-700/30",
    "bg-cyan-950/80 border border-cyan-800/40 text-cyan-300",
    "bg-cyan-800/90 border border-cyan-600/50 text-cyan-200",
    "bg-cyan-600 border border-cyan-400/60 text-white shadow-sm shadow-cyan-600/30",
    "bg-cyan-400 border border-cyan-300 text-slate-950 shadow-md shadow-cyan-400/50 font-bold",
  ],
  assessment: [
    "bg-slate-800/60 border border-slate-700/30",
    "bg-purple-950/80 border border-purple-800/40 text-purple-300",
    "bg-purple-800/90 border border-purple-600/50 text-purple-200",
    "bg-purple-600 border border-purple-400/60 text-white shadow-sm shadow-purple-600/30",
    "bg-purple-400 border border-purple-300 text-slate-950 shadow-md shadow-purple-400/50 font-bold",
  ],
  project: [
    "bg-slate-800/60 border border-slate-700/30",
    "bg-teal-950/80 border border-teal-800/40 text-teal-300",
    "bg-teal-800/90 border border-teal-600/50 text-teal-200",
    "bg-teal-600 border border-teal-400/60 text-white shadow-sm shadow-teal-600/30",
    "bg-teal-400 border border-teal-300 text-slate-950 shadow-md shadow-teal-400/50 font-bold",
  ],
  resume: [
    "bg-slate-800/60 border border-slate-700/30",
    "bg-sky-950/80 border border-sky-800/40 text-sky-300",
    "bg-sky-800/90 border border-sky-600/50 text-sky-200",
    "bg-sky-600 border border-sky-400/60 text-white shadow-sm shadow-sky-600/30",
    "bg-sky-400 border border-sky-300 text-slate-950 shadow-md shadow-sky-400/50 font-bold",
  ],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function heatLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildCalendarGrid(targetYear: number) {
  const weeks: { dateKey: string; date: Date }[][] = [];
  
  // Start from Sunday of the week containing Jan 1st of targetYear
  const startOfYear = new Date(targetYear, 0, 1);
  const cursor = new Date(startOfYear);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  // End on Saturday of the week containing Dec 31st of targetYear
  const endOfYear = new Date(targetYear, 11, 31);
  const endLimit = new Date(endOfYear);
  endLimit.setDate(endLimit.getDate() + (6 - endLimit.getDay()));

  while (cursor <= endLimit) {
    const week: { dateKey: string; date: Date }[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({ dateKey: toDateKey(cursor), date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildMonthLabels(
  grid: { dateKey: string; date: Date }[][],
): { month: string; colIndex: number; year: number }[] {
  const labels: { month: string; colIndex: number; year: number }[] = [];
  let lastMonth = -1;

  grid.forEach((week, i) => {
    // Check each day in the week for month transitions
    for (const { date } of week) {
      const m = date.getMonth();
      if (m !== lastMonth) {
        // Ensure month labels don't crowd each other (at least 3 columns = 39px apart)
        if (labels.length === 0 || i - labels[labels.length - 1].colIndex >= 3) {
          labels.push({ month: MONTH_LABELS[m], colIndex: i, year: date.getFullYear() });
          lastMonth = m;
        }
        break;
      }
    }
  });

  return labels;
}

// UI Helpers

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-slate-800/60 rounded-xl animate-pulse ${className ?? ""}`}
    />
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900/60 backdrop-blur-xl border border-slate-800/80
        rounded-2xl shadow-xl transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

// Activity Heatmap Component
function ActivityHeatmap({
  calendar,
  selectedYear,
  onYearChange,
  activeFilter = "all",
  activities = [],
}: {
  calendar: ActivityCalendar | null;
  selectedYear: number;
  onYearChange: (year: number) => void;
  activeFilter?: string;
  activities?: { id: string; type: string; created_at: string }[];
}) {
  const grid = useMemo(() => buildCalendarGrid(selectedYear), [selectedYear]);
  const monthLabels = useMemo(() => buildMonthLabels(grid), [grid]);

  // Compute category-specific counts or fallback to overall calendar dates
  const counts = useMemo(() => {
    if (activeFilter === "all" || !activities || activities.length === 0) {
      return calendar?.dates ?? {};
    }
    const catCounts: Record<string, number> = {};
    activities.forEach((act) => {
      if (activeFilter === "project") {
        if (act.type !== "project" && act.type !== "module") return;
      } else if (act.type !== activeFilter) {
        return;
      }
      const dKey = act.created_at.split("T")[0];
      catCounts[dKey] = (catCounts[dKey] ?? 0) + 1;
    });
    return catCounts;
  }, [calendar?.dates, activities, activeFilter]);

  const activeColors = HEAT_COLORS_MAP[activeFilter] ?? HEAT_COLORS_MAP["all"];
  const now = new Date();
  const currentActualYear = now.getFullYear();

  const availableYears = useMemo(() => {
    const startYear = 2026;
    const years: number[] = [];
    for (let y = currentActualYear; y >= startYear; y--) {
      years.push(y);
    }
    return years;
  }, [currentActualYear]);

  const filterLabel =
    activeFilter === "submission"
      ? "Coding Practice"
      : activeFilter === "assessment"
      ? "MCQ Assessment"
      : activeFilter === "project"
      ? "Projects & Modules"
      : "Overall";

  return (
    <div className="relative space-y-3">
      {/* Year & Category Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
            {selectedYear} {filterLabel} Contribution Calendar
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Year Pills */}
          {availableYears.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => onYearChange(yr)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === yr
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid Wrapper */}
      <div className="overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
        <div className="min-w-[710px] select-none">
          {/* Month labels header — JAN through DEC */}
          <div className="relative h-6 mb-2 select-none" style={{ marginLeft: "30px" }}>
            {monthLabels.map((l, i) => {
              const isCurrentMonth =
                now.getMonth() === MONTH_LABELS.indexOf(l.month) &&
                currentActualYear === l.year;

              const leftPos = l.colIndex * 13;

              return (
                <span
                  key={i}
                  className={`absolute text-[10px] uppercase tracking-wider font-bold transition-all whitespace-nowrap ${
                    isCurrentMonth
                      ? "text-emerald-400 font-extrabold"
                      : "text-slate-400"
                  }`}
                  style={{ left: `${leftPos}px` }}
                >
                  {l.month}
                </span>
              );
            })}
          </div>

          <div className="flex gap-0.5">
            {/* Day-of-week labels */}
            <div className="flex flex-col pr-2.5 pt-0.5 text-right w-[30px] shrink-0">
              {DAY_LABELS.map((d, i) => (
                <div
                  key={d}
                  className="text-[10px] text-slate-500 font-medium leading-none"
                  style={{
                    height: 11,
                    marginBottom: 2,
                    visibility: i % 2 === 1 ? "visible" : "hidden",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Columns */}
            {grid.map((week, wi) => (
              <div className="flex flex-col gap-0.5" key={wi}>
                {week.map(({ dateKey, date }) => {
                  const count = counts[dateKey] ?? 0;
                  const level = heatLevel(count);
                  const labelDate = date.toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const tooltipText =
                    count > 0
                      ? `${count} ${filterLabel.toLowerCase()} activit${count === 1 ? "y" : "ies"} on ${labelDate}`
                      : `No ${filterLabel.toLowerCase()} activity on ${labelDate}`;

                  return (
                    <div key={dateKey} className="relative group">
                      <div
                        className={`
                          w-[11px] h-[11px] rounded-[3px] cursor-pointer
                          ${activeColors[level]}
                          hover:scale-125 transition-all duration-150
                        `}
                        title={tooltipText}
                      />
                      {/* Anchored Tooltip directly over the square */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center z-40 px-2.5 py-1 bg-slate-900 border border-slate-700/90 rounded-lg text-[11px] font-semibold text-slate-100 whitespace-nowrap shadow-2xl pointer-events-none">
                        {tooltipText}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Colour scale legend */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">
            {selectedYear} {filterLabel} Contribution Heatmap
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-[11px] text-slate-400">
          <span>Less</span>
          {activeColors.map((cls, i) => (
            <div className={`w-3 h-3 rounded-[3px] ${cls}`} key={i} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 shrink-0";
  switch (type as ActivityType) {
    case "submission":
      return <Terminal className={`${cls} text-cyan-400`} />;
    case "assessment":
      return <ClipboardList className={`${cls} text-purple-400`} />;
    case "resume":
      return <FileText className={`${cls} text-sky-400`} />;
    case "shortlist":
      return <Building2 className={`${cls} text-amber-400`} />;
    case "module":
      return <BookOpen className={`${cls} text-indigo-400`} />;
    case "interview":
      return <Mic className={`${cls} text-rose-400`} />;
    case "project":
      return <CheckCircle2 className={`${cls} text-teal-400`} />;
    default:
      return <Circle className={`${cls} text-slate-500`} />;
  }
}

function TypeBadge({ type, title }: { type: string; title?: string }) {
  if (title?.startsWith("Daily Task")) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px]
          font-extrabold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10"
      >
        ⚡ Daily Task
      </span>
    );
  }

  const styles: Record<ActivityType, string> = {
    submission: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10",
    assessment: "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10",
    resume: "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/10",
    shortlist: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    module: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    interview: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    project: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  };
  const labels: Record<ActivityType, string> = {
    submission: "Coding Practice",
    assessment: "MCQ Assessment",
    resume: "Resume & Profile",
    shortlist: "Shortlist",
    module: "Module",
    interview: "Interview",
    project: "Project",
  };
  const style =
    styles[type as ActivityType] ??
    "bg-slate-700/50 text-slate-400 border-slate-600/30";
  const text = labels[type as ActivityType] ?? type;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px]
        font-bold tracking-wide border ${style}`}
    >
      {text}
    </span>
  );
}

function ActivityRow({
  item,
}: {
  item: {
    id: string;
    type: string;
    title: string;
    detail: string;
    created_at: string;
  };
}) {
  const borderAccents: Record<string, string> = {
    submission: "border-l-4 border-l-cyan-400",
    assessment: "border-l-4 border-l-purple-400",
    resume: "border-l-4 border-l-sky-400",
    shortlist: "border-l-4 border-l-amber-400",
    module: "border-l-4 border-l-indigo-400",
    interview: "border-l-4 border-l-rose-400",
    project: "border-l-4 border-l-teal-400",
  };
  const accent = borderAccents[item.type] ?? "border-l-4 border-l-slate-600";

  return (
    <li
      className={`flex items-start gap-3.5 p-3.5 rounded-xl
      bg-slate-950/60 border border-slate-800/60
      hover:bg-slate-900 hover:border-slate-700/80
      transition-all duration-150 group ${accent}`}
    >
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center
        rounded-xl bg-slate-900 border border-slate-800 shadow-inner"
      >
        <ActivityIcon type={item.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
            {item.title}
          </span>
          <TypeBadge type={item.type} title={item.title} />
        </div>
        <p className="text-xs text-slate-400 font-sans leading-relaxed">
          {item.detail}
        </p>
        <p className="text-[10px] text-slate-500 font-mono mt-1">
          {new Date(item.created_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    </li>
  );
}

export default function ActivityPage() {
  const { user } = useAuthStore();
  const { activity, setActivity } = useDashboardStore();
  const { isConnected } = useWebSocket(user?.id);

  const [calendar, setCalendar] = useState<ActivityCalendar | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const [acts, cal] = await Promise.all([
        fetchActivity(PAGE_SIZE, 1),
        fetchActivityCalendar(),
      ]);
      setActivity(acts);
      setCalendar(cal);
      setPage(1);
      setHasMore(acts.length === PAGE_SIZE);
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message : "Failed to load activity calendar.";
      toast.error(m);
    } finally {
      setIsLoading(false);
    }
  }, [setActivity]);

  useEffect(() => {
    loadInitial();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [acts, cal] = await Promise.all([
        fetchActivity(PAGE_SIZE, 1),
        fetchActivityCalendar(),
      ]);
      setActivity(acts);
      setCalendar(cal);
      setPage(1);
      setHasMore(acts.length === PAGE_SIZE);
      toast.success("Activity feed refreshed!");
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Failed to refresh";
      toast.error(m);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const more = await fetchActivity(PAGE_SIZE, nextPage);
      setActivity([...activity, ...more]);
      setPage(nextPage);
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  };

  const displayed = useMemo(() => {
    if (filter === "all") return activity;
    if (filter === "daily") {
      return activity.filter((a) => a.title.startsWith("Daily Task"));
    }
    if (filter === "submission") {
      return activity.filter(
        (a) =>
          a.type === "submission" &&
          !a.title.toLowerCase().includes("resume") &&
          !a.title.toLowerCase().includes("parsed")
      );
    }
    if (filter === "resume") {
      return activity.filter(
        (a) =>
          a.type === "resume" ||
          a.title.toLowerCase().includes("resume") ||
          a.title.toLowerCase().includes("parsed")
      );
    }
    return activity.filter((a) => a.type === filter);
  }, [activity, filter]);

  // Compute Current Month & Yearly Month Breakdown
  const now = new Date();
  const currentActualYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentMonthPrefix = `${currentActualYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
  const currentMonthName = MONTH_LABELS[currentMonthIdx];

  const currentMonthCount = Object.entries(calendar?.dates ?? {}).reduce(
    (acc, [dateStr, count]) => {
      return dateStr.startsWith(currentMonthPrefix) ? acc + count : acc;
    },
    0,
  );

  const codingCount = useMemo(
    () =>
      activity.filter(
        (a) =>
          a.type === "submission" &&
          !a.title.toLowerCase().includes("resume") &&
          !a.title.toLowerCase().includes("parsed")
      ).length,
    [activity],
  );
  const mcqCount = useMemo(
    () => activity.filter((a) => a.type === "assessment").length,
    [activity],
  );
  const projectCount = useMemo(
    () => activity.filter((a) => a.type === "project" || a.type === "module").length,
    [activity],
  );
  const dailyTaskCount = useMemo(
    () => activity.filter((a) => a.title.startsWith("Daily Task")).length,
    [activity],
  );

  const yearlyMonthBreakdown = useMemo(() => {
    const dates = calendar?.dates ?? {};
    return MONTH_LABELS.map((mName, idx) => {
      const mStr = String(idx + 1).padStart(2, "0");
      const prefix = `${selectedYear}-${mStr}`;
      const count = Object.entries(dates).reduce((sum, [dStr, c]) => {
        return dStr.startsWith(prefix) ? sum + c : sum;
      }, 0);

      const isCurrentMonth = idx === currentMonthIdx && selectedYear === currentActualYear;
      return {
        monthName: mName,
        monthNum: idx + 1,
        year: selectedYear,
        count,
        isCurrentMonth,
      };
    });
  }, [calendar?.dates, selectedYear, currentMonthIdx, currentActualYear]);

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 lg:px-8 lg:py-8 w-full max-w-7xl mx-auto space-y-5 text-slate-200">
      
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            My Activity
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
            Track your streak, code submissions, assessments &amp; milestones
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400"
            }`}
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>{isConnected ? "Live" : "Offline"}</span>
          </div>

          {/* Streak pill header */}
          {calendar && calendar.current_streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-amber-400">
                {calendar.current_streak}d Streak
              </span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl
              bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60
              text-xs font-semibold text-slate-200 transition-all shadow-sm
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Heatmap & Streak Cards Section */}
      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <Card className="p-4 sm:p-6 space-y-5">
          {/* Responsive 4-Stat Grid: 2 columns on mobile, 4 columns on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-800/60 pb-4">
            
            {/* Stat 1: Current Streak */}
            <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
              <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Streak
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">
                {calendar?.current_streak ?? 0}
                <span className="text-xs font-medium text-slate-400 ml-1">days</span>
              </span>
            </div>

            {/* Stat 2: Best Streak */}
            <div className="bg-slate-950/60 border border-purple-500/20 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all" />
              <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Best Streak
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-400 tabular-nums">
                {calendar?.longest_streak ?? 0}
                <span className="text-xs font-medium text-slate-400 ml-1">days</span>
              </span>
            </div>

            {/* Stat 3: Current Month Activities (Highlighted) */}
            <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-14 h-14 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  {currentMonthName} {currentActualYear}
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
                {currentMonthCount}
                <span className="text-xs font-medium text-slate-400 ml-1">activities</span>
              </span>
            </div>

            {/* Stat 4: Last Active */}
            <div className="bg-slate-950/60 border border-sky-500/20 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-sky-500/5 rounded-full blur-xl group-hover:bg-sky-500/10 transition-all" />
              <div className="flex items-center gap-1.5 text-sky-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Last Active
                </span>
              </div>
              <span className="text-sm sm:text-base font-bold text-sky-400 tabular-nums my-auto">
                {calendar?.last_active
                  ? new Date(calendar.last_active).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Never"}
              </span>
            </div>

          </div>

          {/* 12-Month Year Breakdown Bar */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {selectedYear} Monthly Activity Breakdown
              </span>
              <span className="text-[11px] text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-sm">
                Active Year: {selectedYear}
              </span>
            </div>

            {/* 12 Month Grid / Pills */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {yearlyMonthBreakdown.map((m) => (
                <div
                  key={m.monthName}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all duration-200 ${
                    m.isCurrentMonth
                      ? "bg-emerald-500/20 border-emerald-400/80 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/50 scale-[1.04] z-10"
                      : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700/60"
                  }`}
                >
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider ${
                      m.isCurrentMonth ? "text-emerald-300" : "text-slate-400"
                    }`}
                  >
                    {m.monthName}
                  </span>
                  <span
                    className={`text-xs font-bold mt-0.5 tabular-nums ${
                      m.isCurrentMonth
                        ? "text-emerald-200"
                        : m.count > 0
                        ? "text-slate-200"
                        : "text-slate-500"
                    }`}
                  >
                    {m.count}
                  </span>
                  {m.isCurrentMonth && (
                    <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-tighter mt-0.5">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* LeetCode Contribution Heatmap Grid */}
          <ActivityHeatmap
            calendar={calendar}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            activeFilter={filter}
            activities={activity}
          />
        </Card>
      )}

      {/* Category-Specific Streak & Activity Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Coding Practice Card (Cyan) */}
        <button
          onClick={() => setFilter("submission")}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 backdrop-blur-xl relative overflow-hidden group ${
            filter === "submission"
              ? "bg-cyan-950/60 border-cyan-500/50 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
              : "bg-slate-900/60 border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Terminal className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-200">Coding Practice</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Code
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div>
              <span className="text-2xl font-extrabold text-cyan-400 font-mono">{codingCount}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">solved</span>
            </div>
            <span className="text-[11px] text-cyan-300 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View →
            </span>
          </div>
        </button>

        {/* MCQ Assessment Card (Purple) */}
        <button
          onClick={() => setFilter("assessment")}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 backdrop-blur-xl relative overflow-hidden group ${
            filter === "assessment"
              ? "bg-purple-950/60 border-purple-500/50 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30"
              : "bg-slate-900/60 border-slate-800 hover:border-purple-500/30 hover:bg-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <ClipboardList className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-200">MCQ Assessments</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              MCQ
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div>
              <span className="text-2xl font-extrabold text-purple-400 font-mono">{mcqCount}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">completed</span>
            </div>
            <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View →
            </span>
          </div>
        </button>

        {/* Projects & Learning Card (Teal) */}
        <button
          onClick={() => setFilter("project")}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 backdrop-blur-xl relative overflow-hidden group ${
            filter === "project"
              ? "bg-teal-950/60 border-teal-500/50 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/30"
              : "bg-slate-900/60 border-slate-800 hover:border-teal-500/30 hover:bg-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-200">Projects & Learning</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Projects
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div>
              <span className="text-2xl font-extrabold text-teal-400 font-mono">{projectCount}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">projects & modules</span>
            </div>
            <span className="text-[11px] text-teal-300 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View →
            </span>
          </div>
        </button>

        {/* Daily Assignments Card (Amber) — NEW */}
        <button
          onClick={() => setFilter("daily")}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 backdrop-blur-xl relative overflow-hidden group ${
            filter === "daily"
              ? "bg-amber-950/60 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
              : "bg-slate-900/60 border-slate-800 hover:border-amber-500/30 hover:bg-slate-800/80"
          }`}
        >
          <div className="absolute top-0 right-0 w-14 h-14 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-200">Daily Assignments</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ⚡ Daily
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <div>
              <span className="text-2xl font-extrabold text-amber-400 font-mono">{dailyTaskCount}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">tasks done</span>
            </div>
            <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View →
            </span>
          </div>
          {dailyTaskCount > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-400 font-bold">
                {calendar?.current_streak ?? 0}d streak
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Horizontal Scrollable Filter Chips for Mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x flex-nowrap sm:flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 snap-start
                border transition-all duration-150 shadow-sm ${
                  isActive
                    ? "bg-sky-500 text-white border-sky-400 shadow-sky-500/20"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Activity Feed Section */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Activity Stream
            </h2>
          </div>
          {!isLoading && (
            <span className="text-xs font-semibold text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/50">
              {displayed.length} item{displayed.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Skeleton State */}
        {isLoading && (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-16 w-full" />
              </li>
            ))}
          </ul>
        )}

        {/* Empty State */}
        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 shadow-inner">
              <UserCircle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">No activity logged yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                {filter === "all"
                  ? "Complete quizzes, submit code, or finish projects to build your real-time activity stream."
                  : `No "${filter}" activities found. Try selecting another filter above.`}
              </p>
            </div>
          </div>
        )}

        {/* Rows */}
        {!isLoading && displayed.length > 0 && (
          <ul className="space-y-2.5">
            {displayed.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {/* Load More Button */}
        {!isLoading && hasMore && filter === "all" && (
          <div className="pt-3 flex justify-center border-t border-slate-800/40">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl
                bg-slate-800 hover:bg-slate-700/80 border border-slate-700/70
                text-xs font-bold text-slate-200 transition-all shadow-md
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <span>{isLoadingMore ? "Loading activity..." : "Load More Activity"}</span>
            </button>
          </div>
        )}

        {!isLoading && !hasMore && displayed.length > 0 && filter === "all" && (
          <p className="text-center text-[11px] text-slate-500 pt-3 font-semibold tracking-wider uppercase">
            • End of Activity History •
          </p>
        )}
      </Card>
    </div>
  );
}

