"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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
  Video,
  ShieldAlert,
  Target,
  Building2,
  Calendar,
  CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatTimeAgo, formatExactDateTime } from "@/lib/dateUtils";

// Icon mapper by notification_type
function NotifIcon({ type }: { type: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "interview_scheduled":
      return <Video className={`${cls} text-sky-400`} />;
    case "interview_terminated":
      return <ShieldAlert className={`${cls} text-red-400`} />;
    case "job_posted":
      return <BriefcaseBusiness className={`${cls} text-indigo-400`} />;
    case "company_gap":
    case "company_eligible":
    case "company_new_match":
      return <Building2 className={`${cls} text-violet-400`} />;
    case "score_update":
      return <Sparkles className={`${cls} text-amber-400`} />;
    case "daily_assignment":
    case "streak_bonus":
      return <Target className={`${cls} text-emerald-400`} />;
    case "roadmap":
      return <BookOpen className={`${cls} text-teal-400`} />;
    case "achievement":
      return <Trophy className={`${cls} text-yellow-400`} />;
    case "warning":
      return <AlertCircle className={`${cls} text-red-400`} />;
    default:
      return <Info className={`${cls} text-slate-400`} />;
  }
}

// Border / background accent by type
function accentColor(type: string): string {
  switch (type) {
    case "interview_scheduled":
      return "border-sky-500/40 bg-sky-500/10 shadow-lg shadow-sky-500/5 hover:border-sky-400";
    case "interview_terminated":
      return "border-red-500/40 bg-red-500/10";
    case "job_posted":
      return "border-indigo-500/30 bg-indigo-500/5";
    case "company_eligible":
    case "company_gap":
    case "company_new_match":
      return "border-violet-500/30 bg-violet-500/5";
    case "score_update":
      return "border-amber-500/30 bg-amber-500/5";
    case "daily_assignment":
      return "border-emerald-500/30 bg-emerald-500/5";
    case "achievement":
      return "border-yellow-500/30 bg-yellow-500/5";
    case "warning":
      return "border-red-500/30 bg-red-500/5";
    default:
      return "border-white/[0.06] bg-white/[0.02]";
  }
}

// Single notification card
function NotifCard({
  notif,
  onRead,
}: {
  notif: NotificationItem;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const nType = notif.notification_type || notif.type || "";
  const isInterview = nType === "interview_scheduled";

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
        ${accentColor(nType)}
        ${notif.is_read ? "opacity-60" : ""}
      `}
    >
      {/* Unread indicator */}
      {!notif.is_read && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/60 animate-pulse" />
      )}

      {/* Icon bubble */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
        <NotifIcon type={nType} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Distinct term badge for company interview invitations */}
        {isInterview && (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-400 mb-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/30">
            <Calendar className="w-3 h-3" /> Company Interview Invite
          </span>
        )}

        <p
          className={`text-sm font-semibold truncate ${
            notif.is_read ? "text-slate-400" : "text-white"
          }`}
        >
          {notif.title}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
          {notif.body}
        </p>
        <p
          className="text-[10px] text-slate-500 mt-1.5 font-mono"
          title={formatExactDateTime(notif.created_at)}
        >
          {formatTimeAgo(notif.created_at)}
        </p>
      </div>

      {/* Chevron if navigable */}
      {notif.action_url && (
        <ChevronRight className="shrink-0 w-4 h-4 text-slate-500 self-center" />
      )}
    </motion.div>
  );
}

type FilterTab = "all" | "unread" | "interviews" | "jobs" | "score";

export default function NotificationsPage() {
  const { notifications, unreadCount, setNotifications, markAllRead } =
    useDashboardStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
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
  }, []);

  // Sync from zustand store (WS updates)
  useEffect(() => {
    setLocalNotifs(notifications);
  }, [notifications]);

  // Mark single read
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
        await markNotificationRead(id);
      } catch {
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

  // Filtered dataset
  const displayed = localNotifs.filter((n) => {
    const nType = n.notification_type || n.type || "";
    if (activeTab === "unread") return !n.is_read;
    if (activeTab === "interviews") {
      return (
        nType === "interview_scheduled" ||
        nType === "interview_terminated" ||
        n.title.toLowerCase().includes("interview")
      );
    }
    if (activeTab === "jobs") {
      return (
        nType.includes("job") ||
        nType.includes("company") ||
        n.title.toLowerCase().includes("job")
      );
    }
    if (activeTab === "score") {
      return (
        nType === "score_update" ||
        nType === "daily_assignment" ||
        nType === "streak_bonus" ||
        nType === "achievement"
      );
    }
    return true;
  });

  const getTabCount = (tab: FilterTab) => {
    if (tab === "unread") return unreadCount;
    if (tab === "interviews") {
      return localNotifs.filter(
        (n) =>
          (n.notification_type || n.type) === "interview_scheduled" ||
          (n.notification_type || n.type) === "interview_terminated" ||
          n.title.toLowerCase().includes("interview")
      ).length;
    }
    if (tab === "jobs") {
      return localNotifs.filter((n) =>
        (n.notification_type || n.type || "").includes("job")
      ).length;
    }
    if (tab === "score") {
      return localNotifs.filter(
        (n) =>
          (n.notification_type || n.type) === "score_update" ||
          (n.notification_type || n.type) === "daily_assignment"
      ).length;
    }
    return localNotifs.length;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-linear-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/10 relative">
            <Bell className="w-6 h-6 text-sky-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow-sm shadow-sky-500/60">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications Center</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Company interview invitations, job alerts, score updates, and platform events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={isLoading}
            title="Refresh"
            className="p-2 rounded-xl bg-slate-800/60 border border-white/6 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-white/10 w-fit">
        {[
          { key: "all", label: "All", icon: Bell },
          { key: "unread", label: "Unread", icon: CircleDot },
          { key: "interviews", label: "Interviews", icon: Video },
          { key: "jobs", label: "Jobs", icon: BriefcaseBusiness },
          { key: "score", label: "Score & Tasks", icon: Sparkles },
        ].map((tab) => {
          const count = getTabCount(tab.key as FilterTab);
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as FilterTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-lg shadow-sky-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive
                      ? "bg-sky-500/40 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading && localNotifs.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <span className="ml-3 text-slate-400 text-sm">
            Loading notifications…
          </span>
        </div>
      ) : displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 gap-4"
        >
          <div className="p-5 rounded-2xl bg-white/3 border border-white/6">
            <BellOff className="w-12 h-12 text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-slate-400">
              No notifications in this tab
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You will be notified when companies schedule interviews, post jobs, or update your employability score.
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