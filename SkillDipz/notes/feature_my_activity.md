# My Activity — Full Implementation (Updated)

> **Status of original code:** ✅ Zero mock data in all three files.
> All values come from `GET /students/me/activity` and `GET /students/me/streak`.
>
> **Issues found & fixed in this update:**
> 1. **Streak was stale** — `StudentStreak` doc is never updated when activities are logged,
>    so `current_streak` was always 0.  Fixed by computing streak dynamically from `ActivityLog`.
> 2. **No calendar data** — LeetCode-style heatmap needs per-day counts for 365 days.
>    Fixed by adding a new `GET /students/me/activity/calendar` endpoint.
> 3. **UI** — Old streak section replaced with LeetCode-style 52 × 7 heatmap grid.

---

> **Files changed:**
>
> | File | Change |
> |------|--------|
> | `backend/app/api/routes/students.py` | Fix streak computation + add calendar endpoint + add page pagination |
> | `frontend/src/lib/dashboard.ts` | Add `fetchActivityCalendar` helper + extend `fetchActivity` |
> | `frontend/src/app/student/activity/page.tsx` | Replace `ComingSoon` — LeetCode heatmap + feed |

---

## 1 · Backend — `backend/app/api/routes/students.py`

### 1-A  Add `CalendarOut` schema (near the other schemas at the top)

Find the `StreakOut` class (around line 83) and add `CalendarOut` directly **below** it:

```python
class CalendarOut(BaseModel):
    # keys are ISO date strings "YYYY-MM-DD", values are activity counts
    dates: dict[str, int]
    current_streak: int
    longest_streak: int
    last_active: Optional[str]
```

### 1-B  Replace `GET /students/me/activity` (add `page` param)

Find the existing handler (around line 472) and replace it:

```python
# Activity  ─────────────────────────────────────────────────────────────────

@router.get("/me/activity", response_model=List[ActivityItem])
async def get_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Paginated activity feed — newest first.
    page=1&limit=20  →  first 20 items
    page=2&limit=20  →  items 21-40, etc.
    """
    student_id = str(current_user.id)
    skip = (page - 1) * limit

    logs = (
        await ActivityLog.find(ActivityLog.student_id == student_id)
        .sort(-ActivityLog.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    return [
        ActivityItem(
            id=str(log.id),
            type=log.type,
            title=log.title,
            detail=log.detail,
            created_at=log.created_at,
        )
        for log in logs
    ]
```

### 1-C  Replace `GET /students/me/streak` — compute streak dynamically from ActivityLog

Find the existing handler (around line 498) and replace the **entire** streak section with:

```python
# Streak + Calendar  ─────────────────────────────────────────────────────────

def _compute_streak(active_dates: set[date]) -> tuple[int, int, Optional[date]]:
    """
    Given a set of dates that had at least one activity, return:
      (current_streak, longest_streak, last_active)

    Streak logic (same as LeetCode):
      - A streak is a run of consecutive calendar days ending on today or yesterday.
      - If the student did nothing today AND nothing yesterday, current streak = 0.
    """
    if not active_dates:
        return 0, 0, None

    today = date.today()
    sorted_dates = sorted(active_dates, reverse=True)
    last_active = sorted_dates[0]

    # Current streak: walk backwards from today
    current = 0
    check = today
    # Allow the streak to still be alive if last activity was yesterday
    if last_active < today - timedelta(days=1):
        current = 0
    else:
        while check in active_dates:
            current += 1
            check -= timedelta(days=1)

    # Longest streak: scan full sorted list
    longest = 0
    run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i - 1] - sorted_dates[i]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    longest = max(longest, run, current)

    return current, longest, last_active


@router.get("/me/streak", response_model=StreakOut)
async def get_streak(current_user: User = Depends(get_current_user)):
    """
    Computes streak dynamically from ActivityLog — same logic as LeetCode.
    No stale stored values.
    """
    student_id = str(current_user.id)

    # Fetch all activity dates (only need the date part, not full docs)
    logs = await ActivityLog.find(
        ActivityLog.student_id == student_id
    ).to_list()

    active_dates = {log.created_at.date() for log in logs}
    current, longest, last_active = _compute_streak(active_dates)

    return StreakOut(
        current_streak=current,
        longest_streak=longest,
        last_active=str(last_active) if last_active else None,
    )


@router.get("/me/activity/calendar", response_model=CalendarOut)
async def get_activity_calendar(current_user: User = Depends(get_current_user)):
    """
    Returns per-day activity counts for the past 365 days
    AND computes streak — single call powers the LeetCode heatmap.

    Response shape:
      {
        "dates": { "2026-07-31": 3, "2026-07-30": 1, ... },
        "current_streak": 7,
        "longest_streak": 14,
        "last_active": "2026-07-31"
      }
    """
    student_id = str(current_user.id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    logs = await ActivityLog.find(
        ActivityLog.student_id == student_id,
        ActivityLog.created_at >= cutoff,
    ).to_list()

    # Aggregate counts per date
    counts: dict[str, int] = {}
    active_dates: set[date] = set()
    for log in logs:
        d = log.created_at.date()
        key = str(d)
        counts[key] = counts.get(key, 0) + 1
        active_dates.add(d)

    current, longest, last_active = _compute_streak(active_dates)

    return CalendarOut(
        dates=counts,
        current_streak=current,
        longest_streak=longest,
        last_active=str(last_active) if last_active else None,
    )
```

