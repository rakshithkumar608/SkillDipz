"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, TrendingUp, Loader2, AlertCircle, Clock, Zap } from "lucide-react";
import {
  getArenaLeaderboard,
  ArenaLeaderboardResponse,
  ArenaLeaderboardEntry,
} from "@/lib/arenaApi";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-xs font-bold text-slate-500 w-6 text-right">#{rank}</span>;
}

function LeaderboardRow({ entry, showTime }: { entry: ArenaLeaderboardEntry; showTime?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
        entry.is_me
          ? "bg-sky-500/10 border border-sky-500/20"
          : "hover:bg-white/3 border border-transparent"
      }`}
    >
      <div className="w-8 flex-shrink-0 flex items-center justify-center">
        <RankBadge rank={entry.rank} />
      </div>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="text-xs font-black text-white">{entry.avatar_initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate ${entry.is_me ? "text-sky-400" : "text-slate-200"}`}>
            {entry.name}
            {entry.is_me && <span className="ml-1 text-xs text-sky-500"> · You</span>}
          </p>
        </div>
        <p className="text-xs text-slate-500">Level {entry.level}</p>
      </div>

      {/* Time Taken badge for Daily Arena */}
      {showTime && entry.time_taken_str && (
        <div className="flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs font-mono font-bold text-sky-400">
          <Clock className="w-3 h-3" />
          <span>{entry.time_taken_str}</span>
        </div>
      )}

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black text-white">{entry.xp.toLocaleString()}</p>
        <p className="text-xs text-slate-500">XP</p>
      </div>
      {entry.arena_streak > 0 && (
        <div className="flex items-center gap-1 ml-1">
          <Flame className="w-3 h-3 text-amber-400" />
          <span className="text-xs text-amber-400 font-semibold">{entry.arena_streak}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function ArenaLeaderboardPage() {
  const [scope, setScope] = useState<"today" | "weekly" | "lifetime">("today");
  const [data, setData] = useState<ArenaLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getArenaLeaderboard(scope)
      .then(setData)
      .catch(() => setError("Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Arena</span>
        </div>
        <h1 className="text-3xl font-black text-white">Leaderboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          {scope === "today"
            ? "Today's rankings — sorted by XP earned & fastest completion time."
            : scope === "weekly"
            ? "Weekly XP rankings — resets every Monday UTC."
            : "All-time accumulated Arena XP."}
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-slate-900/60 border border-white/5 rounded-xl">
        {[
          { key: "today", label: "Today's Sprint ⚡" },
          { key: "weekly", label: "Weekly XP" },
          { key: "lifetime", label: "All-Time" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setScope(tab.key as "today" | "weekly" | "lifetime")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              scope === tab.key
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-slate-400">{error}</p>
        </div>
      ) : !data ? null : (
        <>
          {/* Top 3 Podium */}
          {data.entries.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-8">
              {/* 2nd */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shadow-lg">
                  <span className="text-xs font-black text-white">{data.entries[1]?.avatar_initials}</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold truncate max-w-[80px] text-center">{data.entries[1]?.name}</p>
                {scope === "today" && data.entries[1]?.time_taken_str && (
                  <span className="text-[10px] text-sky-400 font-mono">{data.entries[1]?.time_taken_str}</span>
                )}
                <div className="w-20 h-16 bg-slate-700/50 border border-white/10 rounded-t-xl flex items-center justify-center">
                  <span className="text-xl">🥈</span>
                </div>
              </motion.div>
              {/* 1st */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex flex-col items-center gap-2 -mb-2"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 ring-2 ring-amber-400/50">
                  <span className="text-sm font-black text-white">{data.entries[0]?.avatar_initials}</span>
                </div>
                <p className="text-xs text-amber-300 font-bold truncate max-w-[80px] text-center">{data.entries[0]?.name}</p>
                {scope === "today" && data.entries[0]?.time_taken_str && (
                  <span className="text-[10px] text-amber-300 font-mono font-bold">⚡ {data.entries[0]?.time_taken_str}</span>
                )}
                <div className="w-20 h-24 bg-amber-500/10 border border-amber-500/30 rounded-t-xl flex items-center justify-center">
                  <span className="text-2xl">🥇</span>
                </div>
              </motion.div>
              {/* 3rd */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shadow-lg">
                  <span className="text-xs font-black text-white">{data.entries[2]?.avatar_initials}</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold truncate max-w-[80px] text-center">{data.entries[2]?.name}</p>
                {scope === "today" && data.entries[2]?.time_taken_str && (
                  <span className="text-[10px] text-sky-400 font-mono">{data.entries[2]?.time_taken_str}</span>
                )}
                <div className="w-20 h-12 bg-amber-900/30 border border-amber-900/30 rounded-t-xl flex items-center justify-center">
                  <span className="text-lg">🥉</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Full list */}
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {data.total} {scope === "today" ? "completed today" : "players"}
              </span>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">
                  {scope === "today" ? "Ranked by XP + Speed" : scope === "weekly" ? "Resets Monday" : "All-time"}
                </span>
              </div>
            </div>
            {data.entries.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No players completed today&apos;s sprint yet.</p>
                <p className="text-slate-600 text-xs mt-1">Be the first to claim #1 rank!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/3">
                {data.entries.map((entry) => (
                  <LeaderboardRow
                    key={entry.student_id}
                    entry={entry}
                    showTime={scope === "today"}
                  />
                ))}
              </div>
            )}
          </div>

          {/* My rank if outside top 50 */}
          {data.my_entry && data.my_entry.rank > 50 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-slate-600">Your Rank</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <LeaderboardRow entry={data.my_entry} showTime={scope === "today"} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
