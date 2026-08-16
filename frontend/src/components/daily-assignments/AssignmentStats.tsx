"use client";

import { DailyAssignment, StreakData } from "@/lib/dailyAssignmentsApi";
import {
  CheckCircle2,
  ExternalLink,
  Flame,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

export const DIFFICULTY_CONFIG = {
  EASY: {
    label: "Easy Day",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  MEDIUM: {
    label: "Medium Grind",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    badge: "bg-amber-500/20 text-amber-300",
  },
  BOSS: {
    label: "BOSS MODE 🔥",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    badge: "bg-rose-500/20 text-rose-300",
  },
};

export const STREAK_TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  standard:      { label: "Building Streak",    color: "text-slate-400",   icon: "🌱" },
  unlocked_boss: { label: "BOSS Tier Unlocked", color: "text-rose-400",    icon: "🔥" },
  company_tasks: { label: "Company Tasks Live", color: "text-violet-400",  icon: "⚡" },
  elite:         { label: "Elite Member",       color: "text-amber-400",   icon: "👑" },
};

interface AssignmentStatsProps {
  assignment: DailyAssignment;
  liveStreak?: StreakData | null;
}

export function AssignmentStats({ assignment, liveStreak }: AssignmentStatsProps) {
  const diffCfg = DIFFICULTY_CONFIG[assignment.difficulty];
  const tierCfg = STREAK_TIER_CONFIG[assignment.streak_tier] ?? STREAK_TIER_CONFIG["standard"];
  const totalPoints = assignment.tasks.reduce((s, t) => s + t.points, 0);
  const earnedPoints = assignment.tasks
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const progressPct = Math.round((assignment.completed / Math.max(assignment.total, 1)) * 100);

  // Use live streak from /me/streak endpoint if available, fallback to assignment baked value
  const currentStreak = liveStreak?.current_streak ?? assignment.streak;
  const longestStreak = liveStreak?.longest_streak ?? null;

  return (
    <div className="space-y-4">
      {/* Social Proof Banner */}
      {assignment.completed_today_platform_wide > 0 && (
        <div className="flex items-center gap-3 bg-violet-950/30 border border-violet-500/20 rounded-2xl px-5 py-3.5">
          <Users className="w-5 h-5 text-violet-400 shrink-0" />
          <p className="text-slate-300 text-sm">
            <span className="text-violet-300 font-bold">
              {assignment.completed_today_platform_wide.toLocaleString("en-IN")}
            </span>{" "}
            students already crushed today's assignment 💪
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Streak — live from /me/streak */}
        <div className="bg-[#0b0f19]/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1 shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
          <div className="flex items-center gap-2">
            <Flame className={`w-4 h-4 ${tierCfg?.color ?? "text-amber-400"} ${currentStreak > 0 ? "animate-pulse" : ""}`} />
            <span className="text-slate-400 text-xs">Streak</span>
          </div>
          <p className={`text-2xl font-black ${tierCfg?.color ?? "text-amber-400"}`}>
            {currentStreak}
            <span className="text-sm font-normal text-slate-500 ml-1">days</span>
          </p>
          <p className="text-xs text-slate-500">
            {tierCfg?.icon} {tierCfg?.label}
          </p>
          {longestStreak !== null && longestStreak > 0 && (
            <p className="text-[10px] text-slate-600 mt-0.5">Best: {longestStreak}d</p>
          )}
        </div>

        {/* Progress */}
        <div className="bg-[#0b0f19]/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1 shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 text-xs">Progress</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {assignment.completed}
            <span className="text-sm font-normal text-slate-500">/{assignment.total}</span>
          </p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Points */}
        <div className="bg-[#0b0f19]/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1 shadow-xl">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400 text-xs">Points</span>
          </div>
          <p className="text-2xl font-black text-amber-400">
            {earnedPoints}
            <span className="text-sm font-normal text-slate-500">/{totalPoints}</span>
          </p>
          <p className="text-xs text-slate-500">Today's earnings</p>
        </div>

        {/* Difficulty */}
        <div
          className={`rounded-2xl p-4 flex flex-col gap-1 shadow-xl border ${
            diffCfg?.border ?? "border-slate-800/80"
          } ${diffCfg?.bg ?? "bg-[#0b0f19]/90"}`}
        >
          <div className="flex items-center gap-2">
            <Trophy className={`w-4 h-4 ${diffCfg?.color ?? "text-slate-400"}`} />
            <span className="text-slate-400 text-xs">Difficulty</span>
          </div>
          <p className={`text-lg font-black ${diffCfg?.color ?? "text-slate-200"}`}>
            {assignment.difficulty}
          </p>
          <p className="text-xs text-slate-500">Based on your streak</p>
        </div>
      </div>

      {/* Streak Bonus Banner */}
      {assignment.streak_bonus && (
        <div
          className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 border ${
            assignment.streak_tier === "elite"
              ? "bg-amber-950/30 border-amber-500/20"
              : assignment.streak_tier === "company_tasks"
              ? "bg-violet-950/30 border-violet-500/20"
              : "bg-rose-950/30 border-rose-500/20"
          }`}
        >
          <Sparkles className={`w-5 h-5 shrink-0 ${tierCfg?.color ?? "text-amber-400"}`} />
          <p className="text-slate-300 text-sm">
            <span className={`font-bold ${tierCfg?.color}`}>{tierCfg?.icon} Bonus: </span>
            {assignment.streak_bonus}
          </p>
        </div>
      )}

      {/* Sponsored Task */}
      {assignment.sponsored_task && (
        <div className="bg-[#0b0f19]/90 border border-violet-500/30 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                    Sponsored Challenge
                  </span>
                  <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                    by {assignment.sponsored_task.company}
                  </span>
                </div>
                <p className="text-slate-100 font-semibold">{assignment.sponsored_task.title}</p>
              </div>
            </div>
            <span className="text-amber-400 font-bold text-sm shrink-0">
              +{assignment.sponsored_task.points} pts
            </span>
          </div>
          {assignment.sponsored_task.content_ref && (
            <a
              href={assignment.sponsored_task.content_ref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              Open Challenge <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