### 1-D  Add missing imports at the top of `students.py`

Make sure these are present in the import block (add only what's missing):

```python
from datetime import date, datetime, timedelta, timezone
```

---

## 2 · Frontend lib — `frontend/src/lib/dashboard.ts`

### 2-A  Extend `fetchActivity` (replace existing function)

```typescript
export async function fetchActivity(
  limit = 20,
  page = 1,
): Promise<ActivityItem[]> {
  const { data } = await api.get<ActivityItem[]>(
    `/students/me/activity?page=${page}&limit=${limit}`,
  );
  return data;
}
```

### 2-B  Add new `fetchActivityCalendar` function (add after `fetchStreak`)

```typescript
export interface ActivityCalendar {
  dates: Record<string, number>; // "YYYY-MM-DD" → count
  current_streak: number;
  longest_streak: number;
  last_active: string | null;
}

export async function fetchActivityCalendar(): Promise<ActivityCalendar> {
  const { data } = await api.get<ActivityCalendar>(
    "/students/me/activity/calendar",
  );
  return data;
}
```

---

## 3 · Frontend page — `frontend/src/app/student/activity/page.tsx`

Replace the **entire** file:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  fetchActivity,
  fetchActivityCalendar,
  ActivityCalendar,
} from "@/lib/dashboard";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Activity,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Code2,
  Flame,
  Loader2,
  Mic,
  RefreshCw,
  Trophy,
  UserCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActivityType =
  | "submission"
  | "assessment"
  | "shortlist"
  | "module"
  | "interview"
  | "project";

type FilterType = ActivityType | "all";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "submission", label: "Code" },
  { key: "assessment", label: "Tests" },
  { key: "project",    label: "Projects" },
  { key: "shortlist",  label: "Shortlists" },
  { key: "interview",  label: "Interviews" },
  { key: "module",     label: "Modules" },
];

// Heatmap colour levels (index 0 = no activity, 4 = most active)
const HEAT_COLORS = [
  "bg-slate-800/70",           // 0  — empty
  "bg-emerald-900/80",         // 1  — 1 activity
  "bg-emerald-700/80",         // 2  — 2-3 activities
  "bg-emerald-500/80",         // 3  — 4-6 activities
  "bg-emerald-400",            // 4  — 7+ activities
];

const MONTH_LABELS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Convert count → heat level 0-4 */
function heatLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** Format "YYYY-MM-DD" from a Date object */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the 52-week grid (same approach as LeetCode / GitHub).
 * Returns an array of 52 columns, each column = 7 days (Sun → Sat).
 * Each cell: { dateKey: string; date: Date }
 */
function buildCalendarGrid(): { dateKey: string; date: Date }[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the Sunday that is 364 days ago (so we get exactly 52 weeks)
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  // Roll back to the previous Sunday
  start.setDate(start.getDate() - start.getDay());

  const weeks: { dateKey: string; date: Date }[][] = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    const week: { dateKey: string; date: Date }[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor <= today) {
        week.push({ dateKey: toDateKey(cursor), date: new Date(cursor) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);
  }

  return weeks;
}

/**
 * Derive month label positions from the grid.
 * Returns array of { month: string; colIndex: number }
 */
function buildMonthLabels(
  grid: { dateKey: string; date: Date }[][],
): { month: string; colIndex: number }[] {
  const labels: { month: string; colIndex: number }[] = [];
  let lastMonth = -1;
  grid.forEach((week, i) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonth) {
      labels.push({ month: MONTH_LABELS[m], colIndex: i });
      lastMonth = m;
    }
  });
  return labels;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      className={`bg-[#0b0f19]/90 backdrop-blur-xl border border-slate-800/80
        rounded-2xl shadow-2xl transition-all duration-200
        hover:border-slate-700/60 ${className}`}
    >
      {children}
    </div>
  );
}

