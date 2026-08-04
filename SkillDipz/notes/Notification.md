# Feature 7 — Notifications (Full Implementation)

> **Rule:** Do NOT touch the main codebase directly. Apply every change described
> below once you are ready. Each section shows the **exact file path** and the
> **complete replacement / new content** to write.
>
> All code is production-ready — zero mock data, wired to MongoDB via Beanie,
> pushed via the existing `ws_manager`, tracked through the existing `event_bus`.

---

## Overview — What Already Exists vs. What Needs Work

| Layer | Already exists | Needs work |
|---|---|---|
| `Notification` Beanie model | ✅ `app/models/notification.py` | Add `notification_type` field |
| `send_notification()` service | ✅ `app/services/notification_service.py` | Already complete |
| `GET /students/me/notifications` | ✅ `app/api/routes/students.py` L418-444 | Add `unread` filter query param + expose `notification_type` |
| `PATCH …/:id/read` | ✅ `students.py` L447-458 | Already complete |
| `PATCH …/mark-all-read` | ✅ `students.py` L461-473 | Already complete |
| WebSocket push | ✅ `app/core/ws_manager.py` + `app/api/routes/ws.py` | Already complete |
| `useWebSocket` hook WS handler | ✅ `frontend/src/hooks/useWebSocket.ts` L60-67 | Already complete |
| `dashboardStore` `NotificationItem` type | ✅ `frontend/src/store/dashboardStore.ts` | Add `notification_type` field |
| `fetchNotifications`, `markAllNotificationsRead` | ✅ `frontend/src/lib/dashboard.ts` | Add `markOneNotificationRead` helper |
| Notifications **page** | ❌ `frontend/src/app/student/notifications/page.tsx` | Replace ComingSoon with real UI |

---

## Backend Changes

### 1. MODIFY `backend/app/models/notification.py`

Add `notification_type` field so the frontend can render different icons per category.

```python
# FILE: backend/app/models/notification.py
# FULL REPLACEMENT

from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class Notification(Document):
    student_id: str
    title: str
    body: str
    action_url: Optional[str] = None
    is_read: bool = False
    notification_type: str = "general"   # NEW FIELD — e.g. "job_posted", "company_eligible", "score_update"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"
```

> **No migration needed** — Beanie / MongoDB will simply default `notification_type`
> to `"general"` for all existing documents that do not have the field yet.

---

### 2. MODIFY `backend/app/api/routes/students.py`

Only the notification-related schemas and three routes need changing.
Leave everything else in the file untouched.

Find the block starting at `class NotificationItem(BaseModel):` (around line 61)
through `mark_all_notifications_read` (around line 473) and **replace** it with:

```python
# ─── Notification schemas ───────────────────────────────────────────────────
class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    action_url: Optional[str]
    is_read: bool
    notification_type: str          # ADDED
    created_at: datetime


class NotificationsOut(BaseModel):
    unread_count: int
    items: List[NotificationItem]


# ─── GET /students/me/notifications ─────────────────────────────────────────
@router.get("/me/notifications", response_model=NotificationsOut)
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread: bool = Query(False, description="Return only unread notifications when true"),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    query = Notification.find(Notification.student_id == student_id)
    if unread:
        query = query.find(Notification.is_read == False)  # noqa: E712
    items = (
        await query
        .sort(-Notification.created_at)
        .limit(limit)
        .to_list()
    )
    unread_count = sum(1 for n in items if not n.is_read)
    return NotificationsOut(
        unread_count=unread_count,
        items=[
            NotificationItem(
                id=str(n.id),
                title=n.title,
                body=n.body,
                action_url=n.action_url,
                is_read=n.is_read,
                notification_type=getattr(n, "notification_type", "general"),
                created_at=n.created_at,
            )
            for n in items
        ],
    )


# ─── PATCH /students/me/notifications/mark-all-read ─────────────────────────
# NOTE: must be BEFORE the /:id/read route so FastAPI does not try to
#       match the literal string "mark-all-read" as a path parameter.
@router.patch("/me/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    unread = await Notification.find(
        Notification.student_id == student_id,
        Notification.is_read == False,  # noqa: E712
    ).to_list()
    for n in unread:
        n.is_read = True
        await n.save()
    return {"message": f"Marked {len(unread)} notifications as read."}


# ─── PATCH /students/me/notifications/{notification_id}/read ─────────────────
@router.patch("/me/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    from beanie import PydanticObjectId
    notif = await Notification.get(PydanticObjectId(notification_id))
    if not notif or str(notif.student_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    await notif.save()
    return {"message": "Marked as read."}
```

