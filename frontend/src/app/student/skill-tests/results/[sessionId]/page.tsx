"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Flame,
  Star,
  ChevronRight,
  ArrowLeft,
  Zap,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getSessionResults,
  CompleteSessionResponse,
  GAME_TYPE_LABELS,
  SKILL_DISPLAY,
} from "@/lib/arenaApi";

function CircularProgress({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = circ * (value / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="absolute -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
          <motion.circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <span className="text-lg font-black text-white">{value.toFixed(0)}%</span>
      </div>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [result, setResult] = useState<CompleteSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    getSessionResults(sessionId)
      .then(setResult)
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-slate-300">{error}</p>
          <button onClick={() => router.push("/student/skill-tests")} className="px-4 py-2 bg-sky-500 text-white text-sm font-semibold rounded-xl">
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  const accuracy = result.accuracy;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push("/student/skill-tests")} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-slate-500">{GAME_TYPE_LABELS[result.game_type]}</span>
      </div>

      {/* ── RESULT BANNER ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-8"
      >
        <div className="mb-4">
          {result.is_perfect ? (
            <div className="text-6xl">✨</div>
          ) : accuracy >= 70 ? (
            <Trophy className="w-14 h-14 text-amber-400 mx-auto" />
          ) : (
            <Star className="w-14 h-14 text-slate-600 mx-auto" />
          )}
        </div>
        <h1 className="text-3xl font-black text-white mb-1">
          {result.is_perfect ? "Perfect Run!" : "Arena Complete"}
        </h1>
        <p className="text-slate-400 text-sm">
          {result.correct_count} / {result.total_questions} correct
        </p>

        {/* XP & Time earned */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500/15 border border-amber-500/30 rounded-full"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xl font-black text-amber-400">+{result.total_xp} XP</span>
          </motion.div>

          {result.total_time_str && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/15 border border-sky-500/30 rounded-full text-sky-400 text-sm font-bold font-mono"
            >
              <span>⏱️ Time: {result.total_time_str}</span>
            </motion.div>
          )}
        </div>

        {/* Level up */}
        <AnimatePresence>
          {result.leveled_up && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-sky-500/15 border border-sky-500/30 rounded-full"
            >
              <span className="text-sm font-bold text-sky-400">
                🎉 LEVEL UP! {result.old_level} → {result.level_info.level}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Badges ── */}
      {result.badges_earned.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-center"
        >
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">New Badge{result.badges_earned.length > 1 ? "s" : ""} Unlocked!</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {result.badges_earned.map((b) => (
              <span key={b} className="px-3 py-1 bg-amber-500/10 rounded-full text-sm font-semibold text-amber-300">
                🏆 {b.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-around mb-8"
      >
        <CircularProgress value={accuracy} label="Accuracy" color="#38bdf8" />
        <CircularProgress value={result.level_info.progress_pct} label="Level Progress" color="#a78bfa" />
        <CircularProgress
          value={result.total_xp > 0 ? Math.min(100, (result.total_xp / 200) * 100) : 0}
          label="XP Rate"
          color="#f59e0b"
        />
      </motion.div>

      {/* ── Streak ── */}
      {result.arena_streak > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mb-6 flex items-center justify-center gap-2 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl"
        >
          <Flame className="w-5 h-5 text-rose-400" />
          <span className="font-bold text-white">{result.arena_streak} Day Streak</span>
          {result.arena_streak === 7 && <span className="text-xs text-rose-400">Milestone! 🔥</span>}
        </motion.div>
      )}

      {/* ── XP Bar ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6 bg-slate-900/60 border border-white/5 rounded-2xl p-4"
      >
        <div className="flex justify-between text-xs mb-2">
          <span className="text-sky-400 font-bold">Level {result.level_info.level}</span>
          <span className="text-slate-500 font-mono">
            {result.level_info.xp_in_level} / {result.level_info.xp_for_next_level} XP
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${result.level_info.progress_pct}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">Total: {result.new_total_xp.toLocaleString()} XP</p>
      </motion.div>

      {/* ── Answer Review ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-900/60 border border-white/5 rounded-xl hover:bg-slate-800/60 transition-colors"
        >
          <span className="font-semibold text-slate-300 text-sm">Review Answers</span>
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showAnswers ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence>
          {showAnswers && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {result.answers.map((a, i) => (
                  <div
                    key={a.question_id}
                    className={`p-4 rounded-xl border ${
                      a.is_correct
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-rose-500/5 border-rose-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      {a.is_correct ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm text-slate-200 font-medium leading-snug">{a.question}</p>
                    </div>
                    <div className="ml-6 text-xs text-slate-500 space-y-1">
                      <p>
                        Your answer: <span className={a.is_correct ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>{a.submitted_key}</span>
                        {!a.is_correct && (
                          <> · Correct: <span className="text-emerald-400 font-semibold">{a.correct_key}</span></>
                        )}
                      </p>
                      {!a.is_correct && a.explanation && (
                        <p className="text-slate-400 leading-relaxed">{a.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-3 gap-2"
      >
        <Link href="/student/skill-tests/leaderboard">
          <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 font-semibold text-xs rounded-xl transition-colors">
            Leaderboard 🏆
          </button>
        </Link>
        <Link href="/student/skill-tests/skills">
          <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 font-semibold text-xs rounded-xl transition-colors">
            Skills
          </button>
        </Link>
        <Link href="/student/skill-tests">
          <button className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl transition-colors">
            Back to Arena
          </button>
        </Link>
      </motion.div>
    </div>
  );
}