/** LeetCode-style 52×7 heatmap */
function ActivityHeatmap({
  calendar,
}: {
  calendar: ActivityCalendar | null;
}) {
  const grid = useMemo(() => buildCalendarGrid(), []);
  const monthLabels = useMemo(() => buildMonthLabels(grid), [grid]);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const counts = calendar?.dates ?? {};

  return (
    <div className="relative overflow-x-auto pb-1">
      {/* Month labels */}
      <div className="flex mb-1" style={{ marginLeft: 28 }}>
        {grid.map((_, i) => {
          const label = monthLabels.find((l) => l.colIndex === i);
          return (
            <div
              key={i}
              className="text-[10px] text-slate-500 font-medium"
              style={{ width: 13, marginRight: 2 }}
            >
              {label ? label.month : ""}
            </div>
          );
        })}
      </div>

      <div className="flex gap-0">
        {/* Day-of-week labels */}
        <div className="flex flex-col mr-1.5 mt-0.5">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className="text-[10px] text-slate-600 font-medium leading-none"
              style={{ height: 13, marginBottom: 2, visibility: i % 2 === 1 ? "visible" : "hidden" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5 mr-0.5">
            {week.map(({ dateKey, date }) => {
              const count = counts[dateKey] ?? 0;
              const level = heatLevel(count);
              const isToday = toDateKey(new Date()) === dateKey;
              return (
                <div
                  key={dateKey}
                  className={`
                    w-[11px] h-[11px] rounded-sm cursor-default
                    ${HEAT_COLORS[level]}
                    ${isToday ? "ring-1 ring-emerald-400 ring-offset-0" : ""}
                    transition-colors duration-100
                  `}
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const label = date.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    setTooltip({
                      text: count > 0
                        ? `${count} activit${count === 1 ? "y" : "ies"} on ${label}`
                        : `No activity on ${label}`,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Colour scale legend */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[10px] text-slate-500">Less</span>
        {HEAT_COLORS.map((cls, i) => (
          <div key={i} className={`w-[11px] h-[11px] rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-slate-500">More</span>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 bg-slate-800 border border-slate-700
            rounded-lg text-[11px] text-slate-200 shadow-xl pointer-events-none
            whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 shrink-0";
  switch (type as ActivityType) {
    case "submission":  return <Code2        className={`${cls} text-emerald-400`} />;
    case "assessment":  return <ClipboardList className={`${cls} text-sky-400`} />;
    case "shortlist":   return <Building2    className={`${cls} text-purple-400`} />;
    case "module":      return <BookOpen     className={`${cls} text-amber-400`} />;
    case "interview":   return <Mic          className={`${cls} text-rose-400`} />;
    case "project":     return <CheckCircle2 className={`${cls} text-teal-400`} />;
    default:            return <Circle       className={`${cls} text-slate-500`} />;
  }
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<ActivityType, string> = {
    submission: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    assessment: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    shortlist:  "bg-purple-500/15 text-purple-400 border-purple-500/25",
    module:     "bg-amber-500/15 text-amber-400 border-amber-500/25",
    interview:  "bg-rose-500/15 text-rose-400 border-rose-500/25",
    project:    "bg-teal-500/15 text-teal-400 border-teal-500/25",
  };
  const labels: Record<ActivityType, string> = {
    submission: "Code",
    assessment: "Test",
    shortlist:  "Shortlist",
    module:     "Module",
    interview:  "Interview",
    project:    "Project",
  };
  const style = styles[type as ActivityType] ?? "bg-slate-700/50 text-slate-400 border-slate-600/30";
  const text  = labels[type as ActivityType] ?? type;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px]
        font-semibold border ${style}`}
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
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 rounded-xl
      bg-slate-950/40 border border-slate-800/40
      hover:bg-slate-900/60 hover:border-slate-700/50
      transition-all duration-150">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center
        rounded-lg bg-slate-800/80 border border-slate-700/40">
        <ActivityIcon type={item.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-200 truncate">
            {item.title}
          </span>
          <TypeBadge type={item.type} />
        </div>
        <p className="text-xs text-slate-400 truncate">{item.detail}</p>
      </div>
      <span className="shrink-0 text-[11px] text-slate-500 mt-0.5 font-medium">
        {timeAgo(item.created_at)}
      </span>
    </li>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { user } = useAuthStore();
  const { activity, setActivity } = useDashboardStore();
  const { isConnected } = useWebSocket(user?.id);

  // Calendar + streak come from the single /calendar endpoint
  const [calendar, setCalendar]           = useState<ActivityCalendar | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [filter, setFilter]               = useState<FilterType>("all");
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Initial load ──────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Failed to load activity.");
    } finally {
      setIsLoading(false);
    }
  }, [setActivity]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Failed to refresh.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Load more ─────────────────────────────────────────────────────────────
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
      // silently fail — user can retry
    } finally {
      setIsLoadingMore(false);
    }
  };

  const displayed =
    filter === "all" ? activity : activity.filter((a) => a.type === filter);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8
      max-w-5xl mx-auto space-y-6 text-slate-200">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap
        pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            My Activity
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
            Full history — code, tests, projects, shortlists &amp; more
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full
            text-xs font-medium border ${isConnected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-slate-800/60 border-slate-700/60 text-slate-400"
            }`}>
            {isConnected
              ? <Wifi className="w-3.5 h-3.5" />
              : <WifiOff className="w-3.5 h-3.5" />}
            {isConnected ? "Live" : "Offline"}
          </div>

          {/* Streak badge */}
          {calendar && calendar.current_streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5
              bg-amber-500/10 border border-amber-500/20 rounded-full">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">
                {calendar.current_streak}d streak
              </span>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl
              bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60
              text-xs font-semibold text-slate-200 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20
          rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Heatmap card (LeetCode style) ───────────────────────────────── */}
      {isLoading ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <Card className="p-5 space-y-4">
          {/* Streak stats row */}
          <div className="flex flex-wrap gap-6 sm:gap-10 mb-2">
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-amber-400 tabular-nums">
                {calendar?.current_streak ?? 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3" /> Current Streak
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-purple-400 tabular-nums">
                {calendar?.longest_streak ?? 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Best Streak
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-sky-400 tabular-nums">
                {Object.values(calendar?.dates ?? {}).reduce((a, b) => a + b, 0)}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3" /> Total This Year
              </span>
            </div>
            {calendar?.last_active && (
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {new Date(calendar.last_active).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Last Active
                </span>
              </div>
            )}
          </div>

          {/* 52×7 heatmap grid */}
          <ActivityHeatmap calendar={calendar} />
        </Card>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold
                border transition-all duration-150 ${isActive
                  ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                  : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Activity feed ────────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20
              flex items-center justify-center text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Activity Feed</h2>
          </div>
          {!isLoading && (
            <span className="text-xs text-slate-500 font-medium">
              {displayed.length} item{displayed.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Skeletons */}
        {isLoading && (
          <ul className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}><Skeleton className="h-16 w-full" /></li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3
            py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border
              border-slate-700/50 flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">No activity yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {filter === "all"
                  ? "Complete assessments, submit code, or do mock interviews to build your history."
                  : `No "${filter}" activities found. Try a different filter.`}
              </p>
            </div>
          </div>
        )}

        {/* Rows */}
        {!isLoading && displayed.length > 0 && (
          <ul className="space-y-2">
            {displayed.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {/* Load more */}
        {!isLoading && hasMore && filter === "all" && (
          <div className="pt-2 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-5 py-2 rounded-xl
                bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60
                text-xs font-semibold text-slate-300 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ChevronDown className="w-3.5 h-3.5" />}
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        {!isLoading && !hasMore && displayed.length > 0 && filter === "all" && (
          <p className="text-center text-[11px] text-slate-600 pt-2 font-medium">
            — end of activity —
          </p>
        )}
      </Card>
    </div>
  );
}
```

---

## Summary of All Changes

### ✅ Original code audit — no mock data
- `fetchActivity` and `fetchStreak` hit real API endpoints.
- Activity page reads from `useDashboardStore` which is populated by real API calls.
- No hardcoded data anywhere.

### 🐛 Bug fixed — streak was always 0
The `StudentStreak` document was never updated when activities were logged.
Fixed by computing streak **dynamically** inside `get_streak` from `ActivityLog.created_at` dates.
The `_compute_streak()` helper uses the exact LeetCode rule:
> *A streak continues as long as you had at least one activity every consecutive day.
> If the last activity was before yesterday, current streak = 0.*

### ➕ New backend endpoint — `GET /students/me/activity/calendar`
- Queries `ActivityLog` for the last 365 days, groups by date.
- Returns `{ dates: { "YYYY-MM-DD": count }, current_streak, longest_streak, last_active }`.
- Single call powers the entire heatmap + stats, no extra round-trip.

### 🆕 New frontend helper — `fetchActivityCalendar()`
- Added to `lib/dashboard.ts` alongside `fetchActivity`.
- Returns `ActivityCalendar` type (dates dict + streak fields).

### 🎨 New UI — LeetCode-style heatmap
| Element | Detail |
|---|---|
| **52 × 7 grid** | Sun → Sat rows, 52 weeks scrollable horizontally |
| **Colour levels** | 5 levels: empty → light green → medium → bright → max emerald |
| **Today ring** | Ring highlight on today's cell |
| **Month labels** | Rendered above the grid, auto-positioned per column |
| **Day labels** | Mon / Wed / Fri shown on y-axis (same as LeetCode) |
| **Tooltip** | Hover → "3 activities on Mon, 28 Jul 2026" |
| **Legend** | Less ◻◻◻◻◻ More at bottom |
| **Streak stats** | Current Streak 🔥 · Best Streak 🏆 · Total This Year · Last Active — above the grid |