---

## Frontend Changes

### 3. MODIFY `frontend/src/store/dashboardStore.ts`

Add `notification_type` to the `NotificationItem` interface.

```typescript
// REPLACE the existing NotificationItem interface with:

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  notification_type: string;   // ADDED
  created_at: string;
}
```

> All existing code that consumes `NotificationItem` will still compile because
> the field is optional in practice — TypeScript requires it but the backend
> always provides it now.

---

### 4. MODIFY `frontend/src/lib/dashboard.ts`

Add two new helpers after the existing `markAllNotificationsRead` function.

```typescript
// ADD after line 63 (after markAllNotificationsRead):

export async function markOneNotificationRead(notificationId: string): Promise<void> {
  await api.patch(`/students/me/notifications/${notificationId}/read`);
}

export async function fetchUnreadNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>(
    "/students/me/notifications?limit=50&unread=true"
  );
  return data;
}
```

---

### 5. REPLACE `frontend/src/app/student/notifications/page.tsx`

Full production UI — zero mock data, reads from MongoDB via the API,
receives real-time pushes via WebSocket through `dashboardStore`.

```tsx
// FILE: frontend/src/app/student/notifications/page.tsx
// FULL REPLACEMENT — replaces the ComingSoon stub

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markOneNotificationRead,
} from "@/lib/dashboard";
import { useDashboardStore, NotificationItem } from "@/store/dashboardStore";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  BriefcaseBusiness,
  TrendingUp,
  BookOpen,
  AlertCircle,
  Info,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ─── Icon mapper by notification_type ────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "job_posted":
      return <BriefcaseBusiness className={`${cls} text-sky-400`} />;
    case "company_gap":
      return <TrendingUp className={`${cls} text-violet-400`} />;
    case "company_eligible":
      return <TrendingUp className={`${cls} text-indigo-400`} />;
    case "company_new_match":
      return <TrendingUp className={`${cls} text-purple-400`} />;
    case "score_update":
      return <Sparkles className={`${cls} text-amber-400`} />;
    case "roadmap":
      return <BookOpen className={`${cls} text-emerald-400`} />;
    case "achievement":
      return <Trophy className={`${cls} text-yellow-400`} />;
    case "warning":
      return <AlertCircle className={`${cls} text-red-400`} />;
    default:
      return <Info className={`${cls} text-slate-400`} />;
  }
}

// ─── Border / background accent by type ──────────────────────────────────────
function accentColor(type: string): string {
  switch (type) {
    case "job_posted":        return "border-sky-500/30 bg-sky-500/5";
    case "company_eligible":  return "border-indigo-500/30 bg-indigo-500/5";
    case "company_gap":       return "border-violet-500/30 bg-violet-500/5";
    case "company_new_match": return "border-purple-500/30 bg-purple-500/5";
    case "score_update":      return "border-amber-500/30 bg-amber-500/5";
    case "achievement":       return "border-yellow-500/30 bg-yellow-500/5";
    case "warning":           return "border-red-500/30 bg-red-500/5";
    default:                  return "border-white/[0.06] bg-white/[0.02]";
  }
}

// ─── Single notification card ─────────────────────────────────────────────────
function NotifCard({
  notif,
  onRead,
}: {
  notif: NotificationItem;
  onRead: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    if (notif.action_url) router.push(notif.action_url);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={`
        relative flex items-start gap-4 p-4 rounded-2xl border cursor-pointer
        transition-all duration-200 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20
        ${accentColor(notif.notification_type)}
        ${notif.is_read ? "opacity-60" : ""}
      `}
    >
      {/* Unread indicator */}
      {!notif.is_read && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/60 animate-pulse" />
      )}

      {/* Icon bubble */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
        <NotifIcon type={notif.notification_type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4">
        <p
          className={`text-sm font-semibold truncate ${
            notif.is_read ? "text-slate-400" : "text-white"
          }`}
        >
          {notif.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[10px] text-slate-600 mt-1.5">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Chevron if navigable */}
      {notif.action_url && (
        <ChevronRight className="flex-shrink-0 w-4 h-4 text-slate-600 self-center" />
      )}
    </motion.div>
  );
}

type FilterTab = "all" | "unread";

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifications, unreadCount, setNotifications, markAllRead } =
    useDashboardStore();

  const [isLoading, setIsLoading]     = useState(false);
  const [isMarking, setIsMarking]     = useState(false);
  const [activeTab, setActiveTab]     = useState<FilterTab>("all");
  const [localNotifs, setLocalNotifs] = useState<NotificationItem[]>([]);

  // Load from API on mount
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchNotifications();
      setNotifications(res.items, res.unread_count);
      setLocalNotifs(res.items);
    } catch {
      toast.error("Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [setNotifications]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync from zustand — WS pushes new notifs into store
  useEffect(() => {
    setLocalNotifs(notifications);
  }, [notifications]);

  // Mark single read — optimistic update
  const handleMarkOne = useCallback(
    async (id: string) => {
      setLocalNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        Math.max(0, unreadCount - 1)
      );
      try {
        await markOneNotificationRead(id);
      } catch {
        // revert on failure
        await load();
      }
    },
    [notifications, unreadCount, setNotifications, load]
  );

  // Mark all read
  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setIsMarking(true);
    try {
      await markAllNotificationsRead();
      markAllRead();
      setLocalNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Failed to mark all as read.");
    } finally {
      setIsMarking(false);
    }
  };

  const displayed =
    activeTab === "unread"
      ? localNotifs.filter((n) => !n.is_read)
      : localNotifs;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/10 relative">
            <Bell className="w-6 h-6 text-sky-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow-sm shadow-sky-500/60">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Shortlists, score updates, new jobs and platform alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={isLoading}
            title="Refresh"
            className="p-2 rounded-xl bg-slate-800/60 border border-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleMarkAll}
            disabled={isMarking || unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium hover:bg-sky-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isMarking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Mark all read
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        {(["all", "unread"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
            {tab === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-sky-500/30 text-sky-300 text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && localNotifs.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <span className="ml-3 text-slate-400">Loading notifications…</span>
        </div>
      ) : displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 gap-4"
        >
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <BellOff className="w-12 h-12 text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-slate-400">
              {activeTab === "unread" ? "All caught up!" : "No notifications yet"}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {activeTab === "unread"
                ? "You have no unread notifications."
                : "You will be notified about shortlists, score updates, and new jobs."}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          <AnimatePresence>
            {displayed.map((notif) => (
              <NotifCard
                key={notif.id}
                notif={notif}
                onRead={handleMarkOne}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

---

### 6. Install `date-fns` (if not already present)

```bash
# Run from: frontend/
npm install date-fns
```

Check `package.json` first — it may already be installed as a transitive
dependency of another library.

---

## Real-Time Data Flow

```
Any event fires (job posted, score updated, company match, etc.)
    │
    └── event_bus.publish(event_type, payload)
            │
            └── handler in event_bus.py calls send_notification()
                    │
                    ├── INSERT Notification doc into MongoDB (Beanie)
                    └── ws_manager.broadcast(student_id, "notification", payload)
                                │
                                └── WebSocket frame reaches browser
                                        │
                                        └── useWebSocket.ts onmessage handler
                                                │
                                                └── useDashboardStore.setNotifications()
                                                        │
                                                        ├── Sidebar Bell badge counter increments
                                                        └── /student/notifications page re-renders
                                                            (if open) via React state sync
