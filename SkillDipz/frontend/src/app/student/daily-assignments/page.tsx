"use client";

import { useEffect, useState } from "react";
import {
  getTodayAssignment,
  completeTask,
  getStreakData,
  DailyAssignment,
  StreakData,
} from "@/lib/dailyAssignmentsApi";
import { AssignmentStats, DIFFICULTY_CONFIG } from "@/components/daily-assignments/AssignmentStats";
import { TaskCard } from "@/components/daily-assignments/TaskCard";
import { Flame, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-800/60 rounded-xl animate-pulse ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DailyAssignmentsPage() {
  const [assignment, setAssignment] = useState<DailyAssignment | null>(null);
  const [liveStreak, setLiveStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStreak = async () => {
    try {
      const s = await getStreakData();
      setLiveStreak(s);
    } catch {
      // Silently ignore — streak is non-critical
    }
  };

  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [data] = await Promise.all([getTodayAssignment(), fetchStreak()]);
      setAssignment(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load today's assignment.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleComplete = async (taskId: string) => {
    try {
      const result = await completeTask(taskId);
      setAssignment((prev) => {
        if (!prev) return prev;
        const updatedTasks = prev.tasks.map((t) =>
          t.task_id === taskId ? { ...t, status: "completed" as const } : t
        );
        return {
          ...prev,
          tasks: updatedTasks,
          completed: updatedTasks.filter((t) => t.status === "completed").length,
          streak: result.streak,
        };
      });

      // Re-fetch live streak from backend so the stats card updates immediately
      await fetchStreak();

      if (result.all_done) {
        toast.success("🎉 All tasks done! Streak updated.", {
          description: `Streak: ${result.streak} days`,
          duration: 4000,
        });
      } else {
        toast.success("✅ Task completed! Keep going.", {
          description: liveStreak
            ? `🔥 ${(liveStreak.current_streak)} day streak`
            : undefined,
          duration: 2500,
        });
      }
    } catch {
      toast.error("Failed to mark complete. Try again.");
    }
  };

  const diffCfg = assignment ? DIFFICULTY_CONFIG[assignment.difficulty] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a12] p-6 md:p-8">
        <PageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <RefreshCw className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-white font-semibold text-xl">Couldn't Load Assignment</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={() => load()}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!assignment) return null;

  return (
    <div className="min-h-screen bg-[#060a12] p-4 md:p-6 lg:p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Daily Assignments</h1>
            {diffCfg && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${diffCfg.badge}`}>
                {diffCfg.label}
              </span>
            )}
            {/* Live streak pill — updates after each task completion */}
            {liveStreak && liveStreak.current_streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-400">
                  {liveStreak.current_streak}d streak
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-400 text-sm">{formatDate(assignment.date)}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* STATS & PROOF GRID */}
      <AssignmentStats assignment={assignment} liveStreak={liveStreak} />

      {/* TASK LIST */}
      <div className="space-y-4">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wider px-1">
          Today's Tasks
        </h2>
        {assignment.tasks.map((task, i) => (
          <TaskCard key={task.task_id} task={task} index={i} onComplete={handleComplete} />
        ))}
      </div>

      {/* ALL DONE CELEBRATION */}
      {assignment.completed === assignment.total && assignment.total > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-emerald-400 font-bold text-2xl mb-2">All Done! 🎉</h2>
          {liveStreak && liveStreak.current_streak > 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-amber-400 font-bold text-lg">
                {liveStreak.current_streak} Day Streak!
              </span>
              {liveStreak.longest_streak > 0 && liveStreak.current_streak >= liveStreak.longest_streak && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">🏆 New Best!</span>
              )}
            </div>
          )}
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            You crushed today's {assignment.difficulty} assignment. Streak & score updated.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="/student/leaderboard"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" /> View Leaderboard
            </a>
            <a
              href="/student/overview"
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-all"
            >
              Back to Overview
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
