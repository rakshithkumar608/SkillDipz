"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Trophy,
  Zap,
  Target,
  ChevronRight,
  Play,
  TrendingUp,
  Bug,
  Layers,
  ListOrdered,
  Star,
  Lock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  getArenaHome,
  ArenaHomeResponse,
  GAME_TYPE_LABELS,
  GAME_TYPE_DESCRIPTIONS,
  GAME_TYPE_XP,
  GAME_TYPE_TIME,
  SKILL_DISPLAY,
  formatCountdown,
} from "@/lib/arenaApi";

//  Sub-components 

function XPBar({
  level, xpIn, xpFor, pct,
}: { level: number; xpIn: number; xpFor: number; pct: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-sky-400 tracking-widest uppercase">Level {level}</span>
        <span className="text-xs text-slate-500 font-mono">{xpIn.toLocaleString()} / {xpFor.toLocaleString()} XP</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-sky-500 to-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

const GAME_ICONS: Record<string, React.ElementType> = {
  spotbug: Bug,
  orderit: ListOrdered,
  stackit: Layers,
};

const GAME_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  spotbug:  { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
  orderit:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20" },
  stackit:  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

function GameCard({ type, isCompletedToday }: { type: string; isCompletedToday?: boolean }) {
  const Icon = GAME_ICONS[type] || Target;
  const colors = GAME_COLORS[type] || GAME_COLORS.spotbug;

  if (isCompletedToday) {
    return (
      <div className="relative bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
            Done Today
          </span>
        </div>
        <h3 className="font-bold text-white text-base mb-1">{GAME_TYPE_LABELS[type]}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">{GAME_TYPE_DESCRIPTIONS[type]}</p>
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-xs text-slate-500 font-medium">Returns tomorrow</span>
          <Link href="/student/skill-tests/leaderboard">
            <span className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-0.5">
              Rankings <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/student/skill-tests/play/${type}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`group relative bg-slate-900/60 border ${colors.border} rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:bg-slate-800/60`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg}`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
        <h3 className="font-bold text-white text-base mb-1">{GAME_TYPE_LABELS[type]}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">{GAME_TYPE_DESCRIPTIONS[type]}</p>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${colors.text}`}>{GAME_TYPE_XP[type]}</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{GAME_TYPE_TIME[type]}</span>
        </div>
      </motion.div>
    </Link>
  );
}

function LeaderboardRow({
  rank, name, initials, level, xp, streak, isMe,
}: { rank: number; name: string; initials: string; level: number; xp: number; streak: number; isMe: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isMe ? "bg-sky-500/10 border border-sky-500/20" : "hover:bg-white/3"}`}>
      <span className={`w-6 text-center text-xs font-bold ${rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-700" : "text-slate-500"}`}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
      </span>
      <div className="w-7 h-7 rounded-full bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isMe ? "text-sky-400" : "text-slate-200"}`}>
          {name} {isMe && <span className="text-xs text-sky-500">(You)</span>}
        </p>
        <p className="text-xs text-slate-500">Lvl {level}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white">{xp.toLocaleString()} XP</p>
        {streak > 0 && <p className="text-xs text-amber-400">🔥 {streak}</p>}
      </div>
    </div>
  );
}

//  Main Page 

export default function GameArenaHome() {
  const [data, setData] = useState<ArenaHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("--");

  useEffect(() => {
    getArenaHome()
      .then((d) => { setData(d); })
      .catch(() => setError("Failed to load Arena. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  // Live countdown for next reset
  useEffect(() => {
    if (!data?.daily?.next_reset_at) return;
    setCountdown(formatCountdown(data.daily.next_reset_at));
    const id = setInterval(() => {
      setCountdown(formatCountdown(data.daily.next_reset_at!));
    }, 1000);
    return () => clearInterval(id);
  }, [data?.daily?.next_reset_at]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-slate-300">{error || "Something went wrong"}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-400 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { daily } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Game Arena</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Play. Prove. Improve.</h1>
        <p className="text-slate-400 mt-1 text-sm">Test your technical skills through three distinct daily challenges.</p>
      </motion.div>

      {/* ── Stats Row ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total XP" value={data.total_xp.toLocaleString()} sub={`${data.weekly_xp.toLocaleString()} this week`} icon={Star} color="bg-amber-500/15 text-amber-400" />
        <StatCard label="Level" value={data.level} sub={`${data.progress_pct}% to next`} icon={TrendingUp} color="bg-sky-500/15 text-sky-400" />
        <StatCard label="Streak" value={`🔥 ${data.arena_streak}`} sub={`Best: ${data.longest_arena_streak} days`} icon={Flame} color="bg-rose-500/15 text-rose-400" />
        <StatCard
          label={data.my_daily_rank ? "Today's Rank ⚡" : "Weekly Rank"}
          value={data.my_daily_rank ? `#${data.my_daily_rank}` : data.my_weekly_rank ? `#${data.my_weekly_rank}` : "—"}
          sub={data.my_daily_rank ? "Sprint rank today" : `${data.total_games_played} games played`}
          icon={Trophy}
          color="bg-violet-500/15 text-violet-400"
        />
      </motion.div>

      {/* ── XP Bar ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 mb-6">
        <XPBar level={data.level} xpIn={data.xp_in_level} xpFor={data.xp_for_next_level} pct={data.progress_pct} />
      </motion.div>

      {/* ── Daily Arena CTA ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
        <div className={`relative overflow-hidden rounded-2xl border ${daily.already_completed ? "bg-slate-900/60 border-emerald-500/20" : "bg-linear-to-r from-sky-950/80 to-indigo-950/80 border-sky-500/20"} p-6`}>
          {!daily.already_completed && (
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          )}

          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {daily.already_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Target className="w-4 h-4 text-sky-400" />
                )}
                <span className={`text-xs font-bold tracking-widest uppercase ${daily.already_completed ? "text-emerald-400" : "text-sky-400"}`}>
                  {daily.already_completed ? "Completed Today" : "Today's Challenge"}
                </span>
              </div>

              <h2 className="text-xl font-black text-white mb-2">
                {daily.already_completed ? "Arena Complete! 🎉" : "Daily Skill Sprint"}
              </h2>

              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                <span>3 Games</span>
                <span>·</span>
                <span>~5 Minutes</span>
                <span>·</span>
                <span className="text-amber-400 font-semibold">170+ XP</span>
                {daily.already_completed && daily.time_taken_str && (
                  <>
                    <span>·</span>
                    <span className="text-sky-400 font-bold font-mono">⏱️ {daily.time_taken_str}</span>
                  </>
                )}
              </div>

              {/* Countdown on completed state */}
              {daily.already_completed && daily.next_reset_at && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  Next Arena in{" "}
                  <span className="text-sky-400 font-bold font-mono tabular-nums">{countdown}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              {daily.already_completed ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">COMPLETED ✓</span>
                  </div>
                  <Link href="/student/skill-tests/leaderboard">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-sm rounded-xl hover:bg-sky-500/30 transition-colors whitespace-nowrap">
                      <Trophy className="w-4 h-4" />
                      View Ranking
                    </button>
                  </Link>
                </>
              ) : (
                <Link href="/student/skill-tests/daily">
                  <button className="flex items-center gap-2 px-6 py-3 bg-sky-500 text-white font-bold text-sm rounded-xl hover:bg-sky-400 active:scale-95 transition-all shadow-lg shadow-sky-500/25 whitespace-nowrap">
                    <Play className="w-4 h-4 fill-current" />
                    Play Today&apos;s Arena
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Game Modes (practice anytime) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Game Modes</h2>
          <span className="text-xs text-slate-500">Practice anytime</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["spotbug", "orderit", "stackit"].map((type) => (
            <GameCard
              key={type}
              type={type}
              isCompletedToday={data.completed_game_types_today?.includes(type)}
            />
          ))}
        </div>
      </motion.div>

      {/* ── Bottom Grid: Leaderboard + Skills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard Preview */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="font-bold text-white">Weekly Leaderboard</h2>
            <Link href="/student/skill-tests/leaderboard">
              <span className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">Full <ChevronRight className="w-3 h-3" /></span>
            </Link>
          </div>
          <div className="p-2 space-y-1">
            {data.leaderboard_preview.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-6">No players yet — be the first!</p>
            ) : (
              data.leaderboard_preview.map((entry) => (
                <LeaderboardRow
                  key={entry.student_id}
                  rank={entry.rank}
                  name={entry.name}
                  initials={entry.avatar_initials}
                  level={entry.level}
                  xp={entry.weekly_xp}
                  streak={entry.arena_streak}
                  isMe={entry.is_me}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Skill Overview */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="font-bold text-white">Skill Overview</h2>
            <Link href="/student/skill-tests/skills">
              <span className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">Details <ChevronRight className="w-3 h-3" /></span>
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {data.skill_scores.length === 0 ? (
              <div className="text-center py-6">
                <Lock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Play games to unlock your skill overview</p>
              </div>
            ) : (
              data.skill_scores
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.skill} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{SKILL_DISPLAY[s.skill] || s.skill}</span>
                      <span className={`font-bold ${s.score >= 80 ? "text-emerald-400" : s.score >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                        {s.score.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${s.score >= 80 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${s.score}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Performance ── */}
      {data.total_games_played > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 bg-slate-900/60 border border-white/5 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">Your Performance</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-black text-white">{data.recent_accuracy.toFixed(0)}%</p>
              <p className="text-xs text-slate-500 mt-1">Recent Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.total_games_played}</p>
              <p className="text-xs text-slate-500 mt-1">Games Played</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.arena_streak}</p>
              <p className="text-xs text-slate-500 mt-1">Day Streak</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