```

---

## API Contract

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| `GET` | `/v1/students/me/notifications?limit=50` | Bearer JWT | Returns all, newest first |
| `GET` | `/v1/students/me/notifications?limit=50&unread=true` | Bearer JWT | Only unread |
| `PATCH` | `/v1/students/me/notifications/:id/read` | Bearer JWT | Mark single as read |
| `PATCH` | `/v1/students/me/notifications/mark-all-read` | Bearer JWT | Mark all as read |
| `WS` | `/v1/ws/student/{userId}?token=<jwt>` | JWT via query param | Real-time push event `{ type: "notification", payload: { id, title, body, action_url, notification_type, created_at } }` |

---

## Summary of Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `backend/app/models/notification.py` | Add `notification_type` field |
| 2 | `backend/app/api/routes/students.py` | Update 3 notification routes + schemas (add `unread` filter + expose `notification_type`) |
| 3 | `frontend/src/store/dashboardStore.ts` | Add `notification_type: string` to `NotificationItem` interface |
| 4 | `frontend/src/lib/dashboard.ts` | Add `markOneNotificationRead()` and `fetchUnreadNotifications()` |
| 5 | `frontend/src/app/student/notifications/page.tsx` | Replace `ComingSoon` stub with full real-time page |

No new files need to be created. No database migrations needed.
